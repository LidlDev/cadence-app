/**
 * Training Phase Detection and Analysis
 * Identifies which phase of training the user is in and provides phase-specific guidance
 */

export interface TrainingPhase {
  phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'unknown'
  weekInPhase: number
  totalWeeksInPhase: number
  description: string
  focus: string
  recommendations: string[]
}

/**
 * Detect current training phase based on plan structure and timing
 */
export function detectTrainingPhase(
  trainingPlan: any,
  currentWeek: number,
  runs: any[]
): TrainingPhase {
  if (!trainingPlan) {
    return {
      phase: 'unknown',
      weekInPhase: 0,
      totalWeeksInPhase: 0,
      description: 'No active training plan',
      focus: 'General fitness',
      recommendations: ['Create a structured training plan to optimize your progress'],
    }
  }

  const totalWeeks = trainingPlan.weeks
  const weeksRemaining = totalWeeks - currentWeek + 1

  // Analyze run intensity and volume patterns
  const recentRuns = runs.filter((r: any) => 
    r.week_number >= currentWeek - 2 && r.week_number <= currentWeek
  )

  const avgDistance = recentRuns.reduce((sum: number, r: any) => 
    sum + (r.planned_distance || 0), 0
  ) / (recentRuns.length || 1)

  const qualityRunCount = recentRuns.filter((r: any) => 
    r.run_type === 'Tempo Run' || r.run_type === 'Quality Run' || r.run_type === 'Intervals'
  ).length

  // Phase detection logic
  if (weeksRemaining <= 2) {
    // Taper phase - last 1-2 weeks before race
    return {
      phase: 'taper',
      weekInPhase: 3 - weeksRemaining,
      totalWeeksInPhase: 2,
      description: 'Taper - Race preparation phase',
      focus: 'Reduce volume, maintain intensity, maximize recovery',
      recommendations: [
        'Reduce weekly mileage by 40-60%',
        'Keep 1-2 short quality sessions to maintain sharpness',
        'Prioritize sleep and recovery',
        'Practice race-day nutrition and pacing',
        'Trust your training - avoid last-minute hard workouts',
      ],
    }
  } else if (weeksRemaining <= 4 && qualityRunCount >= 2) {
    // Peak phase - high intensity, moderate volume
    return {
      phase: 'peak',
      weekInPhase: 5 - weeksRemaining,
      totalWeeksInPhase: 3,
      description: 'Peak - Race-specific training',
      focus: 'Race-pace work, lactate threshold, speed endurance',
      recommendations: [
        'Include race-pace intervals in workouts',
        'Practice goal race pace in tempo runs',
        'Maintain high intensity but watch for overtraining',
        'Include race-specific workouts (e.g., marathon pace runs)',
        'Monitor recovery carefully - TSB should stay above -20',
      ],
    }
  } else if (currentWeek <= totalWeeks * 0.4) {
    // Base phase - first 40% of plan
    return {
      phase: 'base',
      weekInPhase: currentWeek,
      totalWeeksInPhase: Math.ceil(totalWeeks * 0.4),
      description: 'Base Building - Aerobic foundation',
      focus: 'Build aerobic base, increase weekly mileage gradually',
      recommendations: [
        'Focus on easy runs in Zone 2 (60-70% max HR)',
        'Increase weekly mileage by no more than 10%',
        'Include 1 long run per week',
        'Limit quality work to 1 session per week',
        'Build consistency - aim for 4-5 runs per week',
        'Focus on time on feet rather than pace',
      ],
    }
  } else if (currentWeek <= totalWeeks * 0.75) {
    // Build phase - middle 35% of plan
    return {
      phase: 'build',
      weekInPhase: currentWeek - Math.ceil(totalWeeks * 0.4),
      totalWeeksInPhase: Math.ceil(totalWeeks * 0.35),
      description: 'Build - Strength and speed development',
      focus: 'Increase intensity, develop lactate threshold, build strength',
      recommendations: [
        'Include 2 quality sessions per week (tempo, intervals, hills)',
        'Maintain or slightly increase weekly mileage',
        'Focus on tempo runs at lactate threshold pace',
        'Add hill repeats for strength',
        'Include recovery runs between hard efforts',
        'Monitor fatigue - take rest days as needed',
      ],
    }
  } else {
    // Default to build if unclear
    return {
      phase: 'build',
      weekInPhase: currentWeek - Math.ceil(totalWeeks * 0.4),
      totalWeeksInPhase: Math.ceil(totalWeeks * 0.35),
      description: 'Build - Strength and speed development',
      focus: 'Increase intensity, develop lactate threshold',
      recommendations: [
        'Include 2 quality sessions per week',
        'Balance hard efforts with recovery',
        'Monitor training load carefully',
      ],
    }
  }
}

/**
 * Get phase-specific workout recommendations
 */
export function getPhaseWorkoutRecommendations(phase: TrainingPhase): {
  easyRunPercent: number
  qualityRunsPerWeek: number
  longRunDistance: string
  intensityFocus: string
} {
  switch (phase.phase) {
    case 'base':
      return {
        easyRunPercent: 85,
        qualityRunsPerWeek: 1,
        longRunDistance: '20-25% of weekly mileage',
        intensityFocus: 'Zone 2 aerobic work, occasional tempo',
      }
    case 'build':
      return {
        easyRunPercent: 75,
        qualityRunsPerWeek: 2,
        longRunDistance: '25-30% of weekly mileage',
        intensityFocus: 'Tempo runs, hill repeats, threshold work',
      }
    case 'peak':
      return {
        easyRunPercent: 70,
        qualityRunsPerWeek: 2,
        longRunDistance: '30% of weekly mileage with race-pace segments',
        intensityFocus: 'Race-pace intervals, VO2max work, speed endurance',
      }
    case 'taper':
      return {
        easyRunPercent: 90,
        qualityRunsPerWeek: 1,
        longRunDistance: 'Reduce to 50-60% of peak long run',
        intensityFocus: 'Short race-pace efforts to maintain sharpness',
      }
    default:
      return {
        easyRunPercent: 80,
        qualityRunsPerWeek: 1,
        longRunDistance: '20-25% of weekly mileage',
        intensityFocus: 'Balanced training',
      }
  }
}

