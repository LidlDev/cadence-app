import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete Strava tokens
    await supabase
      .from('strava_tokens')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Strava:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}

