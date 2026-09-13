import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { api, message } from './api'
import { useAuth } from './context/auth'
let revision = 0
const listeners = new Set<() => void>()
export function invalidateData() { revision++; listeners.forEach(fn => fn()) }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function useResource<T>(path: string | null) {
  const { user } = useAuth()
  const userId = user?.id, generation = user?.generation
  const version = useSyncExternalStore(subscribe, () => revision)
  const [attempt, setAttempt] = useState(0)
  const key = `${user?.id}:${user?.generation}:${path}`
  const [state, setState] = useState<{ key: string; data?: T; error: string; loading: boolean }>({ key: '', error: '', loading: true })
  const reload = useCallback(() => setAttempt(value => value + 1), [])
  useEffect(() => {
    if (!path || !userId) return
    let active = true
    const controller = new AbortController()
    setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: '', loading: true }))
    api<T>(path, { signal: controller.signal }).then(data => {
      if (active) setState({ key, data, error: '', loading: false })
    }).catch(error => {
      if (active) setState(previous => ({ ...previous, error: message(error), loading: false }))
    })
    return () => { active = false; controller.abort() }
  }, [key, path, userId, generation, version, attempt])
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : '', loading: state.key !== key || state.loading, reload }
}
export const number = (value: number) => new Intl.NumberFormat().format(value)
export const credits = (value: number) => `${number(value)} virtual credits`
export function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); window.removeEventListener('visibilitychange', tick) }
  }, [])
  return now
}
export function fresh(observation: { observed_at: string | null; stale?: boolean | number; terminal?: boolean }, now: number) {
  return !!observation.terminal || (!observation.stale && !!observation.observed_at && now - Date.parse(observation.observed_at) < 600000)
}
