import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Fetch user's Strava activities with caching
 * Returns a list of recent activities that can be linked to runs
 */
export async function GET(request: NextRequest) {
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
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Strava not connected' },
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

    // Fetch recent activities (last 30 days, max 50 activities)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`,
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

    // Filter for runs only and format the data
    const runs = activities
      .filter((a: any) => a.type === 'Run')
      .map((activity: any) => ({
        id: activity.id,
        name: activity.name,
        distance: (activity.distance / 1000).toFixed(2), // km
        duration: formatDuration(activity.moving_time),
        pace: calculatePace(activity.distance, activity.moving_time),
        start_date: activity.start_date,
        average_hr: activity.average_heartrate,
        max_hr: activity.max_heartrate,
        elevation_gain: activity.total_elevation_gain,
        suffer_score: activity.suffer_score,
      }))

    return NextResponse.json({ success: true, activities: runs })
  } catch (error) {
    console.error('Error fetching Strava activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
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

