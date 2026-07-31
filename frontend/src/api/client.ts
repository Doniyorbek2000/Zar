import { useAuth } from '../store/auth';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const state = useAuth.getState();
  if (auth && state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

  let res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Access token muddati o'tgan bo'lsa — refresh qilishga urinamiz
  if (res.status === 401 && auth && state.refreshToken) {
    const refreshed = await tryRefresh(state.refreshToken);
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed}`;
      res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    }
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err = json?.error;
    if (res.status === 401) useAuth.getState().logout();
    throw new ApiError(res.status, err?.message ?? 'So\'rovda xatolik', err?.code);
  }
  return json.data as T;
}

async function tryRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (!json.success) return null;
    const cur = useAuth.getState();
    useAuth.setState({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
    return json.data.accessToken;
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
