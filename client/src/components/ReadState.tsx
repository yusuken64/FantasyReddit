export default function ReadState({ loading, error, hasData, reload }: { loading: boolean; error: string; hasData: boolean; reload: () => void }) {
  return <>{loading && <p role="status">{hasData ? 'Refreshing…' : 'Loading…'}</p>}
    {error && <div role="alert"><p>{hasData ? 'Refresh failed. Previously loaded data is shown and may be out of date. ' : ''}{error}</p><button onClick={reload}>Retry refresh</button></div>}
  </>
}
