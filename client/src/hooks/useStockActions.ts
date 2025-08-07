import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export function useStockActions() {
  const { updateCredits } = useContext(AuthContext)

  async function buy(symbol: string, quantity: number) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol, quantity: quantity }),
      })
      if (res.ok) {
        const data = await res.json();
        alert(`Bought ${quantity} share of ${symbol} at ${data.price}`)
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

  async function sell(symbol: string, quantity: number) {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol, quantity: quantity }),
      })
      if (res.ok) {
        const data = await res.json();
        alert(`Sold ${quantity} share of ${symbol} as ${data.price}`)
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
