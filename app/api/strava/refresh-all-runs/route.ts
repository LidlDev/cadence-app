import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncStravaActivity } from '@/lib/strava/activity-sync'
import { updateBestPerformances } from '@/lib/utils/update-best-performances'

/**
 * Refresh ALL Strava-linked runs for the current user
 * This will re-sync all runs to populate missing detailed data
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

    // Get all runs with Strava activity IDs
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id, strava_activity_id')
      .eq('user_id', user.id)
      .not('strava_activity_id', 'is', null)

    if (runsError) {
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }

    if (!runs || runs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Strava-linked runs found',
        updated: 0,
      })
    }

    console.log(`Refreshing ${runs.length} Strava-linked runs...`)

    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    // Process each run
    for (const run of runs) {
      try {
        console.log(`Refreshing run ${run.id} (Strava ID: ${run.strava_activity_id})...`)

        // Delete old streams and HR zones for this run
        await supabase.from('activity_streams').delete().eq('run_id', run.id)
        await supabase.from('activity_heart_rate_zones').delete().eq('run_id', run.id)

        // Re-sync the activity with runId to insert streams immediately
        const result = await syncStravaActivity(
          run.strava_activity_id,
          user.id,
          accessToken,
          run.id // Pass run ID so streams are linked immediately
        )

        if (!result.success) {
          errorCount++
          errors.push({ runId: run.id, error: result.error })
          console.error(`Failed to sync run ${run.id}:`, result.error)
          continue
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
        // Convert all numeric values to appropriate types
        const { error: updateError } = await supabase
          .from('runs')
          .update({
            actual_distance: parseFloat(distanceKm.toFixed(2)),
            actual_time: duration,
            actual_pace: pace,
            completed: true,
            // Heart rate - convert to integers
            average_hr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
            max_hr: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
            // Elevation
            elevation_gain: activity.total_elevation_gain ? parseFloat(activity.total_elevation_gain.toFixed(1)) : null,
            // Cadence
            average_cadence: activity.average_cadence ? parseFloat(activity.average_cadence.toFixed(1)) : null,
            // Power
            average_watts: activity.average_watts ? parseFloat(activity.average_watts.toFixed(1)) : null,
            // Calories - convert to integer
            calories: activity.calories ? Math.round(activity.calories) : null,
            // Suffer score - convert to integer
            suffer_score: activity.suffer_score ? Math.round(activity.suffer_score) : null,
            // Time - convert to integers
            moving_time: activity.moving_time ? Math.round(activity.moving_time) : null,
            elapsed_time: activity.elapsed_time ? Math.round(activity.elapsed_time) : null,
            // Speed
            average_speed: activity.average_speed ? parseFloat(activity.average_speed.toFixed(2)) : null,
            max_speed: activity.max_speed ? parseFloat(activity.max_speed.toFixed(2)) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', run.id)
          .eq('user_id', user.id)

        if (updateError) {
          errorCount++
          errors.push({ runId: run.id, error: updateError.message })
          console.error(`Failed to update run ${run.id}:`, updateError)
          continue
        }

        // Streams and HR zones are already linked via syncStravaActivity
        // No need to update them separately

        successCount++
        console.log(`Successfully refreshed run ${run.id}`)

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        errorCount++
        errors.push({ runId: run.id, error: String(error) })
        console.error(`Error processing run ${run.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed ${successCount} of ${runs.length} runs`,
      total: runs.length,
      updated: successCount,
      failed: errorCount,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error refreshing all runs:', error)
    return NextResponse.json(
      { error: 'Failed to refresh runs' },
      { status: 500 }
    )
  }
}

