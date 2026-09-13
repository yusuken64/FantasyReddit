import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth'
import type { User } from './auth'
import { api, ApiError, message, mutation, setCsrf } from '../api'
import { clearOperations, matchOperation } from '../operations'
import { invalidateData } from '../data'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const epoch = useRef(0)
  const clear = useCallback(() => { epoch.current++; setUser(null); setCsrf(''); invalidateData() }, [])
  const refresh = useCallback(async () => {
    const request = ++epoch.current
    try {
      const next = await api<User>('/me')
      if (request !== epoch.current) return null
      matchOperation(next); setUser(next); setCsrf(next.csrfToken); setError('')
      return next
    } catch (e) {
      if (request !== epoch.current) return null
      if (e instanceof ApiError && e.status === 401) { clear(); setLoading(false); setError('Your session ended. Log in again to continue or recover a pending trade.') }
      else if (request === epoch.current) { setError(message(e)); throw e }
      return null
    } finally { if (request === epoch.current) setLoading(false) }
  }, [clear])
  useEffect(() => {
    const expire = () => { clear(); setLoading(false); setError('Your session ended. Log in again to continue or recover a pending trade.') }
    window.addEventListener('session-expired', expire)
    void refresh().catch(() => {})
    return () => { window.removeEventListener('session-expired', expire) }
  }, [clear, refresh])
  async function logout() { await mutation('/auth/logout', {}); clearOperations(); clear(); setError('') }
  return <AuthContext.Provider value={{ user, loading, error, refresh, logout, clear }}>{children}</AuthContext.Provider>
}
