import { UserRole } from '@/src/types';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';
export const FASTAPI_API_BASE_URL =
  (import.meta.env.VITE_FASTAPI_API_BASE_URL as string | undefined) || '/api/v1';

interface SessionHeaderState {
  role: UserRole;
  userId: string;
}

let activeSessionHeaders: SessionHeaderState = {
  role: 'admin',
  userId: 'usr-admin-1',
};

export function setApiSessionHeaders(role: UserRole, userId: string): void {
  activeSessionHeaders = { role, userId };
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(API_BASE_URL, path, options);
}

export async function apiFetchV1<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(FASTAPI_API_BASE_URL, path, options);
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: RequestInit,
): Promise<T> {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('x-user-role', activeSessionHeaders.role);
  headers.set('x-user-id', activeSessionHeaders.userId);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const errorValue =
      typeof data === 'object' && data !== null && 'error' in data
        ? (data as { error: unknown }).error
        : null;
    const errMessage =
      typeof errorValue === 'string'
        ? errorValue
        : typeof errorValue === 'object' &&
            errorValue !== null &&
            'message' in errorValue &&
            typeof errorValue.message === 'string'
          ? errorValue.message
          : `Request failed with status ${response.status}`;
    throw new ApiError(errMessage, response.status);
  }

  return data as T;
}
