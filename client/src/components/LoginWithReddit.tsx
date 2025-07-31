import { useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

export default function LoginWithReddit() {
  const { setUsername: setAuthUsername, updateCredits } = useContext(AuthContext)
  const navigate = useNavigate()

  useEffect(() => {
    // Optional: Check if redirected back from Reddit
    const params = new URLSearchParams(window.location.search)
    const loggedIn = params.get('loggedIn') === 'true'

    if (loggedIn) {
      fetchUserData()
    }
  }, [])

  async function fetchUserData() {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/me`, {
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        setAuthUsername(data.username)
        await updateCredits()
        navigate('/')
      }
    } catch {
      // Handle network error or unexpected redirect
    }
  }

  function handleLoginWithReddit() {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/reddit`
  }

  return (
    <div className="max-w-md mx-auto p-4 border rounded space-y-4 text-center">
      <h2 className="text-xl font-bold">Login with Reddit</h2>

      <button
        onClick={handleLoginWithReddit}
        className="bg-orange-500 text-white py-2 px-4 rounded hover:bg-orange-600"
      >
        Login with Reddit
      </button>
    </div>
  )
}
