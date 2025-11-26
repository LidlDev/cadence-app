'use client'

import { StrengthSession } from '@/lib/types/database'
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns'
import { Dumbbell, Clock, Calendar, ChevronRight, Flame, Target, Sparkles } from 'lucide-react'

interface FeaturedStrengthSessionProps {
  session: StrengthSession
  onClick: () => void
}

const SESSION_TYPE_GRADIENTS: { [key: string]: string } = {
  lower_body: 'from-orange-500 to-red-600',
  upper_body: 'from-blue-500 to-indigo-600',
  full_body: 'from-purple-500 to-pink-600',
  core: 'from-green-500 to-emerald-600',
  mobility: 'from-teal-500 to-cyan-600',
  power: 'from-red-500 to-orange-600',
  recovery: 'from-emerald-500 to-teal-600',
}

export default function FeaturedStrengthSession({ session, onClick }: FeaturedStrengthSessionProps) {
  const gradient = SESSION_TYPE_GRADIENTS[session.session_type] || 'from-slate-500 to-slate-600'
  const sessionDate = new Date(session.scheduled_date + 'T00:00:00')

  const getDateLabel = () => {
    if (isToday(sessionDate)) return 'Today'
    if (isTomorrow(sessionDate)) return 'Tomorrow'
    return format(sessionDate, 'EEEE, MMMM d')
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-6 bg-gradient-to-r ${gradient} text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-xl">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-white/80 text-sm font-medium">
              {getDateLabel()}
            </div>
            <h3 className="text-xl font-bold">
              {session.session_name || session.session_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-sm">
          <Clock className="w-4 h-4" />
          {session.estimated_duration} min
        </div>
      </div>

      {session.focus_areas && session.focus_areas.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {session.focus_areas.map((area, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-white/20 rounded-full text-sm capitalize"
            >
              {area}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-white/80 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Week {session.week_number}
          </div>
          <div className="flex items-center gap-1">
            <Target className="w-4 h-4" />
            {session.session_type.replace('_', ' ')}
          </div>
        </div>

        <div className="flex items-center gap-1 font-semibold">
          Start Workout
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* Motivational tagline */}
      <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2 text-white/80 text-sm">
        <Sparkles className="w-4 h-4" />
        <span>Strong legs, strong runs. Let's build power!</span>
      </div>
    </button>
  )
}

