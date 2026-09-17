import type { ApiErrorBody } from './types';
import { useAuthStore } from '../store/auth';

const BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(typeof body.message === 'string' ? body.message : body.message.join(', '));
    this.name = 'ApiError';
  }
}

export type AuthMode = 'none' | 'access' | 'refresh';

interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  body?: unknown;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return undefined as T;
  const data = JSON.parse(text) as T;
  return data;
}

async function rawFetch<T>(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<T> {
  const initHeaders: Record<string, string> = { ...headers };

  if (body !== undefined) {
    initHeaders['Content-Type'] = 'application/json';
  }

  const init: RequestInit = {
    method,
    headers: initHeaders,
    credentials: 'omit',
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${path}`, init);

  if (!response.ok) {
    let errBody: ApiErrorBody;
    try {
      errBody = await parse<ApiErrorBody>(response);
    } catch {
      errBody = { statusCode: response.status, message: response.statusText || 'Request failed' };
    }
    throw new ApiError(response.status, errBody);
  }

  return parse<T>(response);
}

function authHeader(mode: AuthMode): Record<string, string> {
  if (mode === 'none') return {};
  const { accessToken, refreshToken } = useAuthStore.getState();
  const token = mode === 'refresh' ? refreshToken : accessToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function doRefreshToken(): Promise<boolean> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const result = await rawFetch<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      'POST',
      undefined,
      { Authorization: `Bearer ${refreshToken}` },
    );
    useAuthStore.getState().setTokens(result);
    return true;
  } catch {
    useAuthStore.getState().reset();
    return false;
  }
}

export async function api<T>(
  path: string,
  {
    method = 'GET',
    body,
    auth = 'none',
  }: RequestOptions & { method?: string; body?: unknown; auth?: AuthMode } = {},
): Promise<T> {
  const headers = authHeader(auth);
  try {
    return await rawFetch<T>(path, method, body, headers);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && auth === 'access') {
      const refreshed = await doRefreshToken();
      if (refreshed) {
        const retryHeaders = authHeader('access');
        return rawFetch<T>(path, method, body, retryHeaders);
      }
    }
    throw err;
  }
}