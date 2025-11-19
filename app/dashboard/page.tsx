import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch dashboard data
  const [runsData, stravaData, pbsData, planData] = await Promise.all([
    supabase.from('runs').select('*').eq('user_id', user.id).order('scheduled_date', { ascending: true }),
    supabase.from('strava_activities').select('*').eq('user_id', user.id).order('start_date', { ascending: false }).limit(30),
    supabase.from('personal_bests').select('*').eq('user_id', user.id),
    supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active').single(),
  ])

  return (
    <DashboardClient
      runs={runsData.data || []}
      stravaActivities={stravaData.data || []}
      personalBests={pbsData.data || []}
      trainingPlan={planData.data}
    />
  )
}

