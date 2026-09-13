import { useSyncExternalStore } from 'react'
import { ApiError, guidance, mutation } from './api'
import { useAuth } from './context/auth'
import type { User } from './context/auth'
import { invalidateData } from './data'

const storageKey = 'fantasy-reddit-operation-v1'
type Result = { success: true; credits: number; payout?: number; optionId?: string | null }
export interface Operation {
  account: string; generation: number; key: string; path: string
  body: { quoteId: string } | { generation: number }
  summary: string; status: 'submitting' | 'unknown' | 'success' | 'rejected'
  error: string; result?: Result
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function restore(): Operation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    if (!value || typeof value.account !== 'string' || !Number.isSafeInteger(value.generation) || value.generation < 0 || !uuid.test(value.key) || typeof value.summary !== 'string' || value.summary.length > 2000) return null
    const order = value.path === '/orders' && value.body && Object.keys(value.body).length === 1 && uuid.test(value.body.quoteId)
    const exercise = /^\/options\/[0-9a-f-]+\/exercise$/i.test(value.path) && uuid.test(value.path.split('/')[2]) && value.body && Object.keys(value.body).length === 1 && value.body.generation === value.generation
    if (!order && !exercise) return null
    if (!['submitting', 'unknown', 'success', 'rejected'].includes(value.status)) return null
    if (value.status === 'success' && (!value.result?.success || !Number.isSafeInteger(value.result.credits) || value.result.credits < 0 || (exercise && (!Number.isSafeInteger(value.result.payout) || value.result.payout < 0)))) return null
    return { ...value, status: value.status === 'submitting' ? 'unknown' : value.status, error: typeof value.error === 'string' ? value.error : '' }
  } catch { return null }
}
let current = restore()
let inFlight = false
const listeners = new Set<() => void>()
function publish(value: Operation | null) { current = value; listeners.forEach(fn => fn()) }
function save(value: Operation) { sessionStorage.setItem(storageKey, JSON.stringify(value)) }
export function clearOperations() {
  try { sessionStorage.removeItem(storageKey) } catch { /* Account checks still prevent replay. */ }
  publish(null)
}
export function matchOperation(user: User) {
  if (current && (current.account !== user.id || current.generation !== user.generation)) clearOperations()
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
async function execute(operation: Operation) {
  if (inFlight) return
  // Save before the request. If storage is unavailable no mutation is sent.
  try { save({ ...operation, status: 'submitting', error: '' }) }
  catch { throw new Error('Storage unavailable. Enable session storage and try again; no trade was submitted.') }
  inFlight = true
  publish({ ...operation, status: 'submitting', error: '' })
  try {
    const result = await mutation<Result>(operation.path, operation.body, operation.key)
    if (result?.success !== true || !Number.isSafeInteger(result.credits) || result.credits < 0 || (operation.path !== '/orders' && (!Number.isSafeInteger(result.payout) || result.payout! < 0))) throw new Error('The confirmation could not be read.')
    if (current?.key === operation.key) {
      const next: Operation = { ...operation, status: 'success', result, error: '' }
      try { save(next) } catch { /* Original request remains replayable after reload. */ }
      publish(next)
      invalidateData()
    }
    return true
  } catch (error) {
    // 401/403 can occur while replaying a previously committed operation; retain its identity.
    const rejected = error instanceof ApiError && [400, 404, 409].includes(error.status) && error.code !== 'IDEMPOTENCY_CONFLICT'
    if (current?.key === operation.key) {
      const next: Operation = { ...operation, status: rejected ? 'rejected' : 'unknown', error: guidance(error) }
      try { save(next) } catch { /* Existing durable request still has the same identity. */ }
      publish(next)
    }
    return false
  } finally { inFlight = false }
}
export function useOperations() {
  const { user, refresh } = useAuth()
  const stored = useSyncExternalStore(subscribe, () => current)
  const operation = user && stored?.account === user.id && stored.generation === user.generation ? stored : null
  async function run(path: string, body: Operation['body'], summary: string) {
    if (!user || inFlight || current?.status === 'submitting' || current?.status === 'unknown') return false
    const done = await execute({ account: user.id, generation: user.generation, key: crypto.randomUUID(), path, body, summary, status: 'submitting', error: '' })
    if (done) await refresh().catch(() => {})
    return done
  }
  async function retry() {
    if (!user || !operation || operation.status !== 'unknown') return
    const account = await refresh()
    if (!account || account.id !== operation.account || account.generation !== operation.generation || current?.key !== operation.key) return
    const done = await execute(operation)
    if (done) await refresh().catch(() => {})
  }
  return { operation, blocked: operation?.status === 'submitting' || operation?.status === 'unknown', run, retry, dismiss: clearOperations }
}
