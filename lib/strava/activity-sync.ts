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

    const streamsData = await response.json()

    // Strava returns an object keyed by stream type
    // Convert to array and ensure each stream has a 'type' field
    const streams: StravaStream[] = Object.entries(streamsData).map(([key, value]: [string, any]) => ({
      type: key, // Use the key as the type
      data: value.data,
      series_type: value.series_type,
      original_size: value.original_size,
      resolution: value.resolution,
    }))

    return streams
  } catch (error) {
    console.error('Error fetching activity streams:', error)
    return []
  }
}

/**
 * Calculate heart rate zones based on user's custom HR zones or max HR
 * Uses user's actual zone thresholds if available, otherwise falls back to percentages
 */
function calculateHRZones(
  hrData: number[],
  userHRZones: { zone_1_max: number; zone_2_max: number; zone_3_max: number; zone_4_max: number } | null,
  maxHR: number
) {
  const zones = { zone_1: 0, zone_2: 0, zone_3: 0, zone_4: 0, zone_5: 0 }

  // Use user's custom zones if available, otherwise calculate from max HR
  const zone1Max = userHRZones?.zone_1_max || Math.round(maxHR * 0.60)
  const zone2Max = userHRZones?.zone_2_max || Math.round(maxHR * 0.70)
  const zone3Max = userHRZones?.zone_3_max || Math.round(maxHR * 0.80)
  const zone4Max = userHRZones?.zone_4_max || Math.round(maxHR * 0.90)

  hrData.forEach((hr) => {
    if (hr <= zone1Max) zones.zone_1++
    else if (hr <= zone2Max) zones.zone_2++
    else if (hr <= zone3Max) zones.zone_3++
    else if (hr <= zone4Max) zones.zone_4++
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
      // Fetch user's HR zone configuration
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('hr_zone_1_max, hr_zone_2_max, hr_zone_3_max, hr_zone_4_max')
        .eq('id', userId)
        .single()

      const userHRZones = userProfile && userProfile.hr_zone_1_max ? {
        zone_1_max: userProfile.hr_zone_1_max,
        zone_2_max: userProfile.hr_zone_2_max,
        zone_3_max: userProfile.hr_zone_3_max,
        zone_4_max: userProfile.hr_zone_4_max,
      } : null

      const zones = calculateHRZones(hrStream.data as number[], userHRZones, activity.max_heartrate)
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

