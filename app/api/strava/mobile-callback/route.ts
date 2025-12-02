import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const scope = searchParams.get('scope')
  const state = searchParams.get('state') // User ID passed from mobile app

  // If user denied access
  if (error) {
    return NextResponse.redirect('cadence://strava-callback?error=access_denied')
  }

  if (!code || !state) {
    return NextResponse.redirect('cadence://strava-callback?error=no_code_or_state')
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: '185798',
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Strava token exchange failed:', errorData)
      return NextResponse.redirect('cadence://strava-callback?error=token_exchange_failed')
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_at, athlete } = tokens

    // Use the user ID from state parameter
    const userId = state
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Store tokens in database
    const { error: dbError } = await supabase.from('strava_tokens').upsert({
      user_id: userId,
      access_token,
      refresh_token,
      expires_at: new Date(expires_at * 1000).toISOString(),
      athlete_id: athlete.id,
    }, { onConflict: 'user_id' })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect('cadence://strava-callback?error=database_error')
    }

    // Redirect back to mobile app with success
    return NextResponse.redirect(`cadence://strava-callback?success=true&athlete_id=${athlete.id}`)
  } catch (error) {
    console.error('Error in Strava mobile callback:', error)
    return NextResponse.redirect('cadence://strava-callback?error=unknown')
  }
}

