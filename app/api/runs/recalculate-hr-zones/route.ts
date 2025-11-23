import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Recalculate heart rate zones for all user's runs
 * Uses current profile HR zone settings
 */
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's HR zone configuration
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('hr_zone_1_max, hr_zone_2_max, hr_zone_3_max, hr_zone_4_max, max_heart_rate')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if user has HR zones configured
    const hasCustomZones = profile.hr_zone_1_max && profile.hr_zone_2_max && 
                          profile.hr_zone_3_max && profile.hr_zone_4_max

    if (!hasCustomZones && !profile.max_heart_rate) {
      return NextResponse.json({ 
        error: 'No HR zones configured. Please set your HR zones or max heart rate in profile settings.' 
      }, { status: 400 })
    }

    // Fetch all runs with HR data
    const { data: hrZoneRecords, error: hrZonesError } = await supabase
      .from('activity_heart_rate_zones')
      .select('id, run_id, max_hr')
      .eq('user_id', user.id)

    if (hrZonesError) {
      console.error('Error fetching HR zone records:', hrZonesError)
      return NextResponse.json({ error: 'Failed to fetch HR zone records' }, { status: 500 })
    }

    if (!hrZoneRecords || hrZoneRecords.length === 0) {
      return NextResponse.json({ 
        message: 'No runs with heart rate data found',
        recalculated: 0 
      })
    }

    let recalculatedCount = 0
    const errors: string[] = []

    // Process each run
    for (const hrRecord of hrZoneRecords) {
      try {
        // Fetch HR stream data for this run
        const { data: hrStream, error: streamError } = await supabase
          .from('activity_streams')
          .select('data')
          .eq('run_id', hrRecord.run_id)
          .eq('stream_type', 'heartrate')
          .single()

        if (streamError || !hrStream) {
          errors.push(`Run ${hrRecord.run_id}: No HR stream data found`)
          continue
        }

        const hrData = hrStream.data as number[]
        if (!Array.isArray(hrData) || hrData.length === 0) {
          errors.push(`Run ${hrRecord.run_id}: Invalid HR data`)
          continue
        }

        // Use max HR from the activity or profile
        const maxHR = hrRecord.max_hr || profile.max_heart_rate
        if (!maxHR) {
          errors.push(`Run ${hrRecord.run_id}: No max HR available`)
          continue
        }

        // Calculate zone thresholds
        const zone1Max = hasCustomZones ? profile.hr_zone_1_max : Math.round(maxHR * 0.60)
        const zone2Max = hasCustomZones ? profile.hr_zone_2_max : Math.round(maxHR * 0.70)
        const zone3Max = hasCustomZones ? profile.hr_zone_3_max : Math.round(maxHR * 0.80)
        const zone4Max = hasCustomZones ? profile.hr_zone_4_max : Math.round(maxHR * 0.90)

        // Recalculate zones
        const zones = { zone_1: 0, zone_2: 0, zone_3: 0, zone_4: 0, zone_5: 0 }
        hrData.forEach((hr) => {
          if (hr <= zone1Max) zones.zone_1++
          else if (hr <= zone2Max) zones.zone_2++
          else if (hr <= zone3Max) zones.zone_3++
          else if (hr <= zone4Max) zones.zone_4++
          else zones.zone_5++
        })

        // Update the HR zones record
        const { error: updateError } = await supabase
          .from('activity_heart_rate_zones')
          .update({
            zone_1_time: zones.zone_1,
            zone_2_time: zones.zone_2,
            zone_3_time: zones.zone_3,
            zone_4_time: zones.zone_4,
            zone_5_time: zones.zone_5,
            updated_at: new Date().toISOString(),
          })
          .eq('id', hrRecord.id)

        if (updateError) {
          errors.push(`Run ${hrRecord.run_id}: Update failed - ${updateError.message}`)
          continue
        }

        recalculatedCount++
      } catch (err) {
        errors.push(`Run ${hrRecord.run_id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recalculated HR zones for ${recalculatedCount} run(s)`,
      recalculated: recalculatedCount,
      total: hrZoneRecords.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error recalculating HR zones:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

