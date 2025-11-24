'use client'

import { useState, useEffect } from 'react'
import { Trophy, Medal, Award, ExternalLink, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RunDetailModal from './RunDetailModal'
import { updateBestPerformances } from '@/lib/utils/update-best-performances'

interface Performance {
  id: string
  run_id: string
  distance_label: string
  time_seconds: number
  pace_per_km: string
  activity_date: string
  rank: number
}

interface BestPerformancesProps {
  userId: string
}

export default function BestPerformances({ userId }: BestPerformancesProps) {
  const [performances, setPerformances] = useState<{ [key: string]: Performance[] }>({})
  const [loading, setLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const distances = ['1K', '5K', '10K', 'Half Marathon', 'Marathon']

  useEffect(() => {
    fetchBestPerformances()
  }, [userId])

  const fetchBestPerformances = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('best_performances')
        .select('*')
        .eq('user_id', userId)
        .order('distance_label', { ascending: true })
        .order('rank', { ascending: true })

      if (error) throw error

      // Group by distance
      const grouped: { [key: string]: Performance[] } = {}
      data?.forEach((perf) => {
        if (!grouped[perf.distance_label]) {
          grouped[perf.distance_label] = []
        }
        grouped[perf.distance_label].push(perf)
      })

      setPerformances(grouped)
    } catch (error) {
      console.error('Error fetching best performances:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const supabase = createClient()

      // Fetch all completed runs
      const { data: runs, error } = await supabase
        .from('runs')
        .select('id, actual_distance, actual_time, actual_pace, scheduled_date')
        .eq('user_id', userId)
        .eq('completed', true)
        .not('actual_distance', 'is', null)
        .not('actual_time', 'is', null)

      if (error) throw error

      // Update best performances for each run
      for (const run of runs || []) {
        await updateBestPerformances(
          supabase,
          userId,
          run.id,
          run.actual_distance,
          run.actual_time,
          run.actual_pace || '',
          run.scheduled_date
        )
      }

      // Refresh the display
      await fetchBestPerformances()
    } catch (error) {
      console.error('Error refreshing best performances:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />
      case 2:
        return <Medal className="w-5 h-5 text-slate-400" />
      case 3:
        return <Award className="w-5 h-5 text-amber-700" />
      default:
        return null
    }
  }

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-300 dark:border-yellow-700'
      case 2:
        return 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-slate-300 dark:border-slate-600'
      case 3:
        return 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300 dark:border-amber-700'
      default:
        return 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    }
  }

  const handleViewRun = (runId: string) => {
    setSelectedRunId(runId)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Best Performances
          </h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh best performances from all completed runs"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-6">
        {distances.map((distance) => (
          <div key={distance}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              {distance}
            </h3>
            
            {performances[distance] && performances[distance].length > 0 ? (
              <div className="space-y-2">
                {performances[distance].map((perf) => {
                  // Convert time_seconds to formatted time
                  const hours = Math.floor(perf.time_seconds / 3600)
                  const minutes = Math.floor((perf.time_seconds % 3600) / 60)
                  const seconds = perf.time_seconds % 60
                  const formattedTime = hours > 0
                    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                    : `${minutes}:${seconds.toString().padStart(2, '0')}`

                  return (
                    <div
                      key={perf.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${getMedalColor(perf.rank)} transition-all hover:shadow-md cursor-pointer`}
                      onClick={() => handleViewRun(perf.run_id)}
                    >
                      <div className="flex items-center gap-3">
                        {getMedalIcon(perf.rank)}
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {formattedTime}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {perf.pace_per_km}/km • {new Date(perf.activity_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                No performances recorded yet
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Run Detail Modal */}
      {selectedRunId && (
        <RunDetailModal
          isOpen={!!selectedRunId}
          onClose={() => setSelectedRunId(null)}
          runId={selectedRunId}
          userId={userId}
        />
      )}
    </div>
  )
}

