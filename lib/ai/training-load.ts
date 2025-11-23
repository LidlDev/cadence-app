import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Training Load Calculation Utilities
 * 
 * Implements Training Stress Score (TSS) and related metrics:
 * - TSS: Training Stress Score for each workout
 * - CTL: Chronic Training Load (42-day rolling average) - Fitness
 * - ATL: Acute Training Load (7-day rolling average) - Fatigue
 * - TSB: Training Stress Balance (CTL - ATL) - Form
 */

interface RunData {
  scheduled_date: string
  actual_distance: number | null
  actual_time: string | null
  rpe: number | null
  run_type: string
  average_hr: number | null
  max_hr: number | null
}

/**
 * Calculate Training Stress Score (TSS) for a run
 * 
 * TSS is calculated using multiple methods and averaged:
 * 1. RPE-based: (Duration in hours × RPE × 10)
 * 2. Distance-based: Distance × intensity factor
 * 3. HR-based: If HR data available
 */
export function calculateTSS(run: RunData, userMaxHR?: number): number {
  let tssScores: number[] = []

  // Method 1: RPE-based TSS (most reliable when available)
  if (run.rpe && run.actual_time) {
    const durationHours = parseInterval(run.actual_time) / 3600
    const rpeTSS = durationHours * run.rpe * 10
    tssScores.push(rpeTSS)
  }

  // Method 2: Distance and run type based
  if (run.actual_distance) {
    const intensityFactors: Record<string, number> = {
      'Easy Run': 0.6,
      'Long Run': 0.7,
      'Tempo Run': 0.85,
      'Quality Run': 0.95,
    }
    const intensity = intensityFactors[run.run_type] || 0.7
    const distanceTSS = run.actual_distance * intensity * 10
    tssScores.push(distanceTSS)
  }

  // Method 3: HR-based TSS (if available)
  if (run.average_hr && userMaxHR && run.actual_time) {
    const durationHours = parseInterval(run.actual_time) / 3600
    const hrRatio = run.average_hr / userMaxHR
    const hrTSS = durationHours * hrRatio * 100
    tssScores.push(hrTSS)
  }

  // Return average of available methods, or 0 if none available
  return tssScores.length > 0
    ? tssScores.reduce((sum, score) => sum + score, 0) / tssScores.length
    : 0
}

/**
 * Parse PostgreSQL interval to seconds
 */
function parseInterval(interval: string): number {
  // Format: "HH:MM:SS" or "MM:SS"
  const parts = interval.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

/**
 * Calculate Chronic Training Load (CTL) - 42-day exponentially weighted average
 * Represents long-term fitness
 */
export function calculateCTL(dailyTSS: Map<string, number>, targetDate: Date): number {
  const ctl_time_constant = 42
  let ctl = 0

  // Calculate exponentially weighted moving average
  for (let i = 0; i < 42; i++) {
    const date = new Date(targetDate)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const tss = dailyTSS.get(dateStr) || 0
    
    // Exponential weighting: more recent days have more weight
    const weight = Math.exp(-i / ctl_time_constant)
    ctl += tss * weight
  }

  return ctl / 42
}

/**
 * Calculate Acute Training Load (ATL) - 7-day exponentially weighted average
 * Represents short-term fatigue
 */
export function calculateATL(dailyTSS: Map<string, number>, targetDate: Date): number {
  const atl_time_constant = 7
  let atl = 0

  for (let i = 0; i < 7; i++) {
    const date = new Date(targetDate)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const tss = dailyTSS.get(dateStr) || 0
    
    const weight = Math.exp(-i / atl_time_constant)
    atl += tss * weight
  }

  return atl / 7
}

/**
 * Calculate Training Stress Balance (TSB)
 * TSB = CTL - ATL
 * 
 * Interpretation:
 * - TSB > 25: Very fresh, possibly losing fitness
 * - TSB 10-25: Fresh, good for racing
 * - TSB -10 to 10: Neutral, normal training
 * - TSB -30 to -10: Fatigued, building fitness
 * - TSB < -30: Very fatigued, overtraining risk
 */
export function calculateTSB(ctl: number, atl: number): number {
  return ctl - atl
}

/**
 * Get form status based on TSB
 */
export function getFormStatus(tsb: number): {
  status: string
  description: string
  color: string
} {
  if (tsb > 25) {
    return {
      status: 'Very Fresh',
      description: 'Well rested, possibly losing fitness. Good time for a race or hard workout.',
      color: 'green',
    }
  } else if (tsb > 10) {
    return {
      status: 'Fresh',
      description: 'Good form for racing or quality workouts.',
      color: 'lightgreen',
    }
  } else if (tsb > -10) {
    return {
      status: 'Neutral',
      description: 'Normal training state. Balance of fitness and fatigue.',
      color: 'yellow',
    }
  } else if (tsb > -30) {
    return {
      status: 'Fatigued',
      description: 'Building fitness but accumulating fatigue. Monitor recovery.',
      color: 'orange',
    }
  } else {
    return {
      status: 'Very Fatigued',
      description: 'High overtraining risk. Prioritize recovery.',
      color: 'red',
    }
  }
}

