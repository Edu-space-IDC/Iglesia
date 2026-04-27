import type {
  AccountUpdateInput,
  BootstrapPayload,
  PublicConfig,
  StatusOption,
  SurveyRecord,
} from './types';

const ADMIN_API_BASE = import.meta.env.VITE_ADMIN_API_URL || '/api/admin';
const ADMIN_TOKEN_STORAGE_KEY = 'la-barca-admin-token';

interface ApiErrorShape {
  ok?: boolean;
  message?: string;
  details?: string[];
  code?: string;
}

export class AdminApiError extends Error {
  statusCode: number;
  details: string[];
  code: string;

  constructor(message: string, statusCode = 500, details: string[] = [], code = '') {
    super(message);
    this.name = 'AdminApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

export function readStoredAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
}

export function writeStoredAdminToken(token: string) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

async function request<T>(path: string, init: RequestInit = {}, token = ''): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${ADMIN_API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new AdminApiError(
      'No pudimos conectar con el servidor admin local. Revisa que este corriendo.',
      0,
    );
  }

  let payload: ApiErrorShape | T | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = (payload || {}) as ApiErrorShape;
    throw new AdminApiError(
      errorPayload.message || 'La solicitud al panel admin fallo.',
      response.status,
      errorPayload.details || [],
      errorPayload.code || '',
    );
  }

  return payload as T;
}

export async function getPublicConfig() {
  const payload = await request<{ ok: true } & PublicConfig>('/public-config', {
    method: 'GET',
  });

  return payload;
}

export async function loginAdmin(username: string, password: string) {
  return request<{ ok: true; token: string; profile: BootstrapPayload['profile'] }>(
    '/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  );
}

export async function logoutAdmin(token: string) {
  return request<{ ok: true }>(
    '/logout',
    {
      method: 'POST',
    },
    token,
  );
}

export async function getAdminSession(token: string) {
  return request<{ ok: true; profile: BootstrapPayload['profile'] }>(
    '/session',
    {
      method: 'GET',
    },
    token,
  );
}

export async function getBootstrap(token: string) {
  const payload = await request<{ ok: true } & BootstrapPayload>(
    '/bootstrap',
    {
      method: 'GET',
    },
    token,
  );

  return payload;
}

export async function createRecord(token: string, record: Omit<SurveyRecord, 'sheetRow'>) {
  return request<{ ok: true; record: SurveyRecord }>(
    '/records',
    {
      method: 'POST',
      body: JSON.stringify(record),
    },
    token,
  );
}

export async function updateRecord(token: string, record: SurveyRecord) {
  return request<{ ok: true; record: SurveyRecord }>(
    `/records/${record.sheetRow}`,
    {
      method: 'PUT',
      body: JSON.stringify(record),
    },
    token,
  );
}

export async function deleteRecord(token: string, sheetRow: number) {
  return request<{ ok: true }>(
    `/records/${sheetRow}`,
    {
      method: 'DELETE',
    },
    token,
  );
}

export async function saveStatuses(token: string, statuses: StatusOption[]) {
  return request<{ ok: true; statuses: StatusOption[] }>(
    '/statuses',
    {
      method: 'PUT',
      body: JSON.stringify({ statuses }),
    },
    token,
  );
}

export async function updateAccount(token: string, input: AccountUpdateInput) {
  return request<{ ok: true; profile: BootstrapPayload['profile'] }>(
    '/account',
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
    token,
  );
}

export async function downloadRecordsExcel(token: string) {
  let response: Response;

  try {
    response = await fetch(`${ADMIN_API_BASE}/records/export`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new AdminApiError(
      'No pudimos conectar con el servidor admin local. Revisa que este corriendo.',
      0,
    );
  }

  if (!response.ok) {
    let errorPayload: ApiErrorShape = {};

    try {
      errorPayload = (await response.json()) as ApiErrorShape;
    } catch {
      errorPayload = {};
    }

    throw new AdminApiError(
      errorPayload.message || 'No pudimos descargar el archivo de Excel.',
      response.status,
      errorPayload.details || [],
      errorPayload.code || '',
    );
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition') || '';
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/iu);

  return {
    blob,
    filename: filenameMatch?.[1] || 'encuestas-la-barca.xlsx',
  };
}
