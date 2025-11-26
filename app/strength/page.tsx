import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StrengthClient from '@/components/strength/StrengthClient'
import StrengthOnboardingPage from './StrengthOnboardingPage'

export default async function StrengthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check for active strength plan
  const { data: strengthPlan } = await supabase
    .from('strength_training_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  // If no plan, show onboarding
  if (!strengthPlan) {
    return <StrengthOnboardingPage userId={user.id} />
  }

  // Fetch sessions for the plan
  const { data: sessions } = await supabase
    .from('strength_sessions')
    .select('*')
    .eq('strength_plan_id', strengthPlan.id)
    .order('scheduled_date', { ascending: true })

  return (
    <StrengthClient
      sessions={sessions || []}
      plan={strengthPlan}
      userId={user.id}
    />
  )
}
