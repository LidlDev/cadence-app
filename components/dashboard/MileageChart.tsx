'use client'

import { useState } from 'react'
import { Run, StravaActivity } from '@/lib/types/database'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, parseISO } from 'date-fns'
import { Calendar } from 'lucide-react'

interface MileageChartProps {
  runs: Run[]
  stravaActivities: StravaActivity[]
}

export default function MileageChart({ runs, stravaActivities }: MileageChartProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())

  // Get available months from runs data
  const availableMonths = getAvailableMonths(runs)
  const data = calculateDailyMileage(runs, selectedMonth)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary-600" />
          Cumulative Monthly Mileage
        </h2>
        <select
          value={format(selectedMonth, 'yyyy-MM')}
          onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {availableMonths.map(month => (
            <option key={format(month, 'yyyy-MM')} value={format(month, 'yyyy-MM')}>
              {format(month, 'MMMM yyyy')}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
          <XAxis
            dataKey="day"
            className="text-slate-600 dark:text-slate-400"
          />
          <YAxis
            label={{ value: 'Cumulative Distance (km)', angle: -90, position: 'insideLeft' }}
            className="text-slate-600 dark:text-slate-400"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="planned" stroke="#94a3b8" strokeWidth={2} name="Planned" dot={{ r: 4 }} />
          <Line type="monotone" dataKey="actual" stroke="#ff6f00" strokeWidth={2} name="Actual" dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function getAvailableMonths(runs: Run[]): Date[] {
  if (runs.length === 0) return [new Date()]

  const dates = runs.map(r => new Date(r.scheduled_date))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

  const months: Date[] = []
  let current = startOfMonth(minDate)
  const end = startOfMonth(maxDate)

  while (current <= end) {
    months.push(new Date(current))
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  }

  return months.reverse() // Most recent first
}

function calculateDailyMileage(runs: Run[], month: Date) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  let cumulativePlanned = 0
  let cumulativeActual = 0

  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd')

    const dayRuns = runs.filter(r => {
      const runDate = r.scheduled_date // Already in yyyy-MM-dd format
      return runDate === dayStr
    })

    // Add today's distance to cumulative totals
    const plannedDistance = dayRuns.reduce((sum, r) => sum + (r.planned_distance || 0), 0)
    const actualDistance = dayRuns
      .filter(r => r.completed)
      .reduce((sum, r) => sum + (r.actual_distance || r.planned_distance || 0), 0)

    cumulativePlanned += plannedDistance
    cumulativeActual += actualDistance

    return {
      day: format(day, 'd'),
      planned: Math.round(cumulativePlanned * 10) / 10,
      actual: Math.round(cumulativeActual * 10) / 10,
    }
  })
}

