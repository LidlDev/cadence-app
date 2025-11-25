'use client'

import { Run } from '@/lib/types/database'
import { format } from 'date-fns'
import { 
  Calendar, 
  MapPin, 
  Zap, 
  MessageSquare, 
  Trophy, 
  Activity, 
  Flame, 
  Mountain,
  Timer
} from 'lucide-react'
import { useState } from 'react'

interface FeaturedRunCardProps {
  run: Run
  onLogRun?: () => void
  onReschedule?: () => void
}

export default function FeaturedRunCard({ run, onLogRun, onReschedule }: FeaturedRunCardProps) {

  // Map run types to specific Lucide Icons
  const getRunIcon = (type: string) => {
    switch (type) {
      case 'Tempo Run':
        return <Zap className="w-6 h-6 text-primary-600 dark:text-primary-500" />
      case 'Quality Run':
        return <Flame className="w-6 h-6 text-primary-600 dark:text-primary-500" />
      case 'Long Run':
        return <Mountain className="w-6 h-6 text-primary-600 dark:text-primary-500" />
      case 'Fartlek':
        return <Zap className="w-6 h-6 text-primary-600 dark:text-primary-500" />
      case 'Interval':
        return <Flame className="w-6 h-6 text-primary-600 dark:text-primary-500" />
      case 'Hill Repeats':
        return <Mountain className="w-6 h-6 text-primary-600 dark:text-primary-500" />
      case 'Easy Run':
      default:
        return <Activity className="w-6 h-6 text-primary-600 dark:text-primary-500" />
    }
  }

  const icon = getRunIcon(run.run_type)

  // Use target_pace from DB
  const rawPace = run.target_pace

  const displayPace = rawPace
    ? (rawPace.toString().includes(':') || rawPace.toString().includes('/'))
      ? rawPace
      : `${rawPace} min/km`
    : 'N/A'

  const handleLogRun = () => {
    if (onLogRun) {
      onLogRun()
    }
  }

  const handleReschedule = () => {
    if (onReschedule) {
      onReschedule()
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all">
      
      {/* Subtle Top Accent Border */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 to-primary-600" />

      {/* Content */}
      <div className="relative p-6 sm:p-8">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800/50">
                {icon}
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {run.run_type}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-medium mt-0.5">
                  Week {run.week_number} • {run.day_of_week}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
            Next Up
          </div>
        </div>

        {/* Date Row */}
        <div className="flex items-center gap-2 mb-8 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 px-4 py-2.5 rounded-lg w-fit border border-slate-100 dark:border-slate-700">
          <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-500" />
          <span className="font-semibold">
            {format(new Date(run.scheduled_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Distance Card */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 group hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <MapPin className="w-4 h-4 group-hover:text-primary-600 dark:group-hover:text-primary-500 transition-colors" />
              <p className="text-xs font-bold uppercase tracking-wider">Distance</p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {run.planned_distance ? `${run.planned_distance}` : 'Varies'}
              <span className="text-lg sm:text-xl font-medium text-slate-500 dark:text-slate-500 ml-1">km</span>
            </p>
          </div>

          {/* Pace Card */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700 group hover:border-primary-200 dark:hover:border-primary-800 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <Timer className="w-4 h-4 group-hover:text-primary-600 dark:group-hover:text-primary-500 transition-colors" />
              <p className="text-xs font-bold uppercase tracking-wider">Target Pace</p>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {displayPace.replace(' min/km', '')}
              <span className="text-lg sm:text-xl font-medium text-slate-500 dark:text-slate-500 ml-1">min/km</span>
            </p>
          </div>
        </div>

        {/* Notes Section */}
        {run.notes && (
          <div className="mb-8 p-4 rounded-xl bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/30">
            <div className="flex items-center gap-2 mb-2 text-primary-700 dark:text-primary-400">
              <MessageSquare className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Coach's Notes</p>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
              {run.notes}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button
            onClick={handleLogRun}
            className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-primary-600 hover:bg-primary-700 text-white px-4 sm:px-6 py-3 sm:py-4 font-bold text-base sm:text-lg shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 transition-all"
          >
            <div className="relative flex items-center justify-center gap-1.5 sm:gap-2">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-y-0.5 group-hover:rotate-12" />
              <span className="hidden sm:inline">Log Run</span>
              <span className="sm:hidden">Log</span>
            </div>
          </button>
          <button
            onClick={handleReschedule}
            className="group relative overflow-hidden rounded-lg sm:rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 sm:px-6 py-3 sm:py-4 font-bold text-base sm:text-lg shadow-lg transition-all"
          >
            <div className="relative flex items-center justify-center gap-1.5 sm:gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-y-0.5" />
              <span className="hidden sm:inline">Reschedule</span>
              <span className="sm:hidden">Edit</span>
            </div>
          </button>
        </div>
      </div>

      {/* Subtle Background decoration */}
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-48 h-48 bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />
    </div>
  )
}
