'use client'

import { Run } from '@/lib/types/database'
import { format } from 'date-fns'
import { 
  Calendar, 
  MapPin, 
  Zap, 
  MessageSquare, 
  Trophy, 
  Activity, 
  Flame, 
  Mountain,
  Timer
} from 'lucide-react'
import { useState } from 'react'

interface FeaturedRunCardProps {
  run: Run
  onLogRun?: () => void
}

export default function FeaturedRunCard({ run, onLogRun }: FeaturedRunCardProps) {
  const [isLoggingRun, setIsLoggingRun] = useState(false)

  // Map run types to Lucide Icons
  const getRunIcon = (type: string) => {
    switch (type) {
      case 'Tempo Run':
        return <Zap className="w-6 h-6" />
      case 'Quality Run':
        return <Flame className="w-6 h-6" />
      case 'Long Run':
        return <Mountain className="w-6 h-6" />
      case 'Easy Run':
      default:
        return <Activity className="w-6 h-6" />
    }
  }

  const icon = getRunIcon(run.run_type)

  // Prioritize target_pace from DB (e.g., "6:35"), fallback to planned_pace
  const rawPace = run.target_pace || run.planned_pace
  
  const displayPace = rawPace
    ? (rawPace.toString().includes(':') || rawPace.toString().includes('/'))
      ?qp rawPace
      : `${rawPace} min/km`
    : 'N/A'

  const handleLogRun = async () => {
    setIsLoggingRun(true)

    const runCards = document.querySelectorAll('[data-run-id]')
    const targetCard = Array.from(runCards).find(
      card => card.getAttribute('data-run-id') === run.id
    )

    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const logButton = targetCard.querySelector('button[aria-label="Log this run"]') as HTMLButtonElement
      if (logButton) {
        setTimeout(() => {
          logButton.click()
          setIsLoggingRun(false)
        }, 500)
      } else {
        setIsLoggingRun(false)
      }
    } else {
      setIsLoggingRun(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
      {/* Top Primary Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
      
      {/* Subtle Background Glow - reduced opacity for elegance */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex gap-4">
            {/* Icon Box with Theme Accent */}
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-2xl text-primary-600 dark:text-primary-500 shadow-sm border border-primary-100 dark:border-primary-900/30 flex items-center justify-center h-fit">
              {icon}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{run.run_type}</h2>
              <div className="flex items-center gap-2 mt-1 text-slate-500 dark:text-slate-400 font-medium">
                <span>Week {run.week_number}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>{run.day_of_week}</span>
              </div>
            </div>
          </div>
          
          {/* Next Up Badge - clean/neutral */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Next Up</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2.5 mb-8 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 w-fit px-4 py-2 rounded-full border border-slate-100 dark:border-slate-800">
          <Calendar className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-sm">
            {format(new Date(run.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {/* Stats Grid - Clean neutral background with distinct data */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <MapPin className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Distance</p>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {run.planned_distance ? `${run.planned_distance}` : 'Varies'} 
              <span className="text-lg font-medium text-slate-500 dark:text-slate-400 ml-1">km</span>
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <Timer className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Target Pace</p>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{displayPace}</p>
          </div>
        </div>

        {/* Notes */}
        {run.notes && (
          <div className="mb-8 p-4 rounded-xl bg-primary-50/50 dark:bg-slate-800/50 border border-primary-100 dark:border-slate-700/50">
            <div className="flex items-center gap-2 mb-2 text-primary-700 dark:text-primary-400">
              <MessageSquare className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Notes</p>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">{run.notes}</p>
          </div>
        )}

        {/* Action Button - The main "Pop" of color */}
        <button
          onClick={handleLogRun}
          disabled={isLoggingRun}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/30 transform active:scale-[0.99]"
        >
          <Trophy className="w-5 h-5" />
          {isLoggingRun ? 'Opening...' : 'Log This Run'}
        </button>
      </div>
    </div>
  )
}
