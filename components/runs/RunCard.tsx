'use client'

import { useState } from 'react'
import { Run } from '@/lib/types/database'
import { format } from 'date-fns'
import { CheckCircle, Circle, Clock, MapPin, Zap, MessageSquare, Activity, Link } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RunDetailModal from './RunDetailModal'
import LinkStravaModal from './LinkStravaModal'
import { updateBestPerformances } from '@/lib/utils/update-best-performances'

interface RunCardProps {
  run: Run
  userId: string
}

export default function RunCard({ run, userId }: RunCardProps) {
  const [isLogging, setIsLogging] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [formData, setFormData] = useState({
    actual_distance: run.actual_distance || run.planned_distance,
    actual_pace: run.actual_pace || '',
    actual_time: run.actual_time || '',
    rpe: run.rpe || 5,
    comments: run.comments || '',
  })

  const handleLogRun = async () => {
    const supabase = createClient()

    // Update the run
    const { error } = await supabase
      .from('runs')
      .update({
        completed: true,
        ...formData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    if (error) {
      console.error('Error updating run:', error)
      return
    }

    // Check if this is a new PB
    await checkAndUpdatePB(supabase, formData.actual_distance, formData.actual_time, formData.actual_pace)

    // Update best performances
    if (formData.actual_time && formData.actual_pace) {
      await updateBestPerformances(
        supabase,
        userId,
        run.id,
        formData.actual_distance,
        formData.actual_time,
        formData.actual_pace,
        run.scheduled_date
      )
    }

    window.location.reload()
  }

  const checkAndUpdatePB = async (supabase: any, distance: number, time: string, pace: string) => {
    // Map distance to PB distance categories
    const pbDistanceMap: { [key: number]: string} = {
      5: '5K',
      10: '10K',
      21.1: 'Half Marathon',
      42.2: 'Marathon',
    }

    const pbDistance = pbDistanceMap[distance]
    if (!pbDistance || !time) return

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get existing PB for this distance
    const { data: existingPB } = await supabase
      .from('personal_bests')
      .select('*')
      .eq('user_id', user.id)
      .eq('distance', pbDistance)
      .eq('is_target', false)
      .single()

    // Convert time to seconds for comparison
    const timeToSeconds = (timeStr: string) => {
      const parts = timeStr.split(':').map(Number)
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1]
      }
      return 0
    }

    const newTimeSeconds = timeToSeconds(time)

    if (existingPB) {
      const existingTimeSeconds = timeToSeconds(existingPB.time)

      // Update if new time is faster
      if (newTimeSeconds > 0 && newTimeSeconds < existingTimeSeconds) {
        await supabase
          .from('personal_bests')
          .update({
            time,
            pace,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPB.id)
      }
    } else if (newTimeSeconds > 0) {
      // Create new PB if none exists
      await supabase
        .from('personal_bests')
        .insert({
          user_id: user.id,
          distance: pbDistance,
          distance_unit: 'km',
          time,
          pace,
          is_target: false,
        })
    }
  }

  const handleSyncStrava = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch('/api/strava/sync-latest', {
        method: 'POST',
      })

      const result = await response.json()

      if (result.success && result.data) {
        // Auto-populate form with Strava data
        setFormData({
          actual_distance: parseFloat(result.data.distance),
          actual_time: result.data.duration,
          actual_pace: result.data.pace,
          rpe: formData.rpe,
          comments: formData.comments || `Synced from Strava: ${result.data.name}`,
        })
        alert('✅ Successfully synced with Strava!')
      } else {
        alert(result.error || 'Failed to sync with Strava')
      }
    } catch (error) {
      console.error('Error syncing with Strava:', error)
      alert('Failed to sync with Strava. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  const runTypeColors = {
    'Easy Run': 'bg-easy-100 dark:bg-easy-900/30 border-easy-400 dark:border-easy-700',
    'Tempo Run': 'bg-tempo-100 dark:bg-tempo-900/30 border-tempo-400 dark:border-tempo-700',
    'Quality Run': 'bg-quality-100 dark:bg-quality-900/30 border-quality-400 dark:border-quality-700',
    'Long Run': 'bg-long-100 dark:bg-long-900/30 border-long-400 dark:border-long-700',
  }

  const cardColor = runTypeColors[run.run_type as keyof typeof runTypeColors] || 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'

  return (
    <div
      data-run-id={run.id}
      className={`rounded-xl shadow-lg p-6 border-2 ${cardColor} transition-all hover:shadow-xl`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {run.run_type}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Week {run.week_number} • {run.day_of_week}
          </p>
        </div>
        {run.completed ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <Circle className="w-6 h-6 text-slate-400" />
        )}
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-medium">
          {format(new Date(run.scheduled_date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            <strong>{run.planned_distance}km</strong>
            {run.session_type && ` • ${run.session_type}`}
          </span>
        </div>
        {run.target_pace && (
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Target: <strong>{run.target_pace}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      {run.notes && (
        <div className="mb-4 p-3 bg-white/50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-slate-600 dark:text-slate-400 mt-0.5" />
            <p className="text-sm text-slate-700 dark:text-slate-300">{run.notes}</p>
          </div>
        </div>
      )}

      {/* Log Run Section */}
      {!run.completed && (
        <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-600">
          {!isLogging ? (
            <button
              onClick={() => setIsLogging(true)}
              aria-label="Log this run"
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
            >
              Log Run
            </button>
          ) : (
            <div className="space-y-3">
              {/* Sync with Strava Button */}
              <button
                onClick={handleSyncStrava}
                disabled={isSyncing}
                className="w-full px-4 py-2 bg-[#FC4C02] hover:bg-[#E34402] disabled:bg-slate-400 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4" />
                {isSyncing ? 'Syncing...' : 'Sync with Strava'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-slate-800 px-2 text-slate-500 dark:text-slate-400">
                    or enter manually
                  </span>
                </div>
              </div>

              <input
                type="number"
                step="0.1"
                value={formData.actual_distance}
                onChange={(e) => setFormData({ ...formData, actual_distance: parseFloat(e.target.value) })}
                placeholder="Distance (km)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              <input
                type="text"
                value={formData.actual_time}
                onChange={(e) => setFormData({ ...formData, actual_time: e.target.value })}
                placeholder="Time (HH:MM:SS or MM:SS)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              <input
                type="text"
                value={formData.actual_pace}
                onChange={(e) => setFormData({ ...formData, actual_pace: e.target.value })}
                placeholder="Pace (e.g., 5:30/km)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
              <textarea
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Comments (optional - how did it feel?)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleLogRun}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsLogging(false)}
                  className="flex-1 px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed Run Info */}
      {run.completed && (
        <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-600">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <strong>Completed:</strong> {run.actual_distance}km
            {run.actual_time && ` in ${run.actual_time}`}
            {run.actual_pace && ` at ${run.actual_pace}/km`}
          </p>
          {run.comments && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              {run.comments}
            </p>
          )}
          {run.strava_activity_id && (
            <div className="mt-2 flex items-center gap-2 text-xs text-[#FC4C02]">
              <Activity className="w-3 h-3" />
              <span>Linked to Strava</span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowDetailModal(true)}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              View Details
            </button>
            {!run.strava_activity_id && (
              <button
                onClick={() => setShowLinkModal(true)}
                className="px-4 py-2 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Link className="w-4 h-4" />
                Link Strava
              </button>
            )}
          </div>
        </div>
      )}

      {/* Run Detail Modal */}
      <RunDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        runId={run.id}
        userId={userId}
      />

      {/* Link Strava Modal */}
      <LinkStravaModal
        runId={run.id}
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLinked={() => window.location.reload()}
      />
    </div>
  )
}

