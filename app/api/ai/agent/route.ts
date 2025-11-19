import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json({
        error: 'AI features not configured. Please add OPENAI_API_KEY to environment variables.'
      }, { status: 503 })
    }

    const { query, context } = await request.json()

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's training data
    const [runsData, stravaData, pbsData, planData] = await Promise.all([
      supabase.from('runs').select('*').eq('user_id', user.id).order('scheduled_date', { ascending: false }).limit(50),
      supabase.from('strava_activities').select('*').eq('user_id', user.id).order('start_date', { ascending: false }).limit(20),
      supabase.from('personal_bests').select('*').eq('user_id', user.id),
      supabase.from('training_plans').select('*').eq('user_id', user.id).eq('status', 'active').single(),
    ])

    // Build context for AI
    const systemPrompt = `You are an expert running coach and training analyst. You have access to the user's training data and can provide insights, predictions, and recommendations.

Current Training Plan: ${planData.data ? JSON.stringify(planData.data) : 'No active plan'}
Recent Runs: ${JSON.stringify(runsData.data?.slice(0, 10) || [])}
Recent Strava Activities: ${JSON.stringify(stravaData.data?.slice(0, 5) || [])}
Personal Bests: ${JSON.stringify(pbsData.data || [])}

Provide actionable, specific advice based on the data. Consider:
- Training load and progression
- Recovery patterns
- Pace zones and intensity distribution
- Performance trends
- Race predictions based on recent performances
- Injury prevention
- Workout suggestions

Be concise but thorough. Use running-specific terminology.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const response = completion.choices[0].message.content

    return NextResponse.json({ response, usage: completion.usage })
  } catch (error) {
    console.error('AI agent error:', error)
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}

