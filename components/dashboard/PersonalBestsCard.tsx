'use client'

import { useState, useMemo } from 'react'
import { PersonalBest, Run } from '@/lib/types/database'
import { Trophy, Target, Edit2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { calculateVDOTFromRuns, getRacePredictions, timeToSeconds, secondsToTime } from '@/lib/utils/vdot'

interface PersonalBestsCardProps {
  personalBests: PersonalBest[]
  runs?: Run[]
}

export default function PersonalBestsCard({ personalBests, runs = [] }: PersonalBestsCardProps) {
  const currentPBs = personalBests.filter(pb => !pb.is_target)
  const targetPBs = personalBests.filter(pb => pb.is_target)
  
  const [editingPB, setEditingPB] = useState<string | null>(null) // ID or distance string for new targets
  const [editForm, setEditForm] = useState({ time: '', pace: '' })

  // Calculate dynamic targets based on VDOT
  const dynamicTargets = useMemo(() => {
    // Find completed runs with time and distance
    const completedRuns = runs.filter(r => r.completed && r.actual_distance && r.actual_time)
    if (completedRuns.length === 0) return {}

    // Calculate VDOT
    const vdot = calculateVDOTFromRuns(completedRuns.map(r => ({
      actual_distance: r.actual_distance!,
      actual_time: r.actual_time!,
      scheduled_date: r.scheduled_date
    })))

    if (!vdot) return {}

    // Get predictions
    const predictions = getRacePredictions(vdot)
    
    // Format for display
    const targets: Record<string, { time: string, pace: string }> = {}
    
    Object.entries(predictions).forEach(([distance, time]) => {
      const distKm = distance === '5K' ? 5 : distance === '10K' ? 10 : distance === 'Half Marathon' ? 21.0975 : 42.195
      const seconds = timeToSeconds(time)
      const paceSeconds = seconds / distKm
      const pace = secondsToTime(paceSeconds)
      
      targets[distance] = {
        time,
        pace: `${pace}/km`
      }
    })
    
    return targets
  }, [runs])

  const handleEdit = (pb: PersonalBest) => {
    setEditingPB(pb.id)
    setEditForm({ time: pb.time, pace: pb.pace || '' })
  }

  const handleEditTarget = (distance: string, existingTarget?: PersonalBest, predictedTime?: string, predictedPace?: string) => {
    if (existingTarget) {
      setEditingPB(existingTarget.id)
      setEditForm({ time: existingTarget.time, pace: existingTarget.pace || '' })
    } else {
      // Creating a new target
      setEditingPB(distance)
      setEditForm({ 
        time: predictedTime || '', 
        pace: predictedPace || '' 
      })
    }
  }

  const handleSave = async (pbId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('personal_bests')
      .update({
        time: editForm.time,
        pace: editForm.pace || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pbId)

    if (!error) {
      setEditingPB(null)
      window.location.reload()
    }
  }

  const handleSaveTarget = async (idOrDistance: string) => {
    const supabase = createClient()
    
    // Check if it's an existing ID (UUID format) or a distance string
    const isNewTarget = !idOrDistance.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    if (isNewTarget) {
      // Insert new target
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('personal_bests')
        .insert({
          user_id: user.id,
          distance: idOrDistance, // This is the distance string (e.g. "5K")
          distance_unit: 'km', // Default unit
          time: editForm.time,
          pace: editForm.pace || null,
          is_target: true,
          achieved_date: new Date().toISOString().split('T')[0], // Just set today as creation date
        })

      if (!error) {
        setEditingPB(null)
        window.location.reload()
      }
    } else {
      // Update existing
      await handleSave(idOrDistance)
    }
  }

  const targetDistances = ['5K', '10K', 'Half Marathon', 'Marathon']

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary-600" />
        Personal Bests
      </h2>

      <div className="space-y-6">
        {/* Current PBs */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wider">
            Current Records
          </h3>
          {currentPBs.length > 0 ? (
            <div className="space-y-2">
              {currentPBs.map(pb => (
                <div key={pb.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {pb.distance} {pb.distance_unit}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {pb.race_name || 'Training run'}
                    </p>
                  </div>
                  {editingPB === pb.id ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          placeholder="Time"
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-20"
                        />
                        <input
                          type="text"
                          value={editForm.pace}
                          onChange={(e) => setEditForm({ ...editForm, pace: e.target.value })}
                          placeholder="Pace"
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-20"
                        />
                      </div>
                      <button
                        onClick={() => handleSave(pb.id)}
                        className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPB(null)}
                        className="px-3 py-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {pb.time}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {pb.pace}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit(pb)}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center">
              <p className="text-slate-500 dark:text-slate-400 text-sm">No PBs recorded yet</p>
            </div>
          )}
        </div>

        {/* Target PBs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Target className="w-4 h-4" />
              Race Targets
            </h3>
            <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>Dynamic VDOT Predictions</span>
            </div>
          </div>
          
          <div className="space-y-2">
            {targetDistances.map(distance => {
              const existingTarget = targetPBs.find(pb => pb.distance === distance)
              const prediction = dynamicTargets[distance]
              const isEditing = editingPB === (existingTarget?.id || distance)

              return (
                <div key={distance} className={`flex justify-between items-center p-3 rounded-lg border ${
                  existingTarget 
                    ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' 
                    : 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30 border-dashed'
                }`}>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {distance}
                    </p>
                    {!existingTarget && prediction && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                        Based on VDOT
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          placeholder="Time"
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-20"
                        />
                        <input
                          type="text"
                          value={editForm.pace}
                          onChange={(e) => setEditForm({ ...editForm, pace: e.target.value })}
                          placeholder="Pace"
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-20"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveTarget(existingTarget?.id || distance)}
                        className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPB(null)}
                        className="px-3 py-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {existingTarget ? (
                          <>
                            <p className="font-bold text-primary-600 dark:text-primary-400">
                              {existingTarget.time}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {existingTarget.pace}
                            </p>
                          </>
                        ) : prediction ? (
                          <>
                            <p className="font-bold text-purple-600 dark:text-purple-400 opacity-80">
                              {prediction.time}
                            </p>
                            <p className="text-xs text-purple-500 dark:text-purple-400 opacity-80">
                              {prediction.pace}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Set target</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditTarget(distance, existingTarget, prediction?.time, prediction?.pace)}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        title="Edit Target"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
