import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Recalculate heart rate zones for all user's runs
 * Uses current profile HR zone settings
 */
export async function POST(request: Request) {
  try {
    // Use server client for auth
    const authSupabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await authSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role client for data operations (bypass RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    console.log(`Starting HR zone recalculation for ${hrZoneRecords.length} runs`)

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

        if (streamError) {
          console.error(`Stream error for run ${hrRecord.run_id}:`, streamError)
          errors.push(`Run ${hrRecord.run_id}: ${streamError.message}`)
          continue
        }

        if (!hrStream) {
          console.log(`No HR stream found for run ${hrRecord.run_id}`)
          errors.push(`Run ${hrRecord.run_id}: No HR stream data found`)
          continue
        }

        // Handle JSONB data - it might be already parsed or need parsing
        let hrData: number[]
        if (typeof hrStream.data === 'string') {
          hrData = JSON.parse(hrStream.data)
        } else {
          hrData = hrStream.data as number[]
        }

        if (!Array.isArray(hrData) || hrData.length === 0) {
          console.log(`Invalid HR data for run ${hrRecord.run_id}:`, typeof hrData, hrData)
          errors.push(`Run ${hrRecord.run_id}: Invalid HR data (${typeof hrData})`)
          continue
        }

        console.log(`Processing run ${hrRecord.run_id}: ${hrData.length} HR data points`)

        // Use max HR from the activity or profile
        const maxHR = hrRecord.max_hr || profile.max_heart_rate
        if (!maxHR) {
          console.log(`No max HR for run ${hrRecord.run_id}`)
          errors.push(`Run ${hrRecord.run_id}: No max HR available`)
          continue
        }

        // Calculate zone thresholds using user's custom zones
        const zone1Max = hasCustomZones ? profile.hr_zone_1_max : Math.round(maxHR * 0.60)
        const zone2Max = hasCustomZones ? profile.hr_zone_2_max : Math.round(maxHR * 0.70)
        const zone3Max = hasCustomZones ? profile.hr_zone_3_max : Math.round(maxHR * 0.80)
        const zone4Max = hasCustomZones ? profile.hr_zone_4_max : Math.round(maxHR * 0.90)

        console.log(`Zone thresholds for run ${hrRecord.run_id}:`, {
          zone1Max,
          zone2Max,
          zone3Max,
          zone4Max,
          hasCustomZones,
        })

        // Recalculate zones
        const zones = { zone_1: 0, zone_2: 0, zone_3: 0, zone_4: 0, zone_5: 0 }
        hrData.forEach((hr) => {
          if (hr <= zone1Max) zones.zone_1++
          else if (hr <= zone2Max) zones.zone_2++
          else if (hr <= zone3Max) zones.zone_3++
          else if (hr <= zone4Max) zones.zone_4++
          else zones.zone_5++
        })

        console.log(`Calculated zones for run ${hrRecord.run_id}:`, zones)

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
          console.error(`Update error for run ${hrRecord.run_id}:`, updateError)
          errors.push(`Run ${hrRecord.run_id}: Update failed - ${updateError.message}`)
          continue
        }

        console.log(`✅ Successfully recalculated zones for run ${hrRecord.run_id}`)
        recalculatedCount++
      } catch (err) {
        console.error(`Error processing run ${hrRecord.run_id}:`, err)
        errors.push(`Run ${hrRecord.run_id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    console.log(`Recalculation complete: ${recalculatedCount}/${hrZoneRecords.length} successful`)
    if (errors.length > 0) {
      console.error('Errors encountered:', errors)
    }

    return NextResponse.json({
      success: recalculatedCount > 0,
      message: `Successfully recalculated HR zones for ${recalculatedCount} run(s)`,
      recalculated: recalculatedCount,
      total: hrZoneRecords.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error recalculating HR zones:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

