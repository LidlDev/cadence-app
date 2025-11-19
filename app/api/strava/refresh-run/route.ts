import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStravaActivity } from '@/lib/strava/activity-sync'
import { updateBestPerformances } from '@/lib/utils/update-best-performances'

/**
 * Refresh/re-sync a Strava-linked run to populate missing detailed data
 * This is useful for runs that were linked before we added all the detailed fields
 */
export async function POST(request: NextRequest) {
  try {
    const { runId } = await request.json()

    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the run
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .eq('user_id', user.id)
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (!run.strava_activity_id) {
      return NextResponse.json(
        { error: 'Run is not linked to a Strava activity' },
        { status: 400 }
      )
    }

    // Get user's Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
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
        return NextResponse.json(
          { error: 'Failed to refresh Strava token' },
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

    // Delete old streams and HR zones for this run
    await supabase.from('activity_streams').delete().eq('run_id', runId)
    await supabase.from('activity_heart_rate_zones').delete().eq('run_id', runId)

    // Re-sync the activity
    const result = await syncStravaActivity(run.strava_activity_id, user.id, accessToken)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Get the full activity data
    const activity = result.activity

    // Calculate pace and format time
    const distanceKm = activity.distance / 1000
    const timeSeconds = activity.moving_time
    const paceSecondsPerKm = timeSeconds / distanceKm
    const paceMinutes = Math.floor(paceSecondsPerKm / 60)
    const paceSeconds = Math.floor(paceSecondsPerKm % 60)
    const pace = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`

    const hours = Math.floor(timeSeconds / 3600)
    const minutes = Math.floor((timeSeconds % 3600) / 60)
    const secs = timeSeconds % 60
    const duration =
      hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${minutes}:${secs.toString().padStart(2, '0')}`

    // Update the run with ALL the detailed Strava data
    const { error: updateError } = await supabase
      .from('runs')
      .update({
        actual_distance: parseFloat(distanceKm.toFixed(2)),
        actual_time: duration,
        actual_pace: pace,
        completed: true,
        // Heart rate data
        average_hr: activity.average_heartrate || null,
        max_hr: activity.max_heartrate || null,
        // Elevation data
        elevation_gain: activity.total_elevation_gain || null,
        // Cadence data
        average_cadence: activity.average_cadence || null,
        // Power data
        average_watts: activity.average_watts || null,
        // Calories
        calories: activity.calories || null,
        // Suffer score
        suffer_score: activity.suffer_score || null,
        // Time data
        moving_time: activity.moving_time || null,
        elapsed_time: activity.elapsed_time || null,
        // Speed data
        average_speed: activity.average_speed || null,
        max_speed: activity.max_speed || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating run:', updateError)
      return NextResponse.json({ error: 'Failed to update run' }, { status: 500 })
    }

    // Update the activity_streams to link to this run
    await supabase
      .from('activity_streams')
      .update({ run_id: runId })
      .eq('user_id', user.id)
      .is('run_id', null)
      .order('created_at', { ascending: false })
      .limit(20)

    // Update the HR zones to link to this run
    await supabase
      .from('activity_heart_rate_zones')
      .update({ run_id: runId })
      .eq('user_id', user.id)
      .is('run_id', null)
      .order('created_at', { ascending: false })
      .limit(1)

    // Update best performances
    const distance = parseFloat(distanceKm.toFixed(2))
    await updateBestPerformances(
      supabase,
      user.id,
      runId,
      distance,
      duration,
      pace,
      new Date().toISOString().split('T')[0]
    )

    return NextResponse.json({
      success: true,
      message: 'Successfully refreshed Strava data',
    })
  } catch (error) {
    console.error('Error refreshing Strava data:', error)
    return NextResponse.json({ error: 'Failed to refresh Strava data' }, { status: 500 })
  }
}

