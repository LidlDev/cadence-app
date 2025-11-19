'use client'

import { useState, useEffect } from 'react'
import { X, Activity, Clock, MapPin, Heart, TrendingUp, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

interface StravaActivity {
  id: number
  name: string
  distance: string
  duration: string
  pace: string
  start_date: string
  average_hr?: number
  max_hr?: number
  elevation_gain?: number
  suffer_score?: number
}

interface LinkStravaModalProps {
  runId: string
  isOpen: boolean
  onClose: () => void
  onLinked: () => void
}

export default function LinkStravaModal({ runId, isOpen, onClose, onLinked }: LinkStravaModalProps) {
  const [activities, setActivities] = useState<StravaActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchActivities()
    }
  }, [isOpen])

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/strava/activities')
      const data = await response.json()

      if (data.success) {
        setActivities(data.activities)
      } else {
        console.error('Strava API error:', data)
        const errorMsg = data.error || 'Failed to fetch Strava activities'
        const details = data.details ? `\n\nDetails: ${data.details}` : ''
        alert(`${errorMsg}${details}\n\nPlease check:\n1. Strava is connected in your profile\n2. Your Strava token hasn't expired\n3. You have activities in the last 30 days`)
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
      alert('Failed to fetch Strava activities. Please check the console for details.')
    } finally {
      setLoading(false)
    }
  }

  const handleLink = async (activityId: number) => {
    setLinking(activityId)
    try {
      const response = await fetch('/api/strava/link-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, stravaActivityId: activityId }),
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Successfully linked Strava activity!')
        onLinked()
        onClose()
      } else {
        alert(data.error || 'Failed to link activity')
      }
    } catch (error) {
      console.error('Error linking activity:', error)
      alert('Failed to link activity')
    } finally {
      setLinking(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FC4C02] to-[#E34402] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">
              Link Strava Activity
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              <span className="ml-3 text-slate-600 dark:text-slate-400">Loading activities...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No recent Strava activities found</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                Activities from the last 30 days will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Select a Strava activity to link to this run. All data including pace, heart rate, and elevation will be synced.
              </p>
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => handleLink(activity.id)}
                  disabled={linking !== null}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                        {activity.name}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <MapPin className="w-4 h-4" />
                          <span>{activity.distance} km</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span>{activity.duration}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <TrendingUp className="w-4 h-4" />
                          <span>{activity.pace}/km</span>
                        </div>
                        {activity.average_hr && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Heart className="w-4 h-4" />
                            <span>{activity.average_hr} bpm</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                        {format(new Date(activity.start_date), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                    {linking === activity.id && (
                      <Loader2 className="w-5 h-5 text-primary-600 animate-spin flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

