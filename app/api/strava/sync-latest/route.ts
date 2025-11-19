import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Sync the most recent Strava activity
 * This endpoint is called when user clicks "Sync with Strava" button
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at, athlete_id')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Strava not connected. Please connect your Strava account first.' },
        { status: 400 }
      )
    }

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000)
    let accessToken = tokenData.access_token

    if (tokenData.expires_at && tokenData.expires_at < now) {
      // Refresh the token
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      })

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update tokens in database
      await supabase
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: refreshData.expires_at,
        })
        .eq('user_id', user.id)
    }

    // Fetch most recent activities (last 5 to give user options)
    const activitiesResponse = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=5',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!activitiesResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Strava activities' },
        { status: 500 }
      )
    }

    const activities = await activitiesResponse.json()

    if (activities.length === 0) {
      return NextResponse.json({ error: 'No recent activities found' }, { status: 404 })
    }

    // Get the most recent run activity
    const mostRecentRun = activities.find((a: any) => a.type === 'Run')

    if (!mostRecentRun) {
      return NextResponse.json({ error: 'No recent run activities found' }, { status: 404 })
    }

    // Fetch detailed activity data
    const activityResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${mostRecentRun.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    const activity = await activityResponse.json()

    // Fetch activity streams (all available data)
    const streamTypes = [
      'time',
      'distance',
      'latlng',
      'altitude',
      'velocity_smooth',
      'heartrate',
      'cadence',
      'watts',
      'temp',
      'moving',
      'grade_smooth',
    ]

    const streamsResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${mostRecentRun.id}/streams?keys=${streamTypes.join(',')}&key_by_type=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    let streams = {}
    if (streamsResponse.ok) {
      streams = await streamsResponse.json()
    }

    // Format the data for the frontend
    const syncedData = {
      strava_activity_id: activity.id,
      name: activity.name,
      distance: (activity.distance / 1000).toFixed(2), // Convert to km
      duration: formatDuration(activity.moving_time),
      pace: calculatePace(activity.distance, activity.moving_time),
      average_hr: activity.average_heartrate,
      max_hr: activity.max_heartrate,
      average_cadence: activity.average_cadence,
      elevation_gain: activity.total_elevation_gain,
      suffer_score: activity.suffer_score,
      calories: activity.calories,
      start_date: activity.start_date,
      streams: streams,
    }

    return NextResponse.json({ success: true, data: syncedData })
  } catch (error) {
    console.error('Error syncing Strava activity:', error)
    return NextResponse.json({ error: 'Failed to sync activity' }, { status: 500 })
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function calculatePace(distanceMeters: number, timeSeconds: number): string {
  const distanceKm = distanceMeters / 1000
  const paceSecondsPerKm = timeSeconds / distanceKm
  const minutes = Math.floor(paceSecondsPerKm / 60)
  const seconds = Math.floor(paceSecondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

