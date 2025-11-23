'use client'

import { useState, useEffect } from 'react'
import { Run } from '@/lib/types/database'
import { TrendingUp } from 'lucide-react'
import { startOfWeek, endOfWeek, isWithinInterval, format, subWeeks } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { createClient } from '@/lib/supabase/client'

export default function SufferScoreCard() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRuns()
  }, [])

  const fetchRuns = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('runs')
      .select('*')
      .eq('completed', true)
      .not('actual_distance', 'is', null)
      .order('scheduled_date', { ascending: true })

    setRuns(data || [])
    setLoading(false)
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  // Calculate weekly suffer score from runs table
  const weekRuns = runs.filter(run => {
    const runDate = new Date(run.scheduled_date)
    return isWithinInterval(runDate, { start: weekStart, end: weekEnd })
  })

  const weeklySufferScore = weekRuns.reduce((sum, run) => sum + (run.suffer_score || 0), 0)

  // Prepare chart data for last 8 weeks
  const chartData = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })

    // Calculate average RPE for the week
    const weekRuns = runs.filter(run => {
      const runDate = new Date(run.scheduled_date)
      return isWithinInterval(runDate, { start: weekStart, end: weekEnd })
    })

    const avgRPE = weekRuns.length > 0
      ? weekRuns.reduce((sum, run) => sum + (run.rpe || 0), 0) / weekRuns.length
      : 0

    // Calculate total suffer score for the week from runs table
    const weekSufferScore = weekRuns.reduce((sum, run) => sum + (run.suffer_score || 0), 0)

    chartData.push({
      week: format(weekStart, 'MMM d'),
      rpe: parseFloat(avgRPE.toFixed(1)),
      sufferScore: weekSufferScore,
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-orange-500" />
        RPE & Suffer Score Trends
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Current Week Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Weekly Suffer Score</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {weeklySufferScore}
              </p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Avg RPE This Week</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {runs.filter(run => {
                  const runDate = new Date(run.scheduled_date)
                  return isWithinInterval(runDate, { start: weekStart, end: weekEnd })
                }).length > 0
                  ? (runs.filter(run => {
                      const runDate = new Date(run.scheduled_date)
                      return isWithinInterval(runDate, { start: weekStart, end: weekEnd })
                    }).reduce((sum, run) => sum + (run.rpe || 0), 0) /
                    runs.filter(run => {
                      const runDate = new Date(run.scheduled_date)
                      return isWithinInterval(runDate, { start: weekStart, end: weekEnd })
                    }).length).toFixed(1)
                  : '0'}
              </p>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">
              8-Week Trend
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                <XAxis
                  dataKey="week"
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#3b82f6"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'RPE', angle: -90, position: 'insideLeft', style: { fill: '#3b82f6' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f97316"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Suffer Score', angle: 90, position: 'insideRight', style: { fill: '#f97316' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="rpe"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Avg RPE"
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sufferScore"
                  stroke="#f97316"
                  strokeWidth={2}
                  name="Suffer Score"
                  dot={{ fill: '#f97316', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

