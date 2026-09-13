import { useRef, useState } from 'react'
import { mutation, message } from '../api'
import { useAuth } from '../context/auth'
export default function Account() {
  const { user, refresh, clear } = useAuth(), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [status, setStatus] = useState('')
  const pending = useRef(false), resetKey = useRef(crypto.randomUUID())
  async function act(remove: boolean) {
    if (!user || pending.current) return
    pending.current = true; setBusy(true); setStatus('')
    try {
      await mutation(remove ? '/account' : '/account/reset', { generation: user.generation }, resetKey.current, remove ? 'DELETE' : 'POST')
      if (remove) clear(); else { await refresh(); resetKey.current = crypto.randomUUID(); setStatus('Account reset to 10,000 credits. All positions and history were cleared.') }
      setConfirmation('')
    } catch (e) { setStatus(message(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <><h1>Account</h1><p>Reset clears all stocks, options, quotes and history, restores 10,000 credits, and logs out other sessions. Deletion removes the account and all its game data.</p><label>Type RESET or DELETE to confirm<input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button disabled={busy || confirmation !== 'RESET'} onClick={() => void act(false)}>Reset account</button> <button className="danger" disabled={busy || confirmation !== 'DELETE'} onClick={() => void act(true)}>Delete account</button>{status && <p role="status">{status}</p>}</>
}
