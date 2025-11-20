import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Builds context for AI chat from user's training data
 */
export async function buildUserContext(supabase: SupabaseClient, userId: string) {
  // Fetch recent completed runs (last 30 days based on when they were updated/completed)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentRuns } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('updated_at', thirtyDaysAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(20)

  // Fetch personal bests
  const { data: personalBests } = await supabase
    .from('personal_bests')
    .select('*')
    .eq('user_id', userId)
    .eq('is_target', false)

  // Fetch best performances
  const { data: bestPerformances } = await supabase
    .from('best_performances')
    .select('*')
    .eq('user_id', userId)
    .order('distance', { ascending: true })
    .order('rank', { ascending: true })

  // Fetch AI memories
  const { data: memories } = await supabase
    .from('ai_memories')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .order('last_accessed', { ascending: false })
    .limit(10)

  // Fetch upcoming runs for context
  const { data: upcomingRuns } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })
    .limit(10)

  // Calculate training stats
  const completedRuns = recentRuns || []
  const totalDistance = completedRuns.reduce((sum, r) => sum + (r.actual_distance || 0), 0)
  const avgRPE = completedRuns.length > 0
    ? completedRuns.reduce((sum, r) => sum + (r.rpe || 0), 0) / completedRuns.length
    : 0

  // Build context string
  const context = {
    summary: {
      totalRecentRuns: completedRuns.length,
      totalDistance: totalDistance.toFixed(1),
      avgRPE: avgRPE.toFixed(1),
      upcomingRuns: upcomingRuns?.length || 0,
    },
    recentRuns: completedRuns.slice(0, 10).map((run) => ({
      date: run.scheduled_date,
      type: run.run_type,
      distance: run.actual_distance,
      pace: run.actual_pace,
      rpe: run.rpe,
      comments: run.comments,
    })),
    personalBests: personalBests?.map((pb) => ({
      distance: pb.distance,
      time: pb.time,
      pace: pb.pace,
    })) || [],
    bestPerformances: bestPerformances?.map((perf) => ({
      distance: perf.distance,
      rank: perf.rank,
      time: perf.time,
      pace: perf.pace,
      date: perf.date,
    })) || [],
    memories: memories?.map((mem) => ({
      category: mem.category,
      content: mem.content,
      importance: mem.importance,
    })) || [],
  }

  return context
}

/**
 * Formats context into a system message for the AI
 */
export function formatContextForAI(context: any): string {
  const { summary, recentRuns, personalBests, bestPerformances, memories } = context

  let message = `You are a knowledgeable running coach assistant helping a runner with their training. Here's what you know about the user:\n\n`

  // Summary
  message += `## Training Summary (Last 30 Days)\n`
  message += `- Completed Runs: ${summary.totalRecentRuns}\n`
  message += `- Total Distance: ${summary.totalDistance} km\n`
  message += `- Average RPE: ${summary.avgRPE}/10\n`
  message += `- Upcoming Runs: ${summary.upcomingRuns}\n\n`

  // Recent runs
  if (recentRuns.length > 0) {
    message += `## Recent Runs\n`
    recentRuns.forEach((run: any) => {
      message += `- ${run.date}: ${run.type}, ${run.distance}km at ${run.pace || 'N/A'} pace, RPE ${run.rpe}/10`
      if (run.comments) message += ` - "${run.comments}"`
      message += `\n`
    })
    message += `\n`
  }

  // Personal bests
  if (personalBests.length > 0) {
    message += `## Personal Bests\n`
    personalBests.forEach((pb: any) => {
      message += `- ${pb.distance}: ${pb.time} (${pb.pace})\n`
    })
    message += `\n`
  }

  // Best performances
  if (bestPerformances.length > 0) {
    message += `## Top 3 Performances\n`
    const grouped = bestPerformances.reduce((acc: any, perf: any) => {
      if (!acc[perf.distance]) acc[perf.distance] = []
      acc[perf.distance].push(perf)
      return acc
    }, {})

    Object.keys(grouped).forEach((distance) => {
      message += `${distance}:\n`
      grouped[distance].forEach((perf: any) => {
        const medal = perf.rank === 1 ? '🥇' : perf.rank === 2 ? '🥈' : '🥉'
        message += `  ${medal} ${perf.time} (${perf.pace}) - ${perf.date}\n`
      })
    })
    message += `\n`
  }

  // Memories
  if (memories.length > 0) {
    message += `## Important Context\n`
    memories.forEach((mem: any) => {
      message += `- [${mem.category}] ${mem.content}\n`
    })
    message += `\n`
  }

  message += `Provide helpful, personalized advice based on this information. Be encouraging and specific.`

  return message
}

