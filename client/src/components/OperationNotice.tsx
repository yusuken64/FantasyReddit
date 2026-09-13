import { useState } from 'react'
import { useOperations } from '../operations'
import { useAuth } from '../context/auth'
import { credits, invalidateData } from '../data'
import { message } from '../api'
export default function OperationNotice() {
  const { operation, retry, dismiss } = useOperations()
  const { error: accountError, refresh } = useAuth()
  const [error, setError] = useState('')
  if (!operation) return null
  return <section className="receipt" aria-label="Trade status">
    <div role="status"><h2>{operation.status === 'success' ? 'Trade confirmed' : operation.status === 'submitting' ? 'Submitting trade…' : operation.status === 'unknown' ? 'Trade outcome unknown' : 'Trade not completed'}</h2></div>
    <p>{operation.summary}</p>
    {operation.result && <p role="status">{operation.result.payout !== undefined && <>Payout: {credits(operation.result.payout)}. </>}Balance after trade: {credits(operation.result.credits)}.</p>}
    {operation.status === 'unknown' && <p>Confirmation was not received. Retry this same operation to check its result before starting another trade. Recovery is available in this browser tab after a reload or re-login.</p>}
    {(operation.error || error) && <p role="alert">{operation.error || error}</p>}
    {operation.status === 'unknown' && <button onClick={() => void retry().catch(e => setError(message(e)))}>Retry same operation</button>}
    {operation.status === 'success' && <>{accountError && <p role="alert">Your trade succeeded, but the account refresh failed. {accountError}</p>}<button onClick={() => { invalidateData(); void refresh().catch(() => {}) }}>Refresh account and positions</button></>}
    {(operation.status === 'success' || operation.status === 'rejected') && <button onClick={dismiss}>Dismiss receipt</button>}
  </section>
}
