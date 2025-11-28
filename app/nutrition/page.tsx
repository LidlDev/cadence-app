import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NutritionClient from '@/components/nutrition/NutritionClient'

export default async function NutritionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = new Date().toISOString().split('T')[0]

  // Fetch nutrition plan
  const { data: plan } = await supabase
    .from('nutrition_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  // Fetch today's target
  const { data: todayTarget } = await supabase
    .from('daily_nutrition_targets')
    .select('*')
    .eq('user_id', user.id)
    .eq('target_date', today)
    .single()

  // Fetch today's meals
  const { data: todayMeals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .order('logged_at', { ascending: true })

  // Fetch today's hydration
  const { data: todayHydration } = await supabase
    .from('hydration_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('log_date', today)
    .order('logged_at', { ascending: false })

  // Fetch today's summary
  const { data: todaySummary } = await supabase
    .from('daily_nutrition_summaries')
    .select('*')
    .eq('user_id', user.id)
    .eq('summary_date', today)
    .single()

  return (
    <NutritionClient
      plan={plan}
      todayTarget={todayTarget}
      todayMeals={todayMeals || []}
      todayHydration={todayHydration || []}
      todaySummary={todaySummary}
    />
  )
}
