import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId: id } = await params
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch run details
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    // Fetch activity streams if available
    let streams = null
    if (run.strava_activity_id) {
      const { data: streamData } = await supabase
        .from('activity_streams')
        .select('*')
        .eq('run_id', id)

      if (streamData && streamData.length > 0) {
        // Convert array of streams to object keyed by stream_type
        streams = {}
        streamData.forEach((stream) => {
          streams[stream.stream_type] = {
            data: stream.data,
            original_size: stream.original_size,
            resolution: stream.resolution,
            series_type: stream.series_type,
          }
        })
      }
    }

    // Fetch heart rate zones if available
    let hrZones = null
    if (run.strava_activity_id) {
      const { data: hrData } = await supabase
        .from('activity_heart_rate_zones')
        .select('*')
        .eq('run_id', id)
        .single()

      if (hrData) {
        hrZones = hrData
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        run,
        streams,
        hrZones,
      },
    })
  } catch (error) {
    console.error('Error fetching run details:', error)
    return NextResponse.json({ error: 'Failed to fetch run details' }, { status: 500 })
  }
}

