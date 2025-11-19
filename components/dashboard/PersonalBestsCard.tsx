'use client'

import { useState } from 'react'
import { PersonalBest } from '@/lib/types/database'
import { Trophy, Target, Edit2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PersonalBestsCardProps {
  personalBests: PersonalBest[]
}

export default function PersonalBestsCard({ personalBests }: PersonalBestsCardProps) {
  const currentPBs = personalBests.filter(pb => !pb.is_target)
  const targetPBs = personalBests.filter(pb => pb.is_target)
  const [editingPB, setEditingPB] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ time: '', pace: '' })

  const handleEdit = (pb: PersonalBest) => {
    setEditingPB(pb.id)
    setEditForm({ time: pb.time, pace: pb.pace })
  }

  const handleSave = async (pbId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('personal_bests')
      .update({
        time: editForm.time,
        pace: editForm.pace,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pbId)

    if (!error) {
      setEditingPB(null)
      window.location.reload() // Refresh to show updated data
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-primary-600" />
        Personal Bests
      </h2>

      <div className="space-y-4">
        {/* Current PBs */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Current
          </h3>
          {currentPBs.length > 0 ? (
            <div className="space-y-2">
              {currentPBs.map(pb => (
                <div key={pb.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {pb.distance} {pb.distance_unit}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
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
                          placeholder="Time (HH:MM:SS)"
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-24"
                        />
                        <input
                          type="text"
                          value={editForm.pace}
                          onChange={(e) => setEditForm({ ...editForm, pace: e.target.value })}
                          placeholder="Pace"
                          className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-24"
                        />
                      </div>
                      <button
                        onClick={() => handleSave(pb.id)}
                        className="px-3 py-1 bg-easy-600 hover:bg-easy-700 text-white rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPB(null)}
                        className="px-3 py-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-900 dark:text-white rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-primary-600 dark:text-primary-400">
                          {pb.time}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {pb.pace}
                        </p>
                      </div>
                      <button
                        onClick={() => handleEdit(pb)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                        title="Edit PB"
                      >
                        <Edit2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No PBs recorded yet</p>
          )}
        </div>

        {/* Target PBs */}
        <div>
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Target className="w-4 h-4" />
            Targets
          </h3>
          {targetPBs.length > 0 ? (
            <div className="space-y-2">
              {targetPBs.map(pb => (
                <div key={pb.id} className="flex justify-between items-center p-3 bg-easy-50 dark:bg-easy-900/20 rounded-lg border border-easy-200 dark:border-easy-800">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {pb.distance} {pb.distance_unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-easy-600 dark:text-easy-400">
                      {pb.time}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {pb.pace}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm">No targets set</p>
          )}
        </div>
      </div>
    </div>
  )
}

