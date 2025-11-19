import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RunsClient from '@/components/runs/RunsClient'

export default async function RunsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Optimize: Only fetch runs within a reasonable time window
  // Fetch runs from 60 days ago to 90 days in the future
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ninetyDaysFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: runs } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', user.id)
    .gte('scheduled_date', sixtyDaysAgo)
    .lte('scheduled_date', ninetyDaysFromNow)
    .order('scheduled_date', { ascending: true })
    .limit(200) // Hard limit to prevent loading too much data

  return <RunsClient runs={runs || []} userId={user.id} />
}

