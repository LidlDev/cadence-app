'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Target, RefreshCw, Edit2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { calculateVDOTFromRuns, getRacePredictions, timeToSeconds, calculateAverageVDOT } from '@/lib/utils/vdot'

interface Prediction {
  distance: string
  predictedTime: string
  pace: string
}

export default function PredictionsCard() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [vdot, setVdot] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  // Add these two new state variables
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isFromPBs, setIsFromPBs] = useState(false)
  const [editingDistance, setEditingDistance] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ time: '', pace: '' })

  useEffect(() => {
    fetchPredictions()
  }, [])

  const handleEdit = (distance: string, time: string, pace: string) => {
    setEditingDistance(distance)
    setEditForm({ time, pace })
  }

  const handleSave = async (distance: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if a target already exists for this distance
    const { data: existingTarget } = await supabase
      .from('personal_bests')
      .select('id')
      .eq('user_id', user.id)
      .eq('distance', distance)
      .eq('is_target', true)
      .single()

    if (existingTarget) {
      // Update existing target
      const { error } = await supabase
        .from('personal_bests')
        .update({
          time: editForm.time,
          pace: editForm.pace || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTarget.id)

      if (!error) {
        setEditingDistance(null)
        fetchPredictions() // Refresh to show updated data
      }
    } else {
      // Insert new target
      const { error } = await supabase
        .from('personal_bests')
        .insert({
          user_id: user.id,
          distance: distance,
          distance_unit: 'km',
          time: editForm.time,
          pace: editForm.pace || null,
          is_target: true,
          achieved_date: new Date().toISOString().split('T')[0],
        })

      if (!error) {
        setEditingDistance(null)
        fetchPredictions() // Refresh to show updated data
      }
    }
  }

  const handleCancel = () => {
    setEditingDistance(null)
    setEditForm({ time: '', pace: '' })
  }

  const fetchPredictions = async () => {
    // Only set full loading state if we don't have data yet
    if (predictions.length === 0) setLoading(true)
    setIsRefreshing(true)

    try {
      const supabase = createClient()
      let calculatedVDOT: number | null = null
      let fromPBs = false

      // 1. Try to calculate average VDOT from Personal Bests first
      const { data: pbs } = await supabase
        .from('personal_bests')
        .select('distance, time')
        .eq('is_target', false)

      if (pbs && pbs.length > 0) {
        const validPBs = pbs.map(pb => {
          // Convert string distances to km numbers
          let dist = parseFloat(pb.distance)
          
          // Handle standard labels
          if (pb.distance === '5K') dist = 5
          else if (pb.distance === '10K') dist = 10
          else if (pb.distance === 'Half Marathon') dist = 21.0975
          else if (pb.distance === 'Marathon') dist = 42.195
          
          // If it didn't parse and isn't a known string, skip
          if (isNaN(dist) || dist === 0) return null

          return {
            distance: dist,
            time: pb.time
          }
        }).filter(item => item !== null) as { distance: number, time: string }[]

        if (validPBs.length > 0) {
          calculatedVDOT = calculateAverageVDOT(validPBs)
          if (calculatedVDOT) fromPBs = true
        }
      }

      // 2. Fallback to recent runs if no PBs available or calculation failed
      if (!calculatedVDOT) {
        const { data: runs } = await supabase
          .from('runs')
          .select('actual_distance, actual_time, scheduled_date')
          .eq('completed', true)
          .not('actual_time', 'is', null)
          .order('scheduled_date', { ascending: false })
          .limit(50)

        if (runs && runs.length > 0) {
          calculatedVDOT = calculateVDOTFromRuns(runs)
        }
      }

      if (!calculatedVDOT) {
        setLoading(false)
        setIsRefreshing(false)
        return
      }

      setVdot(calculatedVDOT)
      setIsFromPBs(fromPBs)

      // Get race predictions
      const racePredictions = getRacePredictions(calculatedVDOT)

      // Format predictions with pace
      const formattedPredictions: Prediction[] = Object.entries(racePredictions).map(([distance, time]) => {
        const distanceKm = distance === '5K' ? 5 : distance === '10K' ? 10 : distance === 'Half Marathon' ? 21.0975 : 42.195
        const timeSeconds = timeToSeconds(time)
        const paceSeconds = timeSeconds / distanceKm
        const paceMinutes = Math.floor(paceSeconds / 60)
        const paceSecondsRemainder = Math.floor(paceSeconds % 60)
        const pace = `${paceMinutes}:${paceSecondsRemainder.toString().padStart(2, '0')}/km`

        return {
          distance,
          predictedTime: time,
          pace,
        }
      })

      setPredictions(formattedPredictions)
    } catch (error) {
      console.error('Failed to fetch predictions:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Race Predictions
          </h2>
        </div>
        <button
          onClick={fetchPredictions}
          disabled={isRefreshing}
          className={`p-2 rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 ${isRefreshing ? 'animate-spin text-purple-500' : ''}`}
          title="Recalculate VDOT"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
      ) : predictions.length > 0 ? (
        <>
          {/* VDOT Display */}
          {vdot && (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Your VDOT</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    Based on {isFromPBs ? 'average PB performance' : 'recent runs'}
                  </p>
                </div>
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {vdot.toFixed(1)}
                </p>
              </div>
            </div>
          )}

          {/* Predictions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
              Predicted Race Times
            </h3>
            {predictions.map((pred, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                {editingDistance === pred.distance ? (
                  <>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white mb-2">
                        {pred.distance}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          placeholder="Time (e.g., 45:30)"
                          className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          value={editForm.pace}
                          onChange={(e) => setEditForm({ ...editForm, pace: e.target.value })}
                          placeholder="Pace (e.g., 4:30/km)"
                          className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleSave(pred.distance)}
                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-green-600 dark:text-green-400"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {pred.distance}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {pred.pace} pace
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-purple-600 dark:text-purple-400 text-lg">
                          {pred.predictedTime}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit(pred.distance, pred.predictedTime, pred.pace)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                        title="Set as target"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 italic">
            Predictions based on VDOT formula (Jack Daniels' Running Formula)
          </p>
        </>
      ) : (
        <div className="text-center py-8">
          <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Complete some runs to see race predictions
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            We'll calculate your VDOT and predict race times
          </p>
        </div>
      )}
    </div>
  )
}

