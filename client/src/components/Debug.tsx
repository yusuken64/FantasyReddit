import React, { useContext, useState } from 'react'
import { AuthContext } from '../context/AuthContext'

const Debug: React.FC = () => {
  const { username, logout } = useContext(AuthContext)
  const [status, setStatus] = useState<string | null>(null)

  const handleReset = async () => {
    const confirmReset = window.confirm('Are you sure you want to reset your account? This will reset your credits and holdings.')
    if (!confirmReset) return

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/debug/reset-account`, {
        method: 'POST',
        credentials: 'include',
      })

      if (res.ok) {
        setStatus('✅ Account reset successfully. Reloading...')
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const text = await res.text()
        setStatus(`❌ Failed to reset account: ${text}`)
      }
    } catch (err) {
      console.error(err)
      setStatus(`❌ Error: ${(err as Error).message}`)
    }
  }

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete your account permanently? This action cannot be undone.')
    if (!confirmDelete) return

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/debug/delete-account`, {
        method: 'POST',
        credentials: 'include',
      })

      if (res.ok) {
        setStatus('✅ Account deleted successfully. Logging out...')
        logout()
      } else {
        const text = await res.text()
        setStatus(`❌ Failed to delete account: ${text}`)
      }
    } catch (err) {
      console.error(err)
      setStatus(`❌ Error: ${(err as Error).message}`)
    }
  }

  return (
    <div className="container my-5 p-4 bg-white rounded shadow-sm">
      <h2 className="mb-4">Debug Tools</h2>

      <p className="mb-2">
        Logged in as: <strong>{username ?? 'Not logged in'}</strong>
      </p>

      <button className="btn btn-warning me-3 mb-3" onClick={handleReset} disabled={!username}>
        Reset Account
      </button>

      <button className="btn btn-danger mb-3" onClick={handleDelete} disabled={!username}>
        Delete Account
      </button>

      {status && <div className="alert alert-info mt-2">{status}</div>}
    </div>
  )
}

export default Debug
