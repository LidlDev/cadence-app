import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { weeks_to_add = 2 } = await request.json()

    // Get active strength plan
    const { data: plan } = await supabase
      .from('strength_training_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'No active strength plan found' }, { status: 404 })
    }

    // Get the last few sessions to understand the progression
    const { data: recentSessions } = await supabase
      .from('strength_sessions')
      .select('*, session_exercises:session_exercises(*, exercise:exercises(*))')
      .eq('strength_plan_id', plan.id)
      .order('week_number', { ascending: false })
      .order('scheduled_date', { ascending: false })
      .limit(10)

    if (!recentSessions || recentSessions.length === 0) {
      return NextResponse.json({ error: 'No existing sessions to build from' }, { status: 400 })
    }

    // Call edge function to generate more weeks
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const response = await fetch(`${supabaseUrl}/functions/v1/extend-strength-plan`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan,
        recentSessions,
        weeksToAdd: weeks_to_add
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(error)
    }

    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('Extend plan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

