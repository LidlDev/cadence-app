'use client'

import { useState, useEffect } from 'react'
import { X, Dumbbell, CheckCircle, Clock, Save, Loader2, ChevronDown, ChevronUp, Plus, Trash2, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StrengthSession, SessionExercise, Exercise } from '@/lib/types/database'
import { format } from 'date-fns'

interface EditStrengthSessionModalProps {
  session: StrengthSession
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function EditStrengthSessionModal({ session, isOpen, onClose, onSaved }: EditStrengthSessionModalProps) {
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(session.completed)
  const [rpe, setRpe] = useState(session.rpe || 5)
  const [duration, setDuration] = useState(session.actual_duration || session.estimated_duration)
  const [notes, setNotes] = useState(session.notes || '')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addingExercise, setAddingExercise] = useState(false)

  useEffect(() => {
    fetchExercises()
    fetchExerciseLibrary()
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

  const fetchExerciseLibrary = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('name', { ascending: true })
    setExerciseLibrary(data || [])
  }

  const handleAddExercise = async (exercise: Exercise | null, customName?: string) => {
    setAddingExercise(true)
    const supabase = createClient()

    const newOrder = exercises.length + 1
    const { data, error } = await supabase
      .from('session_exercises')
      .insert({
        session_id: session.id,
        exercise_id: exercise?.id || null,
        custom_exercise_name: customName || null,
        exercise_order: newOrder,
        planned_sets: 3,
        planned_reps: '10',
        planned_weight: 'moderate',
        planned_rest_seconds: 60
      })
      .select('*, exercise:exercises(*)')
      .single()

    if (!error && data) {
      setExercises([...exercises, data])
    }
    setAddingExercise(false)
    setShowAddExercise(false)
    setSearchQuery('')
  }

  const handleRemoveExercise = async (exerciseId: string) => {
    const supabase = createClient()
    await supabase.from('session_exercises').delete().eq('id', exerciseId)
    setExercises(exercises.filter(e => e.id !== exerciseId))
  }

  const filteredLibrary = exerciseLibrary.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscle_groups?.some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">Exercises</h3>
              <button
                onClick={() => setShowAddExercise(!showAddExercise)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Exercise
              </button>
            </div>

            {/* Add Exercise Panel */}
            {showAddExercise && (
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredLibrary.slice(0, 10).map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => handleAddExercise(ex)}
                      disabled={addingExercise}
                      className="w-full text-left p-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-slate-900 dark:text-white">{ex.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                        {ex.muscle_groups?.join(', ')}
                      </span>
                    </button>
                  ))}
                  {searchQuery && filteredLibrary.length === 0 && (
                    <button
                      onClick={() => handleAddExercise(null, searchQuery)}
                      disabled={addingExercise}
                      className="w-full text-left p-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                    >
                      <span className="text-orange-600 dark:text-orange-400">+ Add "{searchQuery}" as custom exercise</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : exercises.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-4">
                No exercises found. Add some above!
              </p>
            ) : (
              exercises.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden group"
                >
                  <div className="flex items-center">
                    <button
                      onClick={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                      className="flex-1 flex items-center justify-between p-4 text-left"
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
                    <button
                      onClick={() => handleRemoveExercise(ex.id)}
                      className="p-2 mr-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove exercise"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

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
