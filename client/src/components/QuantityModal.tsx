import React, { useEffect, useCallback } from "react"
import { createPortal } from "react-dom"

interface QuantityModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (amount: number) => void
  max: number
  min: number
  initialAmount?: number
  title?: string
}

export const QuantityModal: React.FC<QuantityModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  max,
  min,
  initialAmount = 1,
  title = "Choose Quantity",
}) => {
  const [amount, setAmount] = React.useState(initialAmount)

  // Reset amount when modal opens
  useEffect(() => {
    if (isOpen) setAmount(initialAmount)
  }, [isOpen, initialAmount])

  // Close modal on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return createPortal(
    <div>
      <div>
        <h2 id="quantity-modal-title" className="text-xl font-bold mb-4">
          {title}
        </h2>

        {/* Increment / Decrement Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[1, 10, 100].map(n => (
            <button
              key={`plus-${n}`}
              onClick={() => setAmount(a => Math.min(max, a + n))}
              className="bg-green-100 text-green-800 px-3 py-1 rounded"
            >
              +{n}
            </button>
          ))}
          <button
            onClick={() => setAmount(max)}
            className="bg-green-200 text-green-900 px-3 py-1 rounded"
          >
            Max
          </button>
          {[1, 10, 100].map(n => (
            <button
              key={`minus-${n}`}
              onClick={() => setAmount(a => Math.max(min, a - n))}
              className="bg-red-100 text-red-800 px-3 py-1 rounded"
            >
              -{n}
            </button>
          ))}
          <button
            onClick={() => setAmount(0)}
            className="bg-red-200 text-red-900 px-3 py-1 rounded"
          >
            Zero
          </button>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <input
            type="number"
            value={amount}
            min={min}
            max={max}
            onChange={e => {
              const val = Number(e.target.value)
              if (!isNaN(val)) {
                setAmount(Math.min(max, Math.max(min, val)))
              }
            }}
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(amount)
              onClose()
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}