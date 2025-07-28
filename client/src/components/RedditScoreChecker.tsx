// src/components/RedditScoreChecker.tsx
import { useState } from 'react'

function extractPostId(input: string): string | null {
  const match = input.match(/comments\/([a-z0-9]+)/i)
  return match ? match[1] : null
}

interface PostData {
  title: string
  subreddit: string
  author: string
  score: number
  num_comments: number
  url: string
}

async function fetchPostData(postId: string): Promise<PostData | null> {
  try {
    const res = await fetch(`https://www.reddit.com/comments/${postId}.json`)
    const json = await res.json()
    const data = json?.[0]?.data?.children?.[0]?.data
    if (!data) return null

    return {
      title: data.title,
      subreddit: data.subreddit_name_prefixed,
      author: data.author,
      score: data.score,
      num_comments: data.num_comments,
      url: `https://reddit.com${data.permalink}`,
    }
  } catch {
    return null
  }
}

export function RedditScoreChecker() {
  const [input, setInput] = useState('')
  const [post, setPost] = useState<PostData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleCheck = async () => {
    setPost(null)
    setError(null)
    setLoading(true)

    const id = extractPostId(input.trim()) ?? input.trim()
    if (!id) {
      setError('Invalid Reddit URL or ID')
      setLoading(false)
      return
    }

    const postData = await fetchPostData(id)
    if (!postData) {
      setError('Could not fetch post data')
    } else {
      setPost(postData)
    }
    setLoading(false)
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-2">Test Reddit Post Details</h2>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter post ID or URL"
        className="w-full border p-2 mb-2 rounded"
      />
      <button
        onClick={handleCheck}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Get Post Details'}
      </button>

      {error && <p className="mt-2 text-red-500">{error}</p>}

      {post && (
        <div className="mt-4 border p-4 rounded bg-gray-50">
          <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
          <p>
            <strong>Subreddit:</strong> {post.subreddit}
          </p>
          <p>
            <strong>Author:</strong> {post.author}
          </p>
          <p>
            <strong>Score:</strong> {post.score.toLocaleString()}
          </p>
          <p>
            <strong>Comments:</strong> {post.num_comments.toLocaleString()}
          </p>
          <p>
            <strong>URL:</strong>{' '}
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              View on Reddit
            </a>
          </p>
        </div>
      )}
    </div>
  )
}
