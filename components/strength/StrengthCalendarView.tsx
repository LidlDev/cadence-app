'use client'

import { useState } from 'react'
import { StrengthSession } from '@/lib/types/database'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns'
import { ChevronLeft, ChevronRight, Dumbbell, CheckCircle } from 'lucide-react'

interface StrengthCalendarViewProps {
  sessions: StrengthSession[]
  onSessionClick: (session: StrengthSession) => void
}

const SESSION_TYPE_COLORS: { [key: string]: string } = {
  lower_body: 'bg-orange-500',
  upper_body: 'bg-blue-500',
  full_body: 'bg-purple-500',
  core: 'bg-green-500',
  mobility: 'bg-teal-500',
  power: 'bg-red-500',
  recovery: 'bg-emerald-500',
}

export default function StrengthCalendarView({ sessions, onSessionClick }: StrengthCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getSessionsForDay = (day: Date) => {
    return sessions.filter(session => 
      isSameDay(new Date(session.scheduled_date + 'T00:00:00'), day)
    )
  }

  const getSessionColor = (sessionType: string) => {
    return SESSION_TYPE_COLORS[sessionType] || 'bg-slate-500'
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-3 sm:p-6">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
          <div key={day} className="text-center text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 py-1 sm:py-2">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day[0]}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map(day => {
          const daySessions = getSessionsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())

          return (
            <div
              key={day.toString()}
              className={`min-h-16 sm:min-h-24 p-1 sm:p-2 rounded border ${
                isCurrentMonth
                  ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                  : 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
              } ${isToday ? 'ring-1 sm:ring-2 ring-orange-500' : ''}`}
            >
              <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${
                isCurrentMonth
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 dark:text-slate-500'
              } ${isToday ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}`}>
                {format(day, 'd')}
              </div>

              {/* Sessions for the day */}
              <div className="space-y-0.5 sm:space-y-1">
                {daySessions.slice(0, 2).map(session => (
                  <button
                    key={session.id}
                    onClick={() => onSessionClick(session)}
                    className={`w-full text-left px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs text-white truncate ${getSessionColor(session.session_type)} hover:opacity-80 transition-opacity relative`}
                  >
                    <span className="hidden sm:inline">
                      {session.session_name || session.session_type.replace('_', ' ')}
                    </span>
                    <span className="sm:hidden">
                      <Dumbbell className="w-3 h-3 inline" />
                    </span>
                    {session.completed && (
                      <CheckCircle className="w-3 h-3 absolute top-0.5 right-0.5 text-white" />
                    )}
                  </button>
                ))}
                {daySessions.length > 2 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 px-1">
                    +{daySessions.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(SESSION_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded ${color}`} />
              <span className="text-slate-600 dark:text-slate-400 capitalize">
                {type.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

