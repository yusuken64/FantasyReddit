import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth'
import type { User } from './auth'
import { api, ApiError, message, mutation, setCsrf } from '../api'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const clear = useCallback(() => { setUser(null); setCsrf('') }, [])
  const refresh = useCallback(async () => {
    try { const next = await api<User>('/me'); setUser(next); setCsrf(next.csrfToken); setError('') }
    catch (e) { if (e instanceof ApiError && e.status === 401) clear(); else { setError(message(e)); throw e } }
    finally { setLoading(false) }
  }, [clear])
  useEffect(() => { void refresh().catch(() => {}) }, [refresh])
  async function logout() { await mutation('/auth/logout', {}); clear() }
  return <AuthContext.Provider value={{ user, loading, error, refresh, logout, clear }}>{children}</AuthContext.Provider>
}
