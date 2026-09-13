import { useCallback, useEffect, useRef, useState } from 'react'
import { api, message, mutation } from '../api'
import { useAuth } from '../context/auth'
interface Option { id: string; symbol: string; option_type: string; strike: number; premium: number; total_premium: number; quantity: number; expires_at: string; settlement_status: string }
export default function Options() {
  const { user, refresh } = useAuth(), [rows, setRows] = useState<Option[]>([]), [offset, setOffset] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const pending = useRef(false), keys = useRef(new Map<string, string>())
  const load = useCallback(async () => { try { setRows(await api<Option[]>(`/options?offset=${offset}&limit=25&dir=ASC`)); setError('') } catch (e) { setError(message(e)) } }, [offset])
  useEffect(() => { void load() }, [load])
  async function exercise(id: string) {
    if (pending.current || !user) return
    pending.current = true; setBusy(true)
    const key = keys.current.get(id) || crypto.randomUUID(); keys.current.set(id, key)
    try { await mutation(`/options/${id}/exercise`, { generation: user.generation }, key); await refresh(); await load() } catch (e) { setError(message(e)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <><h1>Options</h1><p>One contract = 100 shares. Pending expiry settlements wait for a valid market observation.</p>{error && <p role="alert">{error}</p>}
    {!rows.length && <p>No options on this page.</p>}{rows.map(o => <article key={o.id}><h2>{o.symbol} {o.option_type} · Strike {o.strike}</h2><p>{o.quantity} contracts · {o.premium} premium per share · {o.total_premium} total premium</p><p>Expires {new Date(o.expires_at).toLocaleString()} · {o.settlement_status}</p><button disabled={busy || o.settlement_status !== 'OPEN' || Date.parse(o.expires_at) <= Date.now()} onClick={() => void exercise(o.id)}>Exercise</button></article>)}
    <button disabled={offset === 0} onClick={() => setOffset(offset - 25)}>Previous</button> <button disabled={rows.length < 25} onClick={() => setOffset(offset + 25)}>Next</button>
  </>
}
