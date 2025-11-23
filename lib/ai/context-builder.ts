import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Builds context for AI chat from user's training data
 */
export async function buildUserContext(supabase: SupabaseClient, userId: string) {
  // Fetch user profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

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

  // Fetch HR zone data for recent runs
  const recentRunIds = recentRuns?.map(r => r.id) || []
  const { data: hrZones } = recentRunIds.length > 0 ? await supabase
    .from('activity_heart_rate_zones')
    .select('*')
    .in('run_id', recentRunIds)
    : { data: null }

  // Calculate training stats
  const completedRuns = recentRuns || []
  const totalDistance = completedRuns.reduce((sum, r) => sum + (r.actual_distance || 0), 0)
  const avgRPE = completedRuns.length > 0
    ? completedRuns.reduce((sum, r) => sum + (r.rpe || 0), 0) / completedRuns.length
    : 0

  // Calculate HR zone distribution across recent runs
  const hrZoneStats = hrZones?.reduce((acc, zone) => {
    acc.zone1 += zone.zone_1_time || 0
    acc.zone2 += zone.zone_2_time || 0
    acc.zone3 += zone.zone_3_time || 0
    acc.zone4 += zone.zone_4_time || 0
    acc.zone5 += zone.zone_5_time || 0
    acc.totalTime += (zone.zone_1_time || 0) + (zone.zone_2_time || 0) +
                     (zone.zone_3_time || 0) + (zone.zone_4_time || 0) + (zone.zone_5_time || 0)
    return acc
  }, { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0, totalTime: 0 }) || null

  // Build context string
  const context = {
    profile: profile ? {
      age: profile.age,
      gender: profile.gender,
      weight_kg: profile.weight_kg,
      height_cm: profile.height_cm,
      max_heart_rate: profile.max_heart_rate,
      resting_heart_rate: profile.resting_heart_rate,
      hr_zones: profile.hr_zone_1_max ? {
        zone1_max: profile.hr_zone_1_max,
        zone2_max: profile.hr_zone_2_max,
        zone3_max: profile.hr_zone_3_max,
        zone4_max: profile.hr_zone_4_max,
      } : null,
      running_experience: profile.running_experience,
      training_goal: profile.training_goal,
      weekly_mileage_target: profile.weekly_mileage_target,
    } : null,
    summary: {
      totalRecentRuns: completedRuns.length,
      totalDistance: totalDistance.toFixed(1),
      avgRPE: avgRPE.toFixed(1),
      upcomingRuns: upcomingRuns?.length || 0,
    },
    hrZoneDistribution: hrZoneStats && hrZoneStats.totalTime > 0 ? {
      zone1_percent: ((hrZoneStats.zone1 / hrZoneStats.totalTime) * 100).toFixed(1),
      zone2_percent: ((hrZoneStats.zone2 / hrZoneStats.totalTime) * 100).toFixed(1),
      zone3_percent: ((hrZoneStats.zone3 / hrZoneStats.totalTime) * 100).toFixed(1),
      zone4_percent: ((hrZoneStats.zone4 / hrZoneStats.totalTime) * 100).toFixed(1),
      zone5_percent: ((hrZoneStats.zone5 / hrZoneStats.totalTime) * 100).toFixed(1),
    } : null,
    recentRuns: completedRuns.slice(0, 10).map((run) => {
      const runHRZones = hrZones?.find(z => z.run_id === run.id)
      return {
        date: run.scheduled_date,
        type: run.run_type,
        distance: run.actual_distance,
        pace: run.actual_pace,
        rpe: run.rpe,
        comments: run.comments,
        avg_hr: runHRZones?.average_hr,
        max_hr: runHRZones?.max_hr,
      }
    }),
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
  const { profile, summary, hrZoneDistribution, recentRuns, personalBests, bestPerformances, memories } = context

  let message = `You are a knowledgeable running coach assistant helping a runner with their training. Here's what you know about the user:\n\n`

  // Profile information
  if (profile) {
    message += `## Runner Profile\n`
    if (profile.age) message += `- Age: ${profile.age} years\n`
    if (profile.gender) message += `- Gender: ${profile.gender}\n`
    if (profile.weight_kg) message += `- Weight: ${profile.weight_kg} kg\n`
    if (profile.height_cm) message += `- Height: ${profile.height_cm} cm\n`
    if (profile.running_experience) message += `- Experience Level: ${profile.running_experience}\n`
    if (profile.training_goal) message += `- Training Goal: ${profile.training_goal}\n`
    if (profile.weekly_mileage_target) message += `- Weekly Mileage Target: ${profile.weekly_mileage_target} km\n`

    if (profile.max_heart_rate || profile.resting_heart_rate) {
      message += `\n### Heart Rate Data\n`
      if (profile.max_heart_rate) message += `- Max HR: ${profile.max_heart_rate} bpm\n`
      if (profile.resting_heart_rate) message += `- Resting HR: ${profile.resting_heart_rate} bpm\n`

      if (profile.hr_zones) {
        message += `- HR Zones:\n`
        message += `  - Zone 1 (Recovery): ≤ ${profile.hr_zones.zone1_max} bpm\n`
        message += `  - Zone 2 (Aerobic): ${profile.hr_zones.zone1_max + 1}-${profile.hr_zones.zone2_max} bpm\n`
        message += `  - Zone 3 (Tempo): ${profile.hr_zones.zone2_max + 1}-${profile.hr_zones.zone3_max} bpm\n`
        message += `  - Zone 4 (Threshold): ${profile.hr_zones.zone3_max + 1}-${profile.hr_zones.zone4_max} bpm\n`
        message += `  - Zone 5 (Max): > ${profile.hr_zones.zone4_max} bpm\n`
      }
    }
    message += `\n`
  }

  // Summary
  message += `## Training Summary (Last 30 Days)\n`
  message += `- Completed Runs: ${summary.totalRecentRuns}\n`
  message += `- Total Distance: ${summary.totalDistance} km\n`
  message += `- Average RPE: ${summary.avgRPE}/10\n`
  message += `- Upcoming Runs: ${summary.upcomingRuns}\n`

  // HR zone distribution
  if (hrZoneDistribution) {
    message += `\n### Heart Rate Zone Distribution\n`
    message += `- Zone 1 (Recovery): ${hrZoneDistribution.zone1_percent}%\n`
    message += `- Zone 2 (Aerobic): ${hrZoneDistribution.zone2_percent}%\n`
    message += `- Zone 3 (Tempo): ${hrZoneDistribution.zone3_percent}%\n`
    message += `- Zone 4 (Threshold): ${hrZoneDistribution.zone4_percent}%\n`
    message += `- Zone 5 (Max): ${hrZoneDistribution.zone5_percent}%\n`
  }
  message += `\n`

  // Recent runs
  if (recentRuns.length > 0) {
    message += `## Recent Runs\n`
    recentRuns.forEach((run: any) => {
      message += `- ${run.date}: ${run.type}, ${run.distance}km at ${run.pace || 'N/A'} pace, RPE ${run.rpe}/10`
      if (run.avg_hr) message += `, Avg HR ${run.avg_hr} bpm`
      if (run.max_hr) message += ` (Max ${run.max_hr} bpm)`
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

