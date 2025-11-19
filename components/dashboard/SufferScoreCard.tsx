'use client'

import { StravaActivity } from '@/lib/types/database'
import { Activity } from 'lucide-react'
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

interface SufferScoreCardProps {
  stravaActivities: StravaActivity[]
}

export default function SufferScoreCard({ stravaActivities }: SufferScoreCardProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })

  const weeklySufferScore = stravaActivities
    .filter(activity => {
      if (!activity.start_date) return false
      const activityDate = new Date(activity.start_date)
      return isWithinInterval(activityDate, { start: weekStart, end: weekEnd })
    })
    .reduce((sum, activity) => sum + (activity.suffer_score || 0), 0)

  const weeklyActivities = stravaActivities.filter(activity => {
    if (!activity.start_date) return false
    const activityDate = new Date(activity.start_date)
    return isWithinInterval(activityDate, { start: weekStart, end: weekEnd })
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Activity className="w-6 h-6 text-orange-500" />
        Weekly Suffer Score
      </h2>

      <div className="text-center mb-6">
        <p className="text-6xl font-bold text-orange-600 dark:text-orange-400">
          {weeklySufferScore}
        </p>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          From {weeklyActivities.length} activities this week
        </p>
      </div>

      {weeklyActivities.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Recent Activities
          </h3>
          {weeklyActivities.slice(0, 3).map(activity => (
            <div key={activity.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700 rounded">
              <p className="text-sm text-slate-900 dark:text-white truncate">
                {activity.name || 'Run'}
              </p>
              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                {activity.suffer_score || 0}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

