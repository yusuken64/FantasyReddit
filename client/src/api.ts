export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status }
}
let csrfToken = ''
export function setCsrf(value: string) { csrfToken = value }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestCsrf = csrfToken
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', ...(init.method && init.method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...init.headers,
  } })
  if (response.status === 401 && path !== '/me' && requestCsrf === csrfToken) window.dispatchEvent(new Event('session-expired'))
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error?.code || 'REQUEST_FAILED', `${data.error?.message || 'Request failed.'}${data.requestId ? ` Reference: ${data.requestId}` : ''}`, response.status)
  return data as T
}
export function mutation<T>(path: string, body: unknown, key: string = crypto.randomUUID(), method = 'POST') {
  return api<T>(path, { method, body: JSON.stringify(body), headers: { 'Idempotency-Key': key } })
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please retry.'
export function guidance(error: unknown) {
  const actions: Record<string, string> = {
    QUOTE_EXPIRED: 'Request a new quote and review it before confirming.',
    PRICE_CHANGED: 'Refresh the price, then request a new quote.',
    ACCOUNT_CHANGED: 'Your account changed. Refresh your account before trading.',
    POSITION_CHANGED: 'Refresh your holdings and quote the entire position again.',
    INSUFFICIENT_FUNDS: 'Reduce the quantity or refresh your available balance.',
    INSUFFICIENT_SHARES: 'Refresh your holdings and reduce the sale quantity.',
    HOLDING_LIMIT: 'You can hold 20 symbols. Sell and remove a position to free a slot.',
    DELISTED: 'This post was removed. Refresh your holdings; new purchases are unavailable.',
    QUOTE_UNAVAILABLE: 'This quote is unavailable. Refresh your account and request a new quote.',
  }
  return `${message(error)} ${error instanceof ApiError ? actions[error.code] || '' : ''}`.trim()
}
