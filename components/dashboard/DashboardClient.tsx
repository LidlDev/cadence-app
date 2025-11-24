'use client'

import { Run, StravaActivity, PersonalBest, TrainingPlan } from '@/lib/types/database'
import MileageChart from './MileageChart'
import PersonalBestsCard from './PersonalBestsCard'
import PredictionsCard from './PredictionsCard'
import SufferScoreCard from './SufferScoreCard'
import AIChat from './AIChat'

interface DashboardClientProps {
  runs: Run[]
  stravaActivities: StravaActivity[]
  personalBests: PersonalBest[]
  trainingPlan: TrainingPlan | null
}

export default function DashboardClient({
  runs,
  stravaActivities,
  personalBests,
  trainingPlan,
}: DashboardClientProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Training Dashboard
          </h1>
          {trainingPlan && (
            <p className="text-slate-600 dark:text-slate-400">
              {trainingPlan.name} • Week {getCurrentWeek(trainingPlan, runs)} of {trainingPlan.weeks}
            </p>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Monthly Mileage Chart */}
          <div className="lg:col-span-2">
            <MileageChart runs={runs} stravaActivities={stravaActivities} />
          </div>

          {/* Personal Bests */}
          <PersonalBestsCard personalBests={personalBests} runs={runs} />

          {/* Performance Predictions */}
          <PredictionsCard />

          {/* Weekly Suffer Score */}
          <SufferScoreCard />

          {/* AI Chat */}
          <div className="lg:col-span-2">
            <AIChat />
          </div>
        </div>
      </div>
    </div>
  )
}

function getCurrentWeek(plan: TrainingPlan, runs: Run[]): number {
  if (!plan) return 1

  // 1. Try to find the next upcoming run (earliest scheduled run that is NOT completed)
  const nextUpcomingRun = runs
    .filter(run => !run.completed)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0]

  if (nextUpcomingRun) {
    return nextUpcomingRun.week_number
  }

  // 2. Fallback: Date-based calculation if no incomplete runs are found
  const today = new Date()
  const startDate = new Date(plan.start_date)

  // Calculate the difference in days
  const diffTime = today.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Week 1 is days 0-6, Week 2 is days 7-13, etc.
  const currentWeek = Math.floor(diffDays / 7) + 1

  // Clamp between 1 and plan.weeks
  return Math.max(1, Math.min(currentWeek, plan.weeks))
}
