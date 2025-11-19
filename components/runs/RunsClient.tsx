'use client'

import { useState } from 'react'
import { Run } from '@/lib/types/database'
import RunCard from './RunCard'
import AddRunModal from './AddRunModal'
import EditRunModal from './EditRunModal'
import FeaturedRunCard from './FeaturedRunCard'
import CalendarView from './CalendarView'
import BestPerformances from './BestPerformances'
import { Calendar, Filter, Plus } from 'lucide-react'
import { format, isAfter, isBefore, startOfDay } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

interface RunsClientProps {
  runs: Run[]
  userId: string
}

export default function RunsClient({ runs, userId }: RunsClientProps) {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all')
  const [editingRun, setEditingRun] = useState<Run | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const today = startOfDay(new Date())

  const filteredRuns = runs.filter(run => {
    // Week filter
    if (selectedWeek !== 'all' && run.week_number !== selectedWeek) {
      return false
    }

    // Status filter
    if (filter === 'upcoming') {
      return !run.completed  // Show all non-completed runs as upcoming
    } else if (filter === 'completed') {
      return run.completed
    }
    return true
  })

  const weeks = Array.from(new Set(runs.map(r => r.week_number))).sort((a, b) => a - b)

  // Get next upcoming run for featured card
  const nextUpcomingRun = runs
    .filter(run => !run.completed)
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              <Calendar className="w-10 h-10 text-primary-600" />
              Training Runs
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Track and log your training runs
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Run
          </button>
        </div>

        {/* Best Performances Section */}
        {filter === 'all' && (
          <div className="mb-8">
            <BestPerformances userId={userId} />
          </div>
        )}

        {/* Featured Upcoming Run */}
        {nextUpcomingRun && filter === 'upcoming' && (
          <div className="mb-8">
            <FeaturedRunCard run={nextUpcomingRun} />
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === 'upcoming'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === 'completed'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Weeks</option>
              {weeks.map(week => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calendar View for Upcoming, List View for Completed/All */}
        {filter === 'upcoming' ? (
          <CalendarView
            runs={filteredRuns}
            onRunClick={(run) => setEditingRun(run)}
          />
        ) : (
          /* Runs Grid for Completed/All */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRuns.map(run => (
              <RunCard key={run.id} run={run} userId={userId} />
            ))}
          </div>
        )}

        {filteredRuns.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              No runs found for the selected filters
            </p>
          </div>
        )}
      </div>

      {/* Add Run Modal */}
      <AddRunModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        userId={userId}
      />

      {/* Edit Run Modal */}
      {editingRun && (
        <EditRunModal
          run={editingRun}
          isOpen={!!editingRun}
          onClose={() => setEditingRun(null)}
          onUpdate={() => {
            setRefreshKey(prev => prev + 1)
            window.location.reload() // Refresh the page to show updated data
          }}
        />
      )}
    </div>
  )
}

