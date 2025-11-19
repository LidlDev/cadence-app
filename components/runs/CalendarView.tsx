'use client'

import { Run } from '@/lib/types/database'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek
} from 'date-fns'

interface CalendarViewProps {
  runs: Run[]
  onRunClick?: (run: Run) => void
}

export default function CalendarView({ runs, onRunClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getRunsForDay = (day: Date) => {
    return runs.filter(run => 
      isSameDay(new Date(run.scheduled_date + 'T00:00:00'), day)
    )
  }

  const runTypeColors = {
    'Easy Run': 'bg-easy-50 dark:bg-easy-900/20 border-l-4 border-easy-500 text-easy-700 dark:text-easy-300',
    'Tempo Run': 'bg-tempo-50 dark:bg-tempo-900/20 border-l-4 border-tempo-500 text-tempo-700 dark:text-tempo-300',
    'Quality Run': 'bg-quality-50 dark:bg-quality-900/20 border-l-4 border-quality-500 text-quality-700 dark:text-quality-300',
    'Long Run': 'bg-long-50 dark:bg-long-900/20 border-l-4 border-long-500 text-long-700 dark:text-long-300',
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-semibold text-slate-600 dark:text-slate-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayRuns = getRunsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())

          return (
            <div
              key={day.toString()}
              className={`min-h-24 p-2 rounded-lg border ${
                isCurrentMonth
                  ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                  : 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
              } ${isToday ? 'ring-2 ring-primary-500' : ''}`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isCurrentMonth 
                  ? 'text-slate-900 dark:text-white' 
                  : 'text-slate-400 dark:text-slate-500'
              } ${isToday ? 'text-primary-600 dark:text-primary-400 font-bold' : ''}`}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayRuns.map(run => (
                  <button
                    key={run.id}
                    onClick={() => onRunClick?.(run)}
                    className={`w-full text-left px-2 py-1 rounded text-xs font-medium border ${
                      runTypeColors[run.run_type as keyof typeof runTypeColors]
                    } ${run.completed ? 'opacity-60' : ''} hover:opacity-80 transition-opacity`}
                  >
                    <div className="truncate">{run.run_type.replace(' Run', '')}</div>
                    <div className="truncate text-xs opacity-75">
                      {run.planned_distance ? `${run.planned_distance}km` : 'Varies'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-easy-400 dark:bg-easy-600" />
          <span className="text-slate-600 dark:text-slate-400">Easy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-tempo-400 dark:bg-tempo-600" />
          <span className="text-slate-600 dark:text-slate-400">Tempo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-quality-400 dark:bg-quality-600" />
          <span className="text-slate-600 dark:text-slate-400">Quality</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-long-400 dark:bg-long-600" />
          <span className="text-slate-600 dark:text-slate-400">Long</span>
        </div>
      </div>
    </div>
  )
}

