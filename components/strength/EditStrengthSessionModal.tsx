'use client'

import { useState, useEffect } from 'react'
import { X, Dumbbell, CheckCircle, Clock, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StrengthSession, SessionExercise } from '@/lib/types/database'
import { format } from 'date-fns'

interface EditStrengthSessionModalProps {
  session: StrengthSession
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function EditStrengthSessionModal({ session, isOpen, onClose, onSaved }: EditStrengthSessionModalProps) {
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(session.completed)
  const [rpe, setRpe] = useState(session.rpe || 5)
  const [duration, setDuration] = useState(session.actual_duration || session.estimated_duration)
  const [notes, setNotes] = useState(session.notes || '')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)

  useEffect(() => {
    fetchExercises()
  }, [session.id])

  const fetchExercises = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('session_exercises')
      .select('*, exercise:exercises(*)')
      .eq('session_id', session.id)
      .order('exercise_order', { ascending: true })
    
    setExercises(data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('strength_sessions')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        actual_duration: duration,
        rpe: completed ? rpe : null,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id)

    if (!error) {
      onSaved()
    }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-orange-500 to-red-600 text-white">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">
                {session.session_name || session.session_type.replace('_', ' ')}
              </h2>
              <p className="text-white/80 text-sm">
                {format(new Date(session.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d')} • Week {session.week_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Warmup */}
          {session.warmup_notes && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Warmup</h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">{session.warmup_notes}</p>
            </div>
          )}

          {/* Exercises */}
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-slate-900 dark:text-white">Exercises</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : exercises.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                No exercises found for this session.
              </p>
            ) : (
              exercises.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 font-bold rounded-lg">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {ex.exercise?.name || ex.custom_exercise_name}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {ex.planned_sets} sets × {ex.planned_reps} reps
                          {ex.planned_weight && ` • ${ex.planned_weight}`}
                        </p>
                      </div>
                    </div>
                    {expandedExercise === ex.id ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  
                  {expandedExercise === ex.id && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="border-t border-slate-200 dark:border-slate-600 pt-3">
                        {ex.exercise?.instructions && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            <strong>Instructions:</strong> {ex.exercise.instructions}
                          </p>
                        )}
                        <p className="text-sm text-slate-500">
                          Rest: {ex.planned_rest_seconds}s between sets
                        </p>
                        {ex.notes && (
                          <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                            Note: {ex.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Cooldown */}
          {session.cooldown_notes && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Cooldown</h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm">{session.cooldown_notes}</p>
            </div>
          )}

          {/* Completion Section */}
          <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
            <h3 className="font-semibold text-slate-900 dark:text-white">Session Log</h3>

            {/* Completed Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300">Mark as completed</span>
              <button
                onClick={() => setCompleted(!completed)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  completed ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  completed ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {/* RPE */}
            {completed && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  RPE (Rate of Perceived Exertion): {rpe}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={rpe}
                  onChange={(e) => setRpe(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Easy</span>
                  <span>Moderate</span>
                  <span>Hard</span>
                  <span>Max</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How did the session go? Any adjustments made?"
                className="w-full h-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
