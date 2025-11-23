import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Proactive Insights Analyzer
 * 
 * Analyzes training data to detect patterns and generate actionable insights:
 * - Overtraining risk detection
 * - Recovery needs assessment
 * - Performance improvements
 * - Injury risk patterns
 * - Training consistency issues
 */

interface RunData {
  scheduled_date: string
  actual_distance: number | null
  rpe: number | null
  run_type: string
  average_hr: number | null
}

export interface Insight {
  type: 'warning' | 'success' | 'info' | 'danger'
  category: 'overtraining' | 'recovery' | 'performance' | 'injury_risk' | 'consistency' | 'zones'
  title: string
  description: string
  recommendation: string
  priority: 'high' | 'medium' | 'low'
}

/**
 * Analyze training data and generate insights
 */
export async function generateInsights(
  supabase: SupabaseClient,
  userId: string,
  tsb: number,
  ctl: number,
  atl: number
): Promise<Insight[]> {
  const insights: Insight[] = []

  // Fetch recent runs for analysis
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data: recentRuns } = await supabase
    .from('runs')
    .select('scheduled_date, actual_distance, rpe, run_type, average_hr')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('scheduled_date', fourteenDaysAgo.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })

  if (!recentRuns || recentRuns.length === 0) {
    return insights
  }

  // 1. Overtraining Risk Detection
  if (tsb < -30) {
    insights.push({
      type: 'danger',
      category: 'overtraining',
      title: 'High Overtraining Risk Detected',
      description: `Your Training Stress Balance (TSB) is ${tsb.toFixed(1)}, indicating very high fatigue levels. You've been training hard without adequate recovery.`,
      recommendation: 'Take 2-3 easy days or a complete rest day. Reduce training volume by 30-40% this week. Focus on sleep, nutrition, and hydration.',
      priority: 'high',
    })
  } else if (tsb < -20) {
    insights.push({
      type: 'warning',
      category: 'overtraining',
      title: 'Elevated Fatigue Levels',
      description: `Your TSB is ${tsb.toFixed(1)}, showing significant accumulated fatigue. While building fitness, you need to monitor recovery closely.`,
      recommendation: 'Include at least one easy recovery run this week. Ensure 8+ hours of sleep. Consider a rest day if feeling unusually tired.',
      priority: 'medium',
    })
  }

  // 2. High RPE Streak Detection
  const highRPERuns = recentRuns.filter(r => r.rpe && r.rpe >= 8)
  if (highRPERuns.length >= 3) {
    const consecutiveHigh = checkConsecutiveHighRPE(recentRuns)
    if (consecutiveHigh >= 3) {
      insights.push({
        type: 'warning',
        category: 'recovery',
        title: 'Consecutive High-Intensity Runs Detected',
        description: `You've completed ${consecutiveHigh} consecutive runs with RPE ≥ 8. This pattern increases injury risk and can lead to burnout.`,
        recommendation: 'Schedule at least 2 easy runs (RPE 4-6) before your next hard workout. Follow the hard-easy principle.',
        priority: 'high',
      })
    }
  }

  // 3. Sudden Mileage Increase (Injury Risk)
  const weeklyMileage = calculateWeeklyMileage(recentRuns)
  if (weeklyMileage.length >= 2) {
    const lastWeek = weeklyMileage[weeklyMileage.length - 1]
    const previousWeek = weeklyMileage[weeklyMileage.length - 2]
    const increasePercent = ((lastWeek - previousWeek) / previousWeek) * 100

    if (increasePercent > 20) {
      insights.push({
        type: 'warning',
        category: 'injury_risk',
        title: 'Rapid Mileage Increase Detected',
        description: `Your weekly mileage increased by ${increasePercent.toFixed(0)}% (from ${previousWeek.toFixed(1)}km to ${lastWeek.toFixed(1)}km). The 10% rule suggests limiting increases to 10% per week.`,
        recommendation: 'Reduce mileage this week to allow your body to adapt. Increase gradually by no more than 10% per week.',
        priority: 'high',
      })
    }
  }

  // 4. Performance Improvement Detection
  const { data: recentPBs } = await supabase
    .from('personal_bests')
    .select('distance, achieved_date')
    .eq('user_id', userId)
    .gte('achieved_date', fourteenDaysAgo.toISOString().split('T')[0])

  if (recentPBs && recentPBs.length > 0) {
    insights.push({
      type: 'success',
      category: 'performance',
      title: 'New Personal Best Achieved!',
      description: `Congratulations! You set ${recentPBs.length} new personal best(s) in the last 2 weeks. Your training is paying off!`,
      recommendation: 'Great work! Consider a recovery week to consolidate these gains before pushing for more improvements.',
      priority: 'low',
    })
  }

  // 5. Training Consistency Check
  const daysWithRuns = new Set(recentRuns.map(r => r.scheduled_date)).size
  if (daysWithRuns < 4 && recentRuns.length < 5) {
    insights.push({
      type: 'info',
      category: 'consistency',
      title: 'Low Training Consistency',
      description: `You've only completed ${recentRuns.length} runs in the last 14 days. Consistency is key for improvement.`,
      recommendation: 'Try to maintain at least 3-4 runs per week. Even short, easy runs help build consistency and aerobic base.',
      priority: 'medium',
    })
  }

  // 6. Excellent Form Detection
  if (tsb > 10 && tsb < 25 && ctl > 50) {
    insights.push({
      type: 'success',
      category: 'performance',
      title: 'Peak Form Detected',
      description: `Your TSB is ${tsb.toFixed(1)} with CTL of ${ctl.toFixed(1)}. You're fresh and fit - perfect racing form!`,
      recommendation: 'This is an excellent time for a race or hard workout. Your fitness is high and fatigue is low.',
      priority: 'high',
    })
  }

  return insights
}

function checkConsecutiveHighRPE(runs: RunData[]): number {
  let maxConsecutive = 0
  let currentConsecutive = 0

  for (const run of runs) {
    if (run.rpe && run.rpe >= 8) {
      currentConsecutive++
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
    } else {
      currentConsecutive = 0
    }
  }

  return maxConsecutive
}

function calculateWeeklyMileage(runs: RunData[]): number[] {
  const weeklyTotals: Map<string, number> = new Map()

  runs.forEach(run => {
    if (run.actual_distance) {
      const date = new Date(run.scheduled_date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0]

      weeklyTotals.set(weekKey, (weeklyTotals.get(weekKey) || 0) + run.actual_distance)
    }
  })

  return Array.from(weeklyTotals.values())
}

