/**
 * Strava Activity Sync Utility
 * Fetches detailed activity data including all available streams
 */

import { createClient } from '@supabase/supabase-js'

interface StravaStream {
  type: string
  data: number[] | [number, number][]
  series_type: string
  original_size: number
  resolution: string
}

interface ActivitySyncResult {
  success: boolean
  activityId?: number
  activity?: any
  error?: string
}

/**
 * Fetch all available streams for an activity
 * Streams include: time, distance, latlng, altitude, velocity_smooth, heartrate, cadence, watts, temp, moving, grade_smooth
 */
async function fetchActivityStreams(
  activityId: number,
  accessToken: string
): Promise<StravaStream[]> {
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

  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamTypes.join(',')}&key_by_type=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error('Failed to fetch streams:', response.statusText)
      return []
    }

    const streams = await response.json()
    return Object.values(streams)
  } catch (error) {
    console.error('Error fetching activity streams:', error)
    return []
  }
}

/**
 * Calculate heart rate zones based on max HR
 * Zones: 1 (<60%), 2 (60-70%), 3 (70-80%), 4 (80-90%), 5 (>90%)
 */
function calculateHRZones(hrData: number[], maxHR: number) {
  const zones = { zone_1: 0, zone_2: 0, zone_3: 0, zone_4: 0, zone_5: 0 }

  hrData.forEach((hr) => {
    const percentage = (hr / maxHR) * 100
    if (percentage < 60) zones.zone_1++
    else if (percentage < 70) zones.zone_2++
    else if (percentage < 80) zones.zone_3++
    else if (percentage < 90) zones.zone_4++
    else zones.zone_5++
  })

  return zones
}

/**
 * Sync a Strava activity with full granular data
 */
export async function syncStravaActivity(
  activityId: number,
  userId: string,
  accessToken: string,
  runId?: string // Optional run ID to link streams immediately
): Promise<ActivitySyncResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Fetch detailed activity data
    const activityResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!activityResponse.ok) {
      return { success: false, error: 'Failed to fetch activity details' }
    }

    const activity = await activityResponse.json()

    // 2. Fetch all activity streams
    const streams = await fetchActivityStreams(activityId, accessToken)

    // 3. Store activity streams in database (only if runId is provided)
    if (runId && streams.length > 0) {
      const streamInserts = streams.map((stream) => ({
        user_id: userId,
        run_id: runId,
        stream_type: stream.type,
        data: stream.data,
        original_size: stream.original_size,
        resolution: stream.resolution,
        series_type: stream.series_type,
      }))

      const { error: streamError } = await supabase
        .from('activity_streams')
        .insert(streamInserts)

      if (streamError) {
        console.error('Error inserting activity streams:', streamError)
      }
    }

    // 4. Calculate and store heart rate zones if HR data available (only if runId is provided)
    const hrStream = streams.find((s) => s.type === 'heartrate')
    if (runId && hrStream && activity.max_heartrate) {
      const zones = calculateHRZones(hrStream.data as number[], activity.max_heartrate)
      const hrZones = {
        user_id: userId,
        run_id: runId,
        zone_1_time: zones.zone_1,
        zone_2_time: zones.zone_2,
        zone_3_time: zones.zone_3,
        zone_4_time: zones.zone_4,
        zone_5_time: zones.zone_5,
        average_hr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
        max_hr: activity.max_heartrate ? Math.round(activity.max_heartrate) : null,
      }

      const { error: hrError } = await supabase
        .from('activity_heart_rate_zones')
        .insert(hrZones)

      if (hrError) {
        console.error('Error inserting HR zones:', hrError)
      }
    }

    // 5. Return activity data for further processing
    return {
      success: true,
      activityId: activity.id,
      activity, // Return the full activity object
    }
  } catch (error) {
    console.error('Error syncing Strava activity:', error)
    return { success: false, error: String(error) }
  }
}

