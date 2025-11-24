import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'AI insights are not configured. Please add OPENAI_API_KEY to environment variables.'
      }, { status: 500 })
    }

    const { runId } = await params

    // Fetch the run data
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*')
      .eq('id', runId)
      .eq('user_id', user.id)
      .single()

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    // If insights already exist, return them
    if (run.ai_insights) {
      return NextResponse.json({ insights: run.ai_insights, cached: true })
    }

    // Fetch user profile for context
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Fetch training plan for context
    const { data: trainingPlan } = await supabase
      .from('training_plans')
      .select('*')
      .eq('id', run.training_plan_id)
      .single()

    // Fetch recent runs for comparison
    const { data: recentRuns } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(10)

    // Build context for AI
    const context = buildRunContext(run, profile, trainingPlan, recentRuns || [])

    // Generate insights using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an enthusiastic and knowledgeable running coach analyzing a completed run. 
Provide energetic, motivating insights about the runner's performance. Be specific, encouraging, and actionable.
Focus on:
1. How this run compares to their target and recent performances
2. What this run tells us about their fitness and progress
3. Specific recommendations for future training
4. Recognition of achievements and areas for improvement

Use emojis sparingly but effectively. Be conversational and upbeat while remaining professional.
Keep your response well-structured with clear sections.`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    })

    const insights = completion.choices[0].message.content

    // Store insights in database
    await supabase
      .from('runs')
      .update({ ai_insights: insights })
      .eq('id', runId)

    return NextResponse.json({ insights, cached: false })
  } catch (error: any) {
    console.error('Error generating run insights:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function buildRunContext(run: any, profile: any, trainingPlan: any, recentRuns: any[]): string {
  let context = `Analyze this completed run:\n\n`
  
  context += `## Run Details\n`
  context += `- Type: ${run.run_type}${run.session_type ? ` (${run.session_type})` : ''}\n`
  context += `- Week ${run.week_number} of training plan\n`
  context += `- Planned: ${run.planned_distance}km${run.target_pace ? ` at ${run.target_pace}/km` : ''}\n`
  context += `- Actual: ${run.actual_distance}km in ${run.actual_time}${run.actual_pace ? ` at ${run.actual_pace}/km` : ''}\n`
  
  if (run.average_hr) context += `- Average HR: ${run.average_hr} bpm${run.max_hr ? ` (Max: ${run.max_hr})` : ''}\n`
  if (run.average_cadence) context += `- Average Cadence: ${Math.round(run.average_cadence * 2)} spm\n`
  if (run.total_elevation_gain) context += `- Elevation Gain: ${run.total_elevation_gain}m\n`
  if (run.rpe) context += `- RPE: ${run.rpe}/10\n`
  if (run.notes) context += `\n**Runner's Notes:** ${run.notes}\n`
  if (run.comments) context += `**Comments:** ${run.comments}\n`

  if (trainingPlan) {
    context += `\n## Training Context\n`
    context += `- Plan: ${trainingPlan.name}\n`
    context += `- Goal: ${trainingPlan.goal_race || 'General fitness'}\n`
    if (trainingPlan.goal_time) context += `- Target Time: ${trainingPlan.goal_time}\n`
  }

  if (recentRuns.length > 0) {
    context += `\n## Recent Performance Trend\n`
    const completedRuns = recentRuns.filter(r => r.actual_distance && r.actual_pace)
    if (completedRuns.length > 0) {
      context += `Last ${completedRuns.length} completed runs:\n`
      completedRuns.slice(0, 5).forEach((r, i) => {
        context += `${i + 1}. ${r.run_type}: ${r.actual_distance}km at ${r.actual_pace}/km${r.rpe ? ` (RPE: ${r.rpe})` : ''}\n`
      })
    }
  }

  return context
}

