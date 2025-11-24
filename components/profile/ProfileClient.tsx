'use client'

import { useState } from 'react'
import { User, Activity, Link as LinkIcon, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import ProfileSettings from './ProfileSettings'
import { createClient } from '@/lib/supabase/client'

interface ProfileClientProps {
  user: any
  profile: any
  stravaConnected: boolean
  stravaAthlete?: number
}

export default function ProfileClient({ user, profile, stravaConnected, stravaAthlete }: ProfileClientProps) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<any>(null)

  const handleStravaConnect = () => {
    setConnecting(true)
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '185798'
    const redirectUri = `${window.location.origin}/api/strava/callback`
    const scope = 'read,activity:read_all,profile:read_all'

    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`

    window.location.href = authUrl
  }

  const handleStravaDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Strava?')) {
      try {
        const response = await fetch('/api/strava/disconnect', {
          method: 'POST',
        })

        if (response.ok) {
          window.location.reload()
        }
      } catch (error) {
        console.error('Error disconnecting Strava:', error)
      }
    }
  }

  const handleRefreshAllRuns = async () => {
    if (!confirm('This will re-sync all your Strava-linked runs to populate missing data. This may take a few minutes. Continue?')) {
      return
    }

    setRefreshing(true)
    setRefreshResult(null)

    try {
      const supabase = createClient()

      // Get the session to pass the JWT token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setRefreshResult({
          success: false,
          message: 'Not authenticated',
        })
        return
      }

      // Call Supabase Edge Function instead of Vercel API route
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/refresh-strava-runs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const data = await response.json()

      if (response.ok) {
        setRefreshResult({
          success: true,
          message: data.message,
          total: data.total,
          updated: data.updated,
          failed: data.failed,
        })
      } else {
        setRefreshResult({
          success: false,
          message: data.error || 'Failed to refresh runs',
        })
      }
    } catch (error) {
      console.error('Error refreshing runs:', error)
      setRefreshResult({
        success: false,
        message: 'An error occurred while refreshing runs',
      })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <User className="w-10 h-10 text-blue-600" />
            Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your account and integrations
          </p>
        </div>

        {/* Profile Settings */}
        <ProfileSettings
          profile={profile}
          onUpdate={() => router.refresh()}
        />

        {/* Account Information Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-6 mt-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Account Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Email</label>
              <p className="text-lg text-slate-900 dark:text-white">{user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Member Since</label>
              <p className="text-lg text-slate-900 dark:text-white">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Strava Integration Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-orange-600" />
              Strava Integration
            </h2>
            {stravaConnected ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Not Connected</span>
              </div>
            )}
          </div>

          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Connect your Strava account to automatically sync your activities and track your training progress.
          </p>

          {stravaConnected ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-green-800 dark:text-green-200 font-medium">
                  ✓ Your Strava account is connected
                </p>
                {stravaAthlete && (
                  <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                    Athlete ID: {stravaAthlete}
                  </p>
                )}
              </div>

              {/* Refresh Result */}
              {refreshResult && (
                <div
                  className={`rounded-lg p-4 ${
                    refreshResult.success
                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <p
                    className={`font-medium ${
                      refreshResult.success
                        ? 'text-blue-800 dark:text-blue-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}
                  >
                    {refreshResult.message}
                  </p>
                  {refreshResult.success && refreshResult.total > 0 && (
                    <p
                      className="text-blue-700 dark:text-blue-300 text-sm mt-1"
                    >
                      Updated {refreshResult.updated} of {refreshResult.total} runs
                      {refreshResult.failed > 0 && ` (${refreshResult.failed} failed)`}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRefreshAllRuns}
                  disabled={refreshing}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh All Strava Data'}
                </button>
                <button
                  onClick={handleStravaDisconnect}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Disconnect Strava
                </button>
                <a
                  href="https://www.strava.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <LinkIcon className="w-5 h-5" />
                  View on Strava
                </a>
              </div>

              {/* Info about refresh */}
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                  🔄 Refresh Strava Data
                </h3>
                <p className="text-amber-800 dark:text-amber-300 text-sm">
                  Use this to re-sync all your Strava-linked runs and populate missing detailed data (heart rate, elevation, cadence, descriptions, etc.).
                  This is useful if you linked runs before we added support for detailed analytics or activity descriptions.
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStravaConnect}
              disabled={connecting}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Activity className="w-5 h-5" />
              {connecting ? 'Connecting...' : 'Connect with Strava'}
            </button>
          )}

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">What you'll get:</h3>
            <ul className="space-y-1 text-blue-800 dark:text-blue-300 text-sm">
              <li>• Automatic activity sync from Strava</li>
              <li>• Match Strava runs to your training plan</li>
              <li>• Import heart rate, pace, and elevation data</li>
              <li>• Track suffer scores and performance metrics</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

