// Supabase Edge Function for fetching Strava activities
// Mirrors the web app's /api/strava/activities endpoint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`
}

function calculatePace(distanceMeters: number, timeSeconds: number): string {
  if (distanceMeters === 0) return '0:00'
  const paceSecondsPerKm = timeSeconds / (distanceMeters / 1000)
  const mins = Math.floor(paceSecondsPerKm / 60)
  const secs = Math.floor(paceSecondsPerKm % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const jwt = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get Strava tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Strava not connected' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt < new Date()) {
      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      })

      if (!refreshResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to refresh Strava token' }), 
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      await supabase.from('strava_tokens').update({
        access_token: refreshData.access_token,
        refresh_token: refreshData.refresh_token,
        expires_at: new Date(refreshData.expires_at * 1000).toISOString(),
      }).eq('user_id', user.id)
    }

    // Fetch recent activities (last 30 days)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!activitiesResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch Strava activities' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const activities = await activitiesResponse.json()
    const runs = activities
      .filter((a: any) => a.type === 'Run')
      .map((a: any) => ({
        id: a.id, name: a.name,
        distance: (a.distance / 1000).toFixed(2),
        duration: formatDuration(a.moving_time),
        pace: calculatePace(a.distance, a.moving_time),
        start_date: a.start_date,
        average_hr: a.average_heartrate, max_hr: a.max_heartrate,
        elevation_gain: a.total_elevation_gain,
      }))
      .sort((a: any, b: any) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

    return new Response(JSON.stringify({ success: true, activities: runs }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

