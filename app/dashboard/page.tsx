import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch dashboard data - optimized to only fetch what's needed for initial render
  // Dashboard only shows: upcoming runs, recent completed runs, and stats
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [upcomingRunsData, recentRunsData, pbsData, planData] = await Promise.all([
    // Only fetch upcoming runs (next 30 days)
    supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(50),
    // Only fetch recent completed runs (last 30 days)
    supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('scheduled_date', thirtyDaysAgo)
      .order('scheduled_date', { ascending: false })
      .limit(50),
    supabase.from('personal_bests').select('*').eq('user_id', user.id),
    supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active').single(),
  ])

  // Combine upcoming and recent runs
  const runs = [...(upcomingRunsData.data || []), ...(recentRunsData.data || [])]

  return (
    <DashboardClient
      runs={runs}
      stravaActivities={[]} // Remove strava_activities table dependency
      personalBests={pbsData.data || []}
      trainingPlan={planData.data}
    />
  )
}

