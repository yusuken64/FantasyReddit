import { useEffect, useState } from 'react'
import { api, message } from '../api'
interface Entry { id: string; symbol: string; instrument: string; action: string; quantity: number; cost: number; payout: number; created_at: string }
export default function History() {
  const [options, setOptions] = useState(false), [offset, setOffset] = useState(0), [dir, setDir] = useState('DESC'), [rows, setRows] = useState<Entry[]>([]), [error, setError] = useState('')
  useEffect(() => { let active = true; api<Entry[]>(`${options ? '/options/history' : '/transactions'}?offset=${offset}&limit=25&dir=${dir}`).then(data => { if (active) { setRows(data); setError('') } }).catch(e => { if (active) setError(message(e)) }); return () => { active = false } }, [options, offset, dir])
  return <><h1>Transaction history</h1><label><input type="checkbox" checked={options} onChange={e => { setOptions(e.target.checked); setOffset(0) }} /> Options only</label><label>Order<select value={dir} onChange={e => { setDir(e.target.value); setOffset(0) }}><option value="DESC">Newest first</option><option value="ASC">Oldest first</option></select></label>{error && <p role="alert">{error}</p>}
    <div className="table-scroll"><table><thead><tr><th>Date</th><th>Symbol</th><th>Action</th><th>Quantity</th><th>Cost</th><th>Payout</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.symbol}</td><td>{r.instrument} {r.action}</td><td>{r.quantity}</td><td>{r.cost}</td><td>{r.payout}</td></tr>)}</tbody></table></div>
    <button disabled={offset === 0} onClick={() => setOffset(offset - 25)}>Previous</button> <button disabled={rows.length < 25} onClick={() => setOffset(offset + 25)}>Next</button>
  </>
}
