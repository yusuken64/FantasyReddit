export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status }
}
let csrfToken = ''
export function setCsrf(value: string) { csrfToken = value }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', ...(init.method && init.method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...init.headers,
  } })
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error?.code || 'REQUEST_FAILED', `${data.error?.message || 'Request failed.'}${data.requestId ? ` Reference: ${data.requestId}` : ''}`, response.status)
  return data as T
}
export function mutation<T>(path: string, body: unknown, key: string = crypto.randomUUID(), method = 'POST') {
  return api<T>(path, { method, body: JSON.stringify(body), headers: { 'Idempotency-Key': key } })
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please retry.'
