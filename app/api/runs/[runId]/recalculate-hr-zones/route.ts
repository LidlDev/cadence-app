import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * Recalculate heart rate zones for a single run
 * Uses current profile HR zone settings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params

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

    // Fetch HR zone record for this run
    const { data: hrRecord, error: hrRecordError } = await supabase
      .from('activity_heart_rate_zones')
      .select('id, max_hr')
      .eq('run_id', runId)
      .eq('user_id', user.id)
      .single()

    if (hrRecordError || !hrRecord) {
      return NextResponse.json({ 
        error: 'No heart rate data found for this run' 
      }, { status: 404 })
    }

    // Fetch HR stream data
    const { data: hrStream, error: streamError } = await supabase
      .from('activity_streams')
      .select('data')
      .eq('run_id', runId)
      .eq('stream_type', 'heartrate')
      .single()

    if (streamError || !hrStream) {
      return NextResponse.json({ 
        error: 'No heart rate stream data found for this run' 
      }, { status: 404 })
    }

    // Handle JSONB data
    let hrData: number[]
    if (typeof hrStream.data === 'string') {
      hrData = JSON.parse(hrStream.data)
    } else {
      hrData = hrStream.data as number[]
    }

    if (!Array.isArray(hrData) || hrData.length === 0) {
      return NextResponse.json({ 
        error: 'Invalid heart rate data' 
      }, { status: 400 })
    }

    // Use max HR from the activity or profile
    const maxHR = hrRecord.max_hr || profile.max_heart_rate
    if (!maxHR) {
      return NextResponse.json({ 
        error: 'No max heart rate available' 
      }, { status: 400 })
    }

    // Calculate zone thresholds using user's custom zones
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
      console.error('Update error:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update heart rate zones' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully recalculated heart rate zones',
      zones: {
        zone_1: zones.zone_1,
        zone_2: zones.zone_2,
        zone_3: zones.zone_3,
        zone_4: zones.zone_4,
        zone_5: zones.zone_5,
      },
    })
  } catch (error) {
    console.error('Error recalculating HR zones:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

