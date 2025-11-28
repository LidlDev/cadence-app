'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Droplets, Plus, Coffee, GlassWater, Zap, CupSoda } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { HydrationLog } from '@/lib/types/database'

interface HydrationTrackerProps {
  logs: HydrationLog[]
  targetMl: number
  totalMl: number
}

const QUICK_ADD_OPTIONS = [
  { label: 'Glass', amount: 250, icon: GlassWater, beverageType: 'water' as const },
  { label: 'Bottle', amount: 500, icon: Droplets, beverageType: 'water' as const },
  { label: 'Sports', amount: 500, icon: Zap, beverageType: 'sports_drink' as const },
  { label: 'Coffee', amount: 200, icon: Coffee, beverageType: 'coffee' as const },
]

const BEVERAGE_LABELS: Record<string, string> = {
  water: 'Water',
  electrolytes: 'Electrolytes',
  sports_drink: 'Sports Drink',
  coffee: 'Coffee',
  tea: 'Tea',
  other: 'Other',
}

export default function HydrationTracker({ logs, targetMl, totalMl }: HydrationTrackerProps) {
  const router = useRouter()
  const [isLogging, setIsLogging] = useState(false)
  
  const percentComplete = Math.min((totalMl / targetMl) * 100, 100)
  const remaining = Math.max(targetMl - totalMl, 0)

  const handleQuickAdd = async (amount: number, beverageType: string = 'water') => {
    setIsLogging(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('hydration_logs').insert({
        user_id: user.id,
        log_date: new Date().toISOString().split('T')[0],
        amount_ml: amount,
        beverage_type: beverageType,
      })

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error('Error logging hydration:', error)
    } finally {
      setIsLogging(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Hydration</h3>
        </div>
        <span className="text-sm text-blue-700 dark:text-blue-300">
          {(totalMl / 1000).toFixed(1)}L / {(targetMl / 1000).toFixed(1)}L
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Status */}
      <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
        {remaining > 0 
          ? `${(remaining / 1000).toFixed(1)}L remaining to reach your goal`
          : '🎉 Goal reached! Great job staying hydrated!'
        }
      </p>

      {/* Quick Add Buttons */}
      <div className="flex gap-2">
        {QUICK_ADD_OPTIONS.map(option => (
          <button
            key={option.label}
            onClick={() => handleQuickAdd(option.amount, option.beverageType)}
            disabled={isLogging}
            className="flex-1 flex flex-col items-center gap-1 p-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <option.icon className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
              +{option.amount}ml
            </span>
          </button>
        ))}
      </div>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Recent</p>
          <div className="space-y-1">
            {logs.slice(0, 3).map(log => (
              <div key={log.id} className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                <span>{BEVERAGE_LABELS[log.beverage_type] || 'Water'}</span>
                <span>{log.amount_ml}ml</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

