import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RunsClient from '@/components/runs/RunsClient'

export default async function RunsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: runs } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: true })

  return <RunsClient runs={runs || []} userId={user.id} />
}

