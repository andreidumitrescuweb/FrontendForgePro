'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';

const TOKEN_KEY = 'forge_at';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-forge-csrf': '1' },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { accessToken: string };
    setAccessToken(json.accessToken);
    return true;
  } catch {
    return false;
  }
}

/** Fetch wrapper: bearer auth, automatic one-shot refresh on 401, typed errors. */
export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && !retried && (await tryRefresh())) {
    return api<T>(path, init, true);
  }
  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => ({}))) as {
    error?: { code: string; message: string; details?: unknown };
  } & T;
  if (!res.ok) {
    const err = json.error ?? { code: 'UNKNOWN', message: `Request failed (${res.status})` };
    throw new ApiRequestError(res.status, err.code, err.message, err.details);
  }
  return json;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const apiPatch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });
