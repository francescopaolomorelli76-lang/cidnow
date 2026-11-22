/** Client API: cookie di sessione first-party + header anti-CSRF richiesto dal server. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'x-fpm-client': 'web' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Server non raggiungibile. Controlla la connessione.');
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? `Errore ${res.status}`);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body: unknown = {}) => api<T>('POST', path, body);
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, body);
