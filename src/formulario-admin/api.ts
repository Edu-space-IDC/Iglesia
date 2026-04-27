import type {
  AccountUpdateInput,
  DynamicFormBootstrapPayload,
  DynamicFormQuestion,
  DynamicFormRecord,
  DynamicFormSettings,
  PublicConfig,
} from '../formulario/types';

const FORM_ADMIN_API_BASE = '/api/formulario-admin';
const FORM_ADMIN_TOKEN_STORAGE_KEY = 'la-barca-formulario-admin-token';

interface ApiErrorShape {
  ok?: boolean;
  message?: string;
  details?: string[];
  code?: string;
}

export class FormAdminApiError extends Error {
  statusCode: number;
  details: string[];
  code: string;

  constructor(message: string, statusCode = 500, details: string[] = [], code = '') {
    super(message);
    this.name = 'FormAdminApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

export function readStoredFormAdminToken() {
  return window.localStorage.getItem(FORM_ADMIN_TOKEN_STORAGE_KEY) || '';
}

export function writeStoredFormAdminToken(token: string) {
  if (!token) {
    window.localStorage.removeItem(FORM_ADMIN_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(FORM_ADMIN_TOKEN_STORAGE_KEY, token);
}

async function request<T>(path: string, init: RequestInit = {}, token = ''): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${FORM_ADMIN_API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new FormAdminApiError(
      'No pudimos conectar con el servidor del formulario admin. Revisa que este corriendo.',
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
    throw new FormAdminApiError(
      errorPayload.message || 'La solicitud del formulario admin fallo.',
      response.status,
      errorPayload.details || [],
      errorPayload.code || '',
    );
  }

  return payload as T;
}

export async function getPublicConfig() {
  return request<{ ok: true } & PublicConfig>('/public-config', {
    method: 'GET',
  });
}

export async function loginAdmin(username: string, password: string) {
  return request<{ ok: true; token: string; profile: DynamicFormBootstrapPayload['profile'] }>(
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
  return request<{ ok: true; profile: DynamicFormBootstrapPayload['profile'] }>(
    '/session',
    {
      method: 'GET',
    },
    token,
  );
}

export async function getBootstrap(token: string) {
  return request<{ ok: true } & DynamicFormBootstrapPayload>(
    '/bootstrap',
    {
      method: 'GET',
    },
    token,
  );
}

export async function createRecord(
  token: string,
  record: Omit<DynamicFormRecord, 'sheetRow'>,
) {
  return request<{ ok: true; record: DynamicFormRecord }>(
    '/records',
    {
      method: 'POST',
      body: JSON.stringify(record),
    },
    token,
  );
}

export async function updateRecord(token: string, record: DynamicFormRecord) {
  return request<{ ok: true; record: DynamicFormRecord }>(
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

export async function deleteAllRecords(token: string) {
  return request<{ ok: true }>(
    '/records',
    {
      method: 'DELETE',
    },
    token,
  );
}

export async function saveFormConfig(
  token: string,
  settings: DynamicFormSettings,
  questions: DynamicFormQuestion[],
) {
  return request<{ ok: true; settings: DynamicFormSettings; questions: DynamicFormQuestion[] }>(
    '/form-config',
    {
      method: 'PUT',
      body: JSON.stringify({ settings, questions }),
    },
    token,
  );
}

export async function updateAccount(token: string, input: AccountUpdateInput) {
  return request<{ ok: true; profile: DynamicFormBootstrapPayload['profile'] }>(
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
    response = await fetch(`${FORM_ADMIN_API_BASE}/records/export`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new FormAdminApiError(
      'No pudimos conectar con el servidor del formulario admin. Revisa que este corriendo.',
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

    throw new FormAdminApiError(
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
    filename: filenameMatch?.[1] || 'formulario-dinamico.xlsx',
  };
}
