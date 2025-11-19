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
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)
    let accessToken = tokenData.access_token

    if (expiresAt < now) {
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

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        console.error('Token refresh failed:', errorText)
        return NextResponse.json(
          { error: 'Failed to refresh Strava token. Please reconnect your Strava account.' },
          { status: 401 }
        )
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update tokens in database
      const newExpiresAt = new Date(refreshData.expires_at * 1000).toISOString()
      await supabase
        .from('strava_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: newExpiresAt,
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
      const errorText = await activitiesResponse.text()
      console.error('Strava API error:', activitiesResponse.status, errorText)
      return NextResponse.json(
        {
          error: 'Failed to fetch Strava activities',
          details: errorText,
          status: activitiesResponse.status
        },
        { status: activitiesResponse.status }
      )
    }

    const activities = await activitiesResponse.json()

    // Filter for runs only and format the data (already sorted by date descending from Strava API)
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
      // Strava API returns newest first by default, but let's ensure it
      .sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

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

