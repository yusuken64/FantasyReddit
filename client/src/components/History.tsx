import { useState } from 'react'
import { credits, number, useResource } from '../data'
import ReadState from './ReadState'
interface Entry { id: string; symbol: string; instrument: string; action: string; quantity: number; cost: number; payout: number; created_at: string }
export default function History() {
  const [options, setOptions] = useState(false), [offset, setOffset] = useState(0), [dir, setDir] = useState('DESC')
  const state = useResource<Entry[]>(`${options ? '/options/history' : '/transactions'}?offset=${offset}&limit=25&dir=${dir}`)
  return <><h1>Transaction history</h1><label><input type="checkbox" checked={options} onChange={e => { setOptions(e.target.checked); setOffset(0) }} /> Options only</label><label>Order<select value={dir} onChange={e => { setDir(e.target.value); setOffset(0) }}><option value="DESC">Newest first</option><option value="ASC">Oldest first</option></select></label>
    <button disabled={state.loading} onClick={state.reload}>Refresh history</button><ReadState {...state} hasData={state.data !== undefined} />
    {state.data?.length === 0 && <p>{options ? 'No option transactions match this page.' : 'No transactions on this page.'}</p>}
    {!!state.data?.length && <div className="table-scroll"><table><caption>Costs and payouts in virtual credits; payout is not profit</caption><thead><tr><th>Date</th><th>Symbol</th><th>Action</th><th>Quantity</th><th>Cost</th><th>Payout</th></tr></thead><tbody>{state.data.map(r => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.symbol}</td><td>{r.instrument} {r.action}</td><td>{number(r.quantity)}</td><td>{credits(r.cost)}</td><td>{credits(r.payout)}</td></tr>)}</tbody></table></div>}
    <div className="actions"><button disabled={offset === 0} onClick={() => setOffset(offset - 25)}>Previous</button><span>Page {offset / 25 + 1}</span><button disabled={state.loading || !state.data || state.data.length < 25 || !!state.error || offset >= 1000000} onClick={() => setOffset(offset + 25)}>Next</button></div>
  </>
}
