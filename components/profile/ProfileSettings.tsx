'use client'

import { useState } from 'react'
import { User, Heart, Activity, Target, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types/database'
import Toast from '@/components/ui/Toast'

interface ProfileSettingsProps {
  profile: Profile
  onUpdate: () => void
}

export default function ProfileSettings({ profile, onUpdate }: ProfileSettingsProps) {
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    age: profile?.age || '',
    gender: profile?.gender || '',
    weight_kg: profile?.weight_kg || '',
    height_cm: profile?.height_cm || '',
    max_heart_rate: profile?.max_heart_rate || '',
    resting_heart_rate: profile?.resting_heart_rate || '',
    hr_zone_1_max: profile?.hr_zone_1_max || '',
    hr_zone_2_max: profile?.hr_zone_2_max || '',
    hr_zone_3_max: profile?.hr_zone_3_max || '',
    hr_zone_4_max: profile?.hr_zone_4_max || '',
    running_experience: profile?.running_experience || '',
    training_goal: profile?.training_goal || '',
    weekly_mileage_target: profile?.weekly_mileage_target || '',
    preferred_units: profile?.preferred_units || 'metric',
  })

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Auto-calculate HR zones when max HR changes
  const calculateHRZones = (maxHR: number) => {
    setFormData(prev => ({
      ...prev,
      hr_zone_1_max: Math.round(maxHR * 0.60).toString(),
      hr_zone_2_max: Math.round(maxHR * 0.70).toString(),
      hr_zone_3_max: Math.round(maxHR * 0.80).toString(),
      hr_zone_4_max: Math.round(maxHR * 0.90).toString(),
    }))
  }

  // Auto-calculate max HR from age
  const calculateMaxHRFromAge = (age: number) => {
    const maxHR = 220 - age
    setFormData(prev => ({ ...prev, max_heart_rate: maxHR.toString() }))
    calculateHRZones(maxHR)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Auto-calculate zones when max HR changes
    if (name === 'max_heart_rate' && value) {
      calculateHRZones(parseInt(value))
    }

    // Auto-calculate max HR when age changes
    if (name === 'age' && value && !formData.max_heart_rate) {
      calculateMaxHRFromAge(parseInt(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const supabase = createClient()

      // Convert empty strings to null for numeric fields
      const updateData: any = {
        full_name: formData.full_name || null,
        age: formData.age ? parseInt(formData.age as string) : null,
        gender: formData.gender || null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg as string) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm as string) : null,
        max_heart_rate: formData.max_heart_rate ? parseInt(formData.max_heart_rate as string) : null,
        resting_heart_rate: formData.resting_heart_rate ? parseInt(formData.resting_heart_rate as string) : null,
        hr_zone_1_max: formData.hr_zone_1_max ? parseInt(formData.hr_zone_1_max as string) : null,
        hr_zone_2_max: formData.hr_zone_2_max ? parseInt(formData.hr_zone_2_max as string) : null,
        hr_zone_3_max: formData.hr_zone_3_max ? parseInt(formData.hr_zone_3_max as string) : null,
        hr_zone_4_max: formData.hr_zone_4_max ? parseInt(formData.hr_zone_4_max as string) : null,
        running_experience: formData.running_experience || null,
        training_goal: formData.training_goal || null,
        weekly_mileage_target: formData.weekly_mileage_target ? parseFloat(formData.weekly_mileage_target as string) : null,
        preferred_units: formData.preferred_units,
        updated_at: new Date().toISOString(),
      }

      // Check if HR zones were updated
      const hrZonesChanged =
        updateData.hr_zone_1_max !== profile.hr_zone_1_max ||
        updateData.hr_zone_2_max !== profile.hr_zone_2_max ||
        updateData.hr_zone_3_max !== profile.hr_zone_3_max ||
        updateData.hr_zone_4_max !== profile.hr_zone_4_max ||
        updateData.max_heart_rate !== profile.max_heart_rate

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (error) throw error

      // If HR zones changed, recalculate all existing runs
      if (hrZonesChanged) {
        setToast({ message: 'Profile updated! Recalculating HR zones for all runs...', type: 'success' })

        try {
          const recalcResponse = await fetch('/api/runs/recalculate-hr-zones', {
            method: 'POST',
          })

          const recalcResult = await recalcResponse.json()

          console.log('Recalculation result:', recalcResult)

          if (recalcResponse.ok && recalcResult.success) {
            const errorMsg = recalcResult.errors && recalcResult.errors.length > 0
              ? ` (${recalcResult.errors.length} errors - check console)`
              : ''
            setToast({
              message: `Profile updated! ${recalcResult.recalculated}/${recalcResult.total} run(s) recalculated${errorMsg}.`,
              type: recalcResult.errors && recalcResult.errors.length > 0 ? 'error' : 'success'
            })
            if (recalcResult.errors) {
              console.error('Recalculation errors:', recalcResult.errors)
            }
          } else {
            console.error('Recalculation failed:', recalcResult)
            setToast({
              message: `Profile updated, but recalculation failed: ${recalcResult.error || 'Unknown error'}`,
              type: 'error'
            })
          }
        } catch (recalcError) {
          console.error('Error triggering recalculation:', recalcError)
          setToast({
            message: 'Profile updated, but failed to recalculate HR zones. Check console for details.',
            type: 'error'
          })
        }
      } else {
        setToast({ message: 'Profile updated successfully!', type: 'success' })
      }

      setTimeout(() => {
        onUpdate()
      }, 2000)
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setToast({ message: error.message || 'Failed to update profile', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <User className="w-6 h-6 text-[#FF6F00]" />
        Profile Settings
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Age
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="30"
                min="10"
                max="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Gender
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                name="weight_kg"
                value={formData.weight_kg}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="70.5"
                step="0.1"
                min="30"
                max="200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Height (cm)
              </label>
              <input
                type="number"
                name="height_cm"
                value={formData.height_cm}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="175.0"
                step="0.1"
                min="100"
                max="250"
              />
            </div>
          </div>
        </div>

        {/* Heart Rate Configuration */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-600" />
            Heart Rate Zones
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Set your max HR and we'll calculate your zones, or customize each zone manually.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Max Heart Rate (bpm)
              </label>
              <input
                type="number"
                name="max_heart_rate"
                value={formData.max_heart_rate}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="190"
                min="100"
                max="220"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Estimated: {formData.age ? 220 - parseInt(formData.age as string) : 'Enter age first'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Resting Heart Rate (bpm)
              </label>
              <input
                type="number"
                name="resting_heart_rate"
                value={formData.resting_heart_rate}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="55"
                min="30"
                max="100"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Zone 1 Max (Recovery)
              </label>
              <input
                type="number"
                name="hr_zone_1_max"
                value={formData.hr_zone_1_max}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="114"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">&lt;60% max</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Zone 2 Max (Aerobic)
              </label>
              <input
                type="number"
                name="hr_zone_2_max"
                value={formData.hr_zone_2_max}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="133"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">60-70%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Zone 3 Max (Tempo)
              </label>
              <input
                type="number"
                name="hr_zone_3_max"
                value={formData.hr_zone_3_max}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="152"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">70-80%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Zone 4 Max (Threshold)
              </label>
              <input
                type="number"
                name="hr_zone_4_max"
                value={formData.hr_zone_4_max}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="171"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">80-90%</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Zone 5 (Max) is anything above Zone 4 max (&gt;90% max HR)
          </p>
        </div>

        {/* Training Preferences */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#FF6F00]" />
            Training Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Running Experience
              </label>
              <select
                name="running_experience"
                value={formData.running_experience}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="elite">Elite</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Weekly Mileage Target (km)
              </label>
              <input
                type="number"
                name="weekly_mileage_target"
                value={formData.weekly_mileage_target}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="50.0"
                step="0.1"
                min="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Training Goal
              </label>
              <textarea
                name="training_goal"
                value={formData.training_goal}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
                placeholder="e.g., Sub-3 hour marathon, improve 5K time, build base fitness..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Preferred Units
              </label>
              <select
                name="preferred_units"
                value={formData.preferred_units}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#FF6F00] focus:border-transparent"
              >
                <option value="metric">Metric (km, kg)</option>
                <option value="imperial">Imperial (miles, lbs)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#FF6F00] hover:bg-[#E66300] disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isOpen={!!toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
