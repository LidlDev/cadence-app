import { SupabaseClient } from '@supabase/supabase-js'
import { calculateTSS, calculateCTL, calculateATL, calculateTSB, getFormStatus } from './training-load'
import { generateInsights } from './insights-analyzer'

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
    .select(`
      *,
      suffer_score,
      achievement_count,
      pr_count,
      kudos_count,
      elevation_gain,
      average_cadence,
      calories
    `)
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

  // Calculate training load metrics (CTL/ATL/TSB)
  const dailyTSS = new Map<string, number>()

  // Fetch runs from last 60 days for accurate CTL calculation
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: allRecentRuns } = await supabase
    .from('runs')
    .select('scheduled_date, actual_distance, actual_time, rpe, run_type, average_hr, max_hr')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('scheduled_date', sixtyDaysAgo.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })

  // Calculate TSS for each run and aggregate by day
  if (allRecentRuns) {
    const userMaxHR = profile?.max_heart_rate || undefined
    allRecentRuns.forEach((run) => {
      const tss = calculateTSS(run, userMaxHR)
      const date = run.scheduled_date
      dailyTSS.set(date, (dailyTSS.get(date) || 0) + tss)
    })
  }

  // Calculate current fitness metrics
  const today = new Date()
  const ctl = calculateCTL(dailyTSS, today)
  const atl = calculateATL(dailyTSS, today)
  const tsb = calculateTSB(ctl, atl)
  const formStatus = getFormStatus(tsb)

  // Calculate 7-day and 30-day training load
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  let weeklyLoad = 0
  let monthlyLoad = 0

  dailyTSS.forEach((tss, dateStr) => {
    const date = new Date(dateStr)
    if (date >= sevenDaysAgo) {
      weeklyLoad += tss
    }
    if (date >= thirtyDaysAgo) {
      monthlyLoad += tss
    }
  })

  // Generate proactive insights
  const insights = await generateInsights(supabase, userId, tsb, ctl, atl)

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
    trainingLoad: {
      ctl: ctl.toFixed(1),
      atl: atl.toFixed(1),
      tsb: tsb.toFixed(1),
      formStatus: formStatus.status,
      formDescription: formStatus.description,
      weeklyLoad: weeklyLoad.toFixed(1),
      monthlyLoad: monthlyLoad.toFixed(1),
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
        suffer_score: run.suffer_score,
        elevation_gain: run.elevation_gain,
        average_cadence: run.average_cadence,
        calories: run.calories,
        achievement_count: run.achievement_count,
        pr_count: run.pr_count,
        kudos_count: run.kudos_count,
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
    insights: insights,
  }

  return context
}

/**
 * Formats context into a system message for the AI
 */
export function formatContextForAI(context: any): string {
  const { profile, summary, trainingLoad, hrZoneDistribution, recentRuns, personalBests, bestPerformances, memories, insights } = context

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

  // Training Load Metrics
  if (trainingLoad) {
    message += `\n### Training Load & Fitness Metrics\n`
    message += `- **CTL (Chronic Training Load)**: ${trainingLoad.ctl} - Long-term fitness\n`
    message += `- **ATL (Acute Training Load)**: ${trainingLoad.atl} - Short-term fatigue\n`
    message += `- **TSB (Training Stress Balance)**: ${trainingLoad.tsb}\n`
    message += `- **Current Form**: ${trainingLoad.formStatus} - ${trainingLoad.formDescription}\n`
    message += `- **7-Day Training Load**: ${trainingLoad.weeklyLoad} TSS\n`
    message += `- **30-Day Training Load**: ${trainingLoad.monthlyLoad} TSS\n`
    message += `\n`
    message += `**Interpretation Guide:**\n`
    message += `- CTL represents fitness built over 6 weeks\n`
    message += `- ATL represents fatigue from the last week\n`
    message += `- TSB = CTL - ATL (positive = fresh, negative = fatigued)\n`
    message += `- TSB > 10: Fresh, good for racing\n`
    message += `- TSB -10 to 10: Normal training state\n`
    message += `- TSB < -30: High overtraining risk\n`
  }

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

      // Strava metrics
      const stravaMetrics = []
      if (run.suffer_score) stravaMetrics.push(`Suffer Score: ${run.suffer_score}`)
      if (run.elevation_gain) stravaMetrics.push(`Elevation: ${run.elevation_gain}m`)
      if (run.average_cadence) stravaMetrics.push(`Cadence: ${run.average_cadence} spm`)
      if (run.calories) stravaMetrics.push(`Calories: ${run.calories}`)
      if (run.pr_count && run.pr_count > 0) stravaMetrics.push(`🏆 ${run.pr_count} PR${run.pr_count > 1 ? 's' : ''}`)
      if (run.achievement_count && run.achievement_count > 0) stravaMetrics.push(`🎖️ ${run.achievement_count} achievement${run.achievement_count > 1 ? 's' : ''}`)
      if (run.kudos_count && run.kudos_count > 0) stravaMetrics.push(`👍 ${run.kudos_count} kudos`)

      if (stravaMetrics.length > 0) {
        message += ` [${stravaMetrics.join(', ')}]`
      }

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

  // Proactive Insights
  if (insights && insights.length > 0) {
    message += `## 🔍 Proactive Training Insights\n`
    message += `Based on analysis of your recent training, here are important insights:\n\n`

    // Sort by priority
    const sortedInsights = [...insights].sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    sortedInsights.forEach((insight: any, index: number) => {
      const emoji = insight.type === 'danger' ? '🚨' :
                    insight.type === 'warning' ? '⚠️' :
                    insight.type === 'success' ? '✅' : 'ℹ️'

      message += `${index + 1}. ${emoji} **${insight.title}** [${insight.priority.toUpperCase()} PRIORITY]\n`
      message += `   ${insight.description}\n`
      message += `   💡 Recommendation: ${insight.recommendation}\n\n`
    })
  }

  message += `\n**Your Role**: Provide helpful, personalized advice based on this information. Be encouraging and specific. `
  message += `If there are high-priority insights, address them proactively in your response. `
  message += `Use the training load metrics to guide your recommendations about workout intensity and recovery.`

  return message
}

