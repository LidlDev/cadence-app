'use client'

import { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  isOpen: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, isOpen, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
      <div
        className={`
          flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border-2 min-w-[320px] max-w-md
          ${
            type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-600'
              : 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-600'
          }
        `}
      >
        {type === 'success' ? (
          <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
        )}
        
        <p
          className={`
            flex-1 font-semibold
            ${
              type === 'success'
                ? 'text-emerald-900 dark:text-emerald-100'
                : 'text-red-900 dark:text-red-100'
            }
          `}
        >
          {message}
        </p>

        <button
          onClick={onClose}
          className={`
            p-1 rounded-lg transition-colors flex-shrink-0
            ${
              type === 'success'
                ? 'hover:bg-emerald-200 dark:hover:bg-emerald-800'
                : 'hover:bg-red-200 dark:hover:bg-red-800'
            }
          `}
        >
          <X
            className={`
              w-4 h-4
              ${
                type === 'success'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }
            `}
          />
        </button>
      </div>
    </div>
  )
}

