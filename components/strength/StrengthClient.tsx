'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { StrengthSession, StrengthTrainingPlan } from '@/lib/types/database'
import StrengthCalendarView from './StrengthCalendarView'
import StrengthSessionCard from './StrengthSessionCard'
import FeaturedStrengthSession from './FeaturedStrengthSession'
import EditStrengthSessionModal from './EditStrengthSessionModal'
import { createClient } from '@/lib/supabase/client'
import { Dumbbell, Filter, Calendar, List, Plus, TrendingUp, Target, Loader2, Sparkles } from 'lucide-react'
import { format, isAfter, isBefore, startOfDay } from 'date-fns'

interface StrengthClientProps {
  sessions: StrengthSession[]
  plan: StrengthTrainingPlan
  userId: string
}

export default function StrengthClient({ sessions, plan, userId }: StrengthClientProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'all'>('upcoming')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [editingSession, setEditingSession] = useState<StrengthSession | null>(null)
  const [extending, setExtending] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)

  const today = startOfDay(new Date())

  const handleExtendPlan = async (weeks: number = 2) => {
    setExtending(true)
    setExtendError(null)

    try {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()

      if (!authSession) {
        throw new Error('Not authenticated')
      }

      // Get active strength plan
      const { data: plan, error: planError } = await supabase
        .from('strength_training_plans')
        .select('*')
        .eq('user_id', authSession.user.id)
        .eq('status', 'active')
        .single()

      if (planError || !plan) {
        throw new Error('No active strength plan found')
      }

      // Get recent sessions for progression context
      const { data: recentSessions } = await supabase
        .from('strength_sessions')
        .select('*, session_exercises:session_exercises(*, exercise:exercises(*))')
        .eq('strength_plan_id', plan.id)
        .order('week_number', { ascending: false })
        .order('scheduled_date', { ascending: false })
        .limit(10)

      if (!recentSessions || recentSessions.length === 0) {
        throw new Error('No existing sessions to build from')
      }

      // Call edge function directly (bypasses Vercel 10s timeout)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const response = await fetch(`${supabaseUrl}/functions/v1/extend-strength-plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          recentSessions,
          weeksToAdd: weeks
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to extend plan')
      }

      router.refresh()
    } catch (error) {
      setExtendError(error instanceof Error ? error.message : 'Failed to extend plan')
    } finally {
      setExtending(false)
    }
  }

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    const sessionDate = startOfDay(new Date(session.scheduled_date + 'T00:00:00'))
    switch (filter) {
      case 'upcoming':
        return !session.completed && !isBefore(sessionDate, today)
      case 'completed':
        return session.completed
      case 'all':
      default:
        return true
    }
  })

  // Get next upcoming session
  const nextSession = sessions
    .filter(s => !s.completed && !isBefore(startOfDay(new Date(s.scheduled_date + 'T00:00:00')), today))
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0]

  // Stats
  const completedCount = sessions.filter(s => s.completed).length
  const totalSessions = sessions.length
  const completionRate = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              <Dumbbell className="w-10 h-10 text-orange-600" />
              Strength Training
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {plan.name} • Week {getCurrentWeek(plan.start_date)} of {plan.weeks}
            </p>
          </div>

          {/* Plan Stats */}
          <div className="flex gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Target className="w-4 h-4" />
                Completed
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {completedCount}/{totalSessions}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <TrendingUp className="w-4 h-4" />
                Progress
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {completionRate}%
              </div>
            </div>
          </div>
        </div>

        {/* Next Session Featured Card */}
        {nextSession && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Next Session
            </h2>
            <FeaturedStrengthSession
              session={nextSession}
              onClick={() => setEditingSession(nextSession)}
            />
          </div>
        )}

        {/* Extend Plan Section */}
        <div className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-500" />
                Extend Your Plan
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                AI will generate more weeks based on your current progression
              </p>
              {extendError && (
                <p className="text-sm text-red-500 mt-2">{extendError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExtendPlan(2)}
                disabled={extending}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {extending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add 2 Weeks
                  </>
                )}
              </button>
              <button
                onClick={() => handleExtendPlan(4)}
                disabled={extending}
                className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Add 4 Weeks
              </button>
            </div>
          </div>
        </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm">
              {(['upcoming', 'completed', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sessions View */}
        {viewMode === 'calendar' ? (
          <StrengthCalendarView
            sessions={filteredSessions}
            onSessionClick={(session) => setEditingSession(session)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map(session => (
              <StrengthSessionCard
                key={session.id}
                session={session}
                onClick={() => setEditingSession(session)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingSession && (
        <EditStrengthSessionModal
          session={editingSession}
          isOpen={!!editingSession}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            setEditingSession(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function getCurrentWeek(startDate: string): number {
  const start = new Date(startDate)
  const now = new Date()
  const diffTime = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDays / 7) + 1)
}

