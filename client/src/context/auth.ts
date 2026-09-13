import { createContext, useContext } from 'react'
export interface User { id: string; username: string; credits: number; generation: number; csrfToken: string }
export const AuthContext = createContext<{ user: User | null; loading: boolean; error: string; refresh: () => Promise<void>; logout: () => Promise<void>; clear: () => void }>({
  user: null, loading: true, error: '', refresh: async () => {}, logout: async () => {}, clear: () => {},
})
export const useAuth = () => useContext(AuthContext)
