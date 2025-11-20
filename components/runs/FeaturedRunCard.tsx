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

  // Using your brand colors (primary-600 is #FF6F00)
  // We create subtle variations for types, but keep them all within the Orange brand identity
  const runTypeGradients = {
    'Easy Run': 'from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700',
    'Tempo Run': 'from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800',
    'Quality Run': 'from-primary-700 to-primary-900 dark:from-primary-800 dark:to-primary-950',
    'Long Run': 'from-primary-600 via-primary-700 to-primary-800 dark:from-primary-700 dark:via-primary-800 dark:to-primary-900',
  }

  // Map run types to Lucide Icons
  const getRunIcon = (type: string) => {
    switch (type) {
      case 'Tempo Run':
        return <Zap className="w-8 h-8" />
      case 'Quality Run':
        return <Flame className="w-8 h-8" />
      case 'Long Run':
        return <Mountain className="w-8 h-8" />
      case 'Easy Run':
      default:
        return <Activity className="w-8 h-8" />
    }
  }

  const gradient = runTypeGradients[run.run_type as keyof typeof runTypeGradients] || 'from-primary-600 to-primary-700'
  const icon = getRunIcon(run.run_type)

  // Prioritize target_pace from DB (e.g., "6:35"), fallback to planned_pace
  const rawPace = run.target_pace || run.planned_pace
  
  const displayPace = rawPace
    ? (rawPace.toString().includes(':') || rawPace.toString().includes('/'))
      ? rawPace // If it already has format (e.g. 6:35)
      : `${rawPace} min/km` // If it's just a number
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
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      {/* Brand Orange Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Content */}
      <div className="relative p-8 text-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                {icon}
              </span>
              <h2 className="text-3xl font-bold drop-shadow-sm">{run.run_type}</h2>
            </div>
            <p className="text-white/90 text-lg font-medium drop-shadow-sm">
              Week {run.week_number} • {run.day_of_week}
            </p>
          </div>
          <div className="bg-white/25 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
            <p className="text-sm font-bold tracking-wide uppercase drop-shadow-sm">Next Up</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 mb-8 text-lg bg-black/10 w-fit px-4 py-2 rounded-lg backdrop-blur-sm">
          <Calendar className="w-5 h-5" />
          <span className="font-medium">
            {format(new Date(run.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-1 text-white/90">
              <MapPin className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Distance</p>
            </div>
            <p className="text-3xl font-extrabold tracking-tight">
              {run.planned_distance ? `${run.planned_distance} km` : 'Varies'}
            </p>
          </div>

          <div className="bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-xl p-5 border border-white/10">
            <div className="flex items-center gap-2 mb-1 text-white/90">
              <Timer className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Target Pace</p>
            </div>
            <p className="text-3xl font-extrabold tracking-tight">{displayPace}</p>
          </div>
        </div>

        {/* Notes */}
        {run.notes && (
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/5">
            <div className="flex items-center gap-2 mb-2 text-white/90">
              <MessageSquare className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Coach's Notes</p>
            </div>
            <p className="text-white/95 leading-relaxed">{run.notes}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6">
          <button
            onClick={handleLogRun}
            disabled={isLoggingRun}
            className="w-full bg-white text-primary-700 hover:bg-gray-50 disabled:bg-white/70 px-6 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Trophy className="w-5 h-5" />
            {isLoggingRun ? 'Opening...' : 'Log This Run'}
          </button>
        </div>
      </div>

      {/* Decorative Circles - Adjusted for orange theme */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full translate-y-24 -translate-x-24 blur-2xl" />
    </div>
  )
}
