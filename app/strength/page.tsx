import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Dumbbell } from 'lucide-react'

export default async function StrengthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: sessions } = await supabase
    .from('strength_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: false })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <Dumbbell className="w-10 h-10 text-orange-600" />
            Strength Training
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track your strength and conditioning sessions
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Strength training tracking coming soon!
          </p>
          <p className="text-slate-500 dark:text-slate-500 mt-2">
            This feature will allow you to log exercises, sets, reps, and track your progress over time.
          </p>
        </div>
      </div>
    </div>
  )
}

