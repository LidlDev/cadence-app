'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'

interface Prediction {
  distance: string
  predictedTime: string
  pace: string
}

export default function PredictionsCard() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPredictions()
  }, [])

  const fetchPredictions = async () => {
    try {
      const response = await fetch('/api/ai/predictions')
      const data = await response.json()
      setPredictions(data.predictions || [])
    } catch (error) {
      console.error('Failed to fetch predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-purple-500" />
        Performance Predictions
      </h2>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
      ) : predictions.length > 0 ? (
        <div className="space-y-3">
          {predictions.map((pred, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {pred.distance}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {pred.pace}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-purple-600 dark:text-purple-400 text-lg">
                  {pred.predictedTime}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Complete some runs to see predictions
        </p>
      )}
    </div>
  )
}

