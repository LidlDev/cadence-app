import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateBestPerformances } from '@/lib/utils/update-best-performances'

// Webhook verification (GET)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const VERIFY_TOKEN = 'CADENCE_STRAVA_WEBHOOK'

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// Webhook events (POST)
export async function POST(request: NextRequest) {
  try {
    const event = await request.json()

    // Handle activity events
    if (event.object_type === 'activity' && event.aspect_type === 'create') {
      await handleNewActivity(event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleNewActivity(event: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find user by athlete ID
  const { data: tokenData } = await supabase
    .from('strava_tokens')
    .select('user_id, access_token')
    .eq('athlete_id', event.owner_id)
    .single()

  if (!tokenData) return

  // Fetch activity details from Strava
  const activityResponse = await fetch(
    `https://www.strava.com/api/v3/activities/${event.object_id}`,
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }
  )

  const activity = await activityResponse.json()

  // Save to database
  await supabase.from('strava_activities').upsert({
    user_id: tokenData.user_id,
    strava_id: activity.id,
    name: activity.name,
    type: activity.type,
    distance: activity.distance,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    total_elevation_gain: activity.total_elevation_gain,
    start_date: activity.start_date,
    average_speed: activity.average_speed,
    max_speed: activity.max_speed,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    suffer_score: activity.suffer_score,
    calories: activity.calories,
    raw_data: activity,
  })

  // Try to match with planned run
  const runDate = new Date(activity.start_date).toISOString().split('T')[0]
  const distanceKm = activity.distance / 1000
  const movingTimeSeconds = activity.moving_time
  const paceSeconds = movingTimeSeconds / distanceKm
  const paceMinutes = Math.floor(paceSeconds / 60)
  const paceSecondsRemainder = Math.floor(paceSeconds % 60)
  const pace = `${paceMinutes}:${paceSecondsRemainder.toString().padStart(2, '0')}`
  const timeFormatted = `${Math.floor(movingTimeSeconds / 3600)}:${Math.floor((movingTimeSeconds % 3600) / 60).toString().padStart(2, '0')}:${(movingTimeSeconds % 60).toString().padStart(2, '0')}`

  const { data: updatedRuns } = await supabase
    .from('runs')
    .update({
      completed: true,
      actual_distance: distanceKm,
      actual_time: timeFormatted,
      actual_pace: pace,
      strava_activity_id: activity.id,
    })
    .eq('user_id', tokenData.user_id)
    .eq('scheduled_date', runDate)
    .eq('completed', false)
    .select('id')

  // Update best performances if a run was matched
  if (updatedRuns && updatedRuns.length > 0) {
    await updateBestPerformances(
      supabase,
      tokenData.user_id,
      updatedRuns[0].id,
      distanceKm,
      timeFormatted,
      pace,
      runDate
    )
  }
}

