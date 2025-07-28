import { useState } from 'react'

export default function TestReddit() {
  const [postId, setPostId] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchScore = async () => {
    try {
      const res = await fetch(`https://www.reddit.com/comments/${postId}.json`)
      const json = await res.json()
      const postData = json[0]?.data?.children[0]?.data
      if (!postData) throw new Error('Post not found')
      setScore(postData.score)
      setError(null)
    } catch (e: any) {
      setScore(null)
      setError(e.message || 'Unknown error')
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Check Reddit Post Score</h1>
      <input
        value={postId}
        onChange={(e) => setPostId(e.target.value)}
        placeholder="Enter Reddit post ID (e.g. abc123)"
        className="border p-2 w-full mb-2"
      />
      <button
        onClick={fetchScore}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Fetch Score
      </button>
      {score !== null && <p className="mt-4">Score: {score}</p>}
      {error && <p className="mt-4 text-red-500">Error: {error}</p>}
    </div>
  )
}
