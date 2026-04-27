import type { DynamicFormPublicPayload } from './types';

const PUBLIC_FORM_API_BASE = '/api/formulario';

interface PublicApiErrorShape {
  ok?: boolean;
  message?: string;
  details?: string[];
}

export class PublicFormApiError extends Error {
  statusCode: number;
  details: string[];

  constructor(message: string, statusCode = 500, details: string[] = []) {
    super(message);
    this.name = 'PublicFormApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  let response: Response;

  try {
    response = await fetch(`${PUBLIC_FORM_API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new PublicFormApiError(
      'No pudimos conectar con el servidor del formulario. Intenta otra vez en unos minutos.',
      0,
    );
  }

  let payload: T | PublicApiErrorShape | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorPayload = (payload || {}) as PublicApiErrorShape;
    throw new PublicFormApiError(
      errorPayload.message || 'La solicitud del formulario fallo.',
      response.status,
      errorPayload.details || [],
    );
  }

  return payload as T;
}

export async function getDynamicFormConfig() {
  return request<DynamicFormPublicPayload>('/config', {
    method: 'GET',
  });
}

export async function submitDynamicForm(values: Record<string, string>) {
  return request<{ ok: true }>('/submit', {
    method: 'POST',
    body: JSON.stringify({ values }),
  });
}
