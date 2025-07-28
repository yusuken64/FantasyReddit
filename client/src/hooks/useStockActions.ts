import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export function useStockActions() {
  const { updateCredits } = useContext(AuthContext)

  async function buy(symbol: string) {
    try {
      const res = await fetch('http://localhost:5000/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol, quantity: 1 }),
      })
      if (res.ok) {
        alert(`Bought 1 share of ${symbol}`)
        await updateCredits()
      } else {
        const err = await res.json()
        alert(`Failed to buy stock: ${err.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert('Network error while buying stock')
      console.error(error)
    }
  }

  async function sell(symbol: string) {
    try {
      const res = await fetch('http://localhost:5000/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol, quantity: 1 }),
      })
      if (res.ok) {
        alert(`Sold 1 share of ${symbol}`)
        await updateCredits()
      } else {
        const err = await res.json()
        alert(`Failed to sell stock: ${err.error || 'Unknown error'}`)
      }
    } catch (error) {
      alert('Network error while selling stock')
      console.error(error)
    }
  }

  return { buy, sell }
}
