'use client'

import { Run } from '@/lib/types/database'
import { useState, useEffect } from 'react'
import { X, Calendar, MapPin, Clock, Activity, Zap, Link as LinkIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface EditRunModalProps {
  run: Run
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
  onLinkStrava?: () => void
}

export default function EditRunModal({ run, isOpen, onClose, onUpdate, onLinkStrava }: EditRunModalProps) {
  const [formData, setFormData] = useState({
    scheduled_date: run.scheduled_date,
    planned_distance: run.planned_distance?.toString() || '',
    target_pace: run.target_pace || run.planned_pace || '',
    run_type: run.run_type,
    week_number: run.week_number,
    notes: run.notes || '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setFormData({
      scheduled_date: run.scheduled_date,
      planned_distance: run.planned_distance?.toString() || '',
      target_pace: run.target_pace || run.planned_pace || '',
      run_type: run.run_type,
      week_number: run.week_number,
      notes: run.notes || '',
    })
  }, [run])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const supabase = createClient()

      // Parse distance - handle numeric and non-numeric values
      const parsedDistance = formData.planned_distance
        ? (isNaN(parseFloat(formData.planned_distance))
            ? null
            : parseFloat(formData.planned_distance))
        : null

      const { error } = await supabase
        .from('runs')
        .update({
          scheduled_date: formData.scheduled_date,
          planned_distance: parsedDistance,
          target_pace: formData.target_pace || null,
          run_type: formData.run_type,
          week_number: formData.week_number,
          notes: formData.notes || null,
        })
        .eq('id', run.id)

      if (error) throw error

      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error updating run:', error)
      alert('Failed to update run')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this run?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('runs')
        .delete()
        .eq('id', run.id)

      if (error) throw error

      onUpdate()
      onClose()
    } catch (error) {
      console.error('Error deleting run:', error)
      alert('Failed to delete run')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Edit Run
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Scheduled Date
            </label>
            <input
              type="date"
              value={formData.scheduled_date}
              onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {/* Run Type & Week Number Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Activity className="w-4 h-4 inline mr-2" />
                Run Type
              </label>
              <select
                value={formData.run_type}
                onChange={(e) => setFormData({ ...formData, run_type: e.target.value as 'Easy Run' | 'Tempo Run' | 'Quality Run' | 'Long Run' })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="Easy Run">Easy Run</option>
                <option value="Tempo Run">Tempo Run</option>
                <option value="Quality Run">Quality Run</option>
                <option value="Long Run">Long Run</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Week Number
              </label>
              <input
                type="number"
                min="1"
                value={formData.week_number}
                onChange={(e) => setFormData({ ...formData, week_number: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Distance & Pace Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Planned Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.planned_distance}
                onChange={(e) => setFormData({ ...formData, planned_distance: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Zap className="w-4 h-4 inline mr-2" />
                Target Pace
              </label>
              <input
                type="text"
                value={formData.target_pace}
                onChange={(e) => setFormData({ ...formData, target_pace: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. 5:30"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Add any notes about this run..."
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex-1 sm:flex-none text-center"
              >
                Delete Run
              </button>
         
              {!run.strava_activity_id && onLinkStrava && (
                <button
                  type="button"
                  onClick={onLinkStrava}
                  className="px-4 py-2 bg-[#FC4C02] hover:bg-[#E34402] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Link Strava</span>
                </button>
              )}
            </div>
          
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-1 sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
