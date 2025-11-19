/**
 * VDOT Calculator based on Jack Daniels' Running Formula
 * VDOT is a measure of running ability that accounts for both VO2 max and running economy
 */

/**
 * Convert time string (HH:MM:SS or MM:SS) to seconds
 */
export function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

/**
 * Convert seconds to time string (HH:MM:SS or MM:SS)
 */
export function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate VDOT from race performance
 * @param distanceKm - Distance in kilometers
 * @param timeSeconds - Time in seconds
 * @returns VDOT value
 */
export function calculateVDOT(distanceKm: number, timeSeconds: number): number {
  const distanceMeters = distanceKm * 1000
  const timeMinutes = timeSeconds / 60

  // Oxygen cost of running (ml/kg/min)
  const velocity = distanceMeters / timeMinutes // meters per minute
  const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) + 0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  
  const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity

  const vdot = vo2 / percentMax

  return Math.round(vdot * 10) / 10
}

/**
 * Predict race time for a given distance based on VDOT
 * @param vdot - VDOT value
 * @param distanceKm - Target distance in kilometers
 * @returns Predicted time in seconds
 */
export function predictTime(vdot: number, distanceKm: number): number {
  const distanceMeters = distanceKm * 1000

  // Binary search to find the time that gives the target VDOT
  let low = 60 // 1 minute minimum
  let high = 36000 // 10 hours maximum
  let bestTime = high

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    const calculatedVDOT = calculateVDOT(distanceKm, mid)

    if (Math.abs(calculatedVDOT - vdot) < 0.1) {
      bestTime = mid
      break
    }

    if (calculatedVDOT > vdot) {
      low = mid
    } else {
      high = mid
    }
  }

  return bestTime
}

/**
 * Calculate training paces based on VDOT
 */
export function calculateTrainingPaces(vdot: number) {
  // Easy pace (65-79% of VDOT)
  const easyPaceSeconds = predictTime(vdot * 0.72, 1) // per km
  
  // Marathon pace (80-90% of VDOT)
  const marathonPaceSeconds = predictTime(vdot * 0.85, 1)
  
  // Threshold pace (83-88% of VDOT)
  const thresholdPaceSeconds = predictTime(vdot * 0.855, 1)
  
  // Interval pace (95-100% of VDOT)
  const intervalPaceSeconds = predictTime(vdot * 0.975, 1)
  
  // Repetition pace (105-120% of VDOT)
  const repetitionPaceSeconds = predictTime(vdot * 1.1, 1)

  return {
    easy: secondsToTime(easyPaceSeconds),
    marathon: secondsToTime(marathonPaceSeconds),
    threshold: secondsToTime(thresholdPaceSeconds),
    interval: secondsToTime(intervalPaceSeconds),
    repetition: secondsToTime(repetitionPaceSeconds),
  }
}

/**
 * Get race predictions for standard distances
 */
export function getRacePredictions(vdot: number) {
  return {
    '5K': secondsToTime(predictTime(vdot, 5)),
    '10K': secondsToTime(predictTime(vdot, 10)),
    'Half Marathon': secondsToTime(predictTime(vdot, 21.0975)),
    'Marathon': secondsToTime(predictTime(vdot, 42.195)),
  }
}

/**
 * Calculate VDOT from recent performances
 * Takes the best performance from the last 30 days
 */
export function calculateVDOTFromRuns(runs: Array<{ actual_distance: number; actual_time: string; scheduled_date: string }>) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentRuns = runs.filter(run => {
    const runDate = new Date(run.scheduled_date)
    return runDate >= thirtyDaysAgo && run.actual_time
  })

  if (recentRuns.length === 0) return null

  // Calculate VDOT for each run and take the highest
  const vdots = recentRuns.map(run => {
    const timeSeconds = timeToSeconds(run.actual_time)
    return calculateVDOT(run.actual_distance, timeSeconds)
  })

  return Math.max(...vdots)
}

