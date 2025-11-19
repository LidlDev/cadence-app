import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from '@/components/profile/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get Strava connection status
  const { data: stravaToken } = await supabase
    .from('strava_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <ProfileClient 
      user={user} 
      profile={profile} 
      stravaConnected={!!stravaToken}
      stravaAthlete={stravaToken?.athlete_id}
    />
  )
}

