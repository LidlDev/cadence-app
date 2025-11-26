'use client'

import { StrengthSession } from '@/lib/types/database'
import { format } from 'date-fns'
import { Dumbbell, Clock, CheckCircle, Calendar, ChevronRight, Target } from 'lucide-react'

interface StrengthSessionCardProps {
  session: StrengthSession
  onClick: () => void
}

const SESSION_TYPE_CONFIG: { [key: string]: { color: string; bgColor: string; label: string } } = {
  lower_body: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Lower Body' },
  upper_body: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Upper Body' },
  full_body: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Full Body' },
  core: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Core' },
  mobility: { color: 'text-teal-600', bgColor: 'bg-teal-100 dark:bg-teal-900/30', label: 'Mobility' },
  power: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Power' },
  recovery: { color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Recovery' },
}

export default function StrengthSessionCard({ session, onClick }: StrengthSessionCardProps) {
  const config = SESSION_TYPE_CONFIG[session.session_type] || 
    { color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-700', label: session.session_type }

  const isPast = new Date(session.scheduled_date) < new Date(new Date().toDateString())

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all p-4 border-l-4 ${
        session.completed 
          ? 'border-green-500 opacity-75' 
          : isPast 
            ? 'border-red-500 opacity-75'
            : 'border-orange-500'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium ${config.bgColor} ${config.color}`}>
          <Dumbbell className="w-4 h-4" />
          {config.label}
        </div>
        {session.completed && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
        {session.session_name || config.label + ' Session'}
      </h3>

      <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {format(new Date(session.scheduled_date + 'T00:00:00'), 'EEE, MMM d')}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {session.actual_duration || session.estimated_duration} min
        </div>
        {session.rpe && (
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            RPE {session.rpe}
          </div>
        )}
      </div>

      {session.focus_areas && session.focus_areas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {session.focus_areas.slice(0, 3).map((area, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs rounded-full capitalize"
            >
              {area}
            </span>
          ))}
          {session.focus_areas.length > 3 && (
            <span className="px-2 py-0.5 text-slate-500 text-xs">
              +{session.focus_areas.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500 dark:text-slate-500">
          Week {session.week_number}
        </span>
        <span className="text-orange-600 dark:text-orange-400 flex items-center gap-1 font-medium">
          View Details
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </button>
  )
}

