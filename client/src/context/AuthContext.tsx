import { createContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

interface AuthContextType {
  username: string | null
  credits: number | null
  setUsername: (username: string | null) => void
  setCredits: (credits: number | null) => void
  logout: () => void
  updateCredits: () => Promise<void> 
}

export const AuthContext = createContext<AuthContextType>({
  username: null,
  credits: null,
  setUsername: () => { },
  setCredits: () => { },
  logout: () => { },
  updateCredits: function (): Promise<void> {
    throw new Error('Function not implemented.')
  }
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    // On mount, check if user is logged in
    fetch('http://localhost:5000/me', {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Not logged in')
        return res.json()
      })
      .then((data) => {
        setUsername(data.username)
        setCredits(data.credits)
      })
      .catch(() => {
        setUsername(null)
        setCredits(null)
      })
  }, [])
  
  async function updateCredits() {
    try {
      const res = await fetch('http://localhost:5000/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCredits(data.credits)
      }
    } catch (err) {
      console.error('Failed to update credits:', err)
    }
  }

  function logout() {
    fetch('http://localhost:5000/logout', {
      method: 'POST',
      credentials: 'include',
    }).then(() => {
      setUsername(null)
      setCredits(null)
    })
  }

  return (
<AuthContext.Provider value={{ username, credits, setUsername, setCredits, logout, updateCredits }}>
  {children}
</AuthContext.Provider>
  )
}