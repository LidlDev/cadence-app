'use client'

import { Run } from '@/lib/types/database'
import { format } from 'date-fns'
import { Calendar, MapPin, Zap, MessageSquare, Trophy } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FeaturedRunCardProps {
  run: Run
  onLogRun?: () => void
}

export default function FeaturedRunCard({ run, onLogRun }: FeaturedRunCardProps) {
  const [isLoggingRun, setIsLoggingRun] = useState(false)

  const runTypeColors = {
    'Easy Run': 'from-easy-600 to-easy-700 dark:from-easy-500 dark:to-easy-600',
    'Tempo Run': 'from-tempo-600 to-tempo-700 dark:from-tempo-500 dark:to-tempo-600',
    'Quality Run': 'from-quality-600 to-quality-700 dark:from-quality-500 dark:to-quality-600',
    'Long Run': 'from-long-600 to-long-700 dark:from-long-500 dark:to-long-600',
  }

  const runTypeIcons = {
    'Easy Run': '🏃',
    'Tempo Run': '⚡',
    'Quality Run': '🔥',
    'Long Run': '🎯',
  }

  const gradient = runTypeColors[run.run_type as keyof typeof runTypeColors] || 'from-primary-600 to-primary-700 dark:from-primary-500 dark:to-primary-600'
  const icon = runTypeIcons[run.run_type as keyof typeof runTypeIcons] || '🏃'

  // Parse pace - handle both "min/km" format and plain numbers
  const displayPace = run.planned_pace
    ? (run.planned_pace.toString().includes(':') || run.planned_pace.toString().includes('/'))
      ? run.planned_pace
      : `${run.planned_pace} min/km`
    : 'N/A'

  const handleLogRun = async () => {
    setIsLoggingRun(true)

    // Scroll to the run card to trigger the log run form
    const runCards = document.querySelectorAll('[data-run-id]')
    const targetCard = Array.from(runCards).find(
      card => card.getAttribute('data-run-id') === run.id
    )

    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Trigger click on the log run button
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
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Content */}
      <div className="relative p-8 text-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-4xl">{icon}</span>
              <h2 className="text-3xl font-bold drop-shadow-lg">{run.run_type}</h2>
            </div>
            <p className="text-white/90 text-lg drop-shadow">
              Week {run.week_number} • {run.day_of_week}
            </p>
          </div>
          <div className="bg-white/30 dark:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-sm font-medium drop-shadow">Next Up</p>
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 mb-6 text-lg">
          <Calendar className="w-5 h-5 drop-shadow" />
          <span className="font-semibold drop-shadow">
            {format(new Date(run.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 drop-shadow" />
              <p className="text-sm font-medium drop-shadow">Distance</p>
            </div>
            <p className="text-3xl font-bold drop-shadow-lg">{run.planned_distance} km</p>
          </div>

          <div className="bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 drop-shadow" />
              <p className="text-sm font-medium drop-shadow">Target Pace</p>
            </div>
            <p className="text-3xl font-bold drop-shadow-lg">{displayPace}</p>
          </div>
        </div>

        {/* Notes */}
        {run.notes && (
          <div className="bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 drop-shadow" />
              <p className="text-sm font-medium drop-shadow">Notes</p>
            </div>
            <p className="drop-shadow">{run.notes}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6">
          <button
            onClick={handleLogRun}
            disabled={isLoggingRun}
            className="w-full bg-white text-slate-900 hover:bg-white/90 disabled:bg-white/70 px-6 py-3 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Trophy className="w-5 h-5" />
            {isLoggingRun ? 'Opening...' : 'Log This Run'}
          </button>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full -translate-y-32 translate-x-32" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 dark:bg-white/5 rounded-full translate-y-24 -translate-x-24" />
    </div>
  )
}

