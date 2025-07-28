// src/components/RedditPostScore.tsx
import { useState } from 'react'

export default function RedditPostScore() {
  const [postId, setPostId] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchScore() {
    try {
      const res = await fetch(`https://www.reddit.com/comments/${postId}.json`)
      const json = await res.json()
      const post = json?.[0]?.data?.children?.[0]?.data
      setScore(post?.score ?? null)
      setError(null)
    } catch (err) {
      setError('Failed to fetch post score.')
      setScore(null)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Test Reddit Post Score</h2>
      <input
        className="border p-1 mr-2"
        placeholder="Enter Reddit Post ID"
        value={postId}
        onChange={(e) => setPostId(e.target.value)}
      />
      <button className="bg-blue-500 text-white px-2 py-1" onClick={fetchScore}>
        Get Score
      </button>
      {score !== null && <p className="mt-2">Score: {score}</p>}
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </div>
  )
}
