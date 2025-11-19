import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_STRAVA_REDIRECT_URI
  const scope = 'read,activity:read_all,profile:read_all'

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&approval_prompt=force&scope=${scope}`

  return NextResponse.redirect(authUrl)
}

