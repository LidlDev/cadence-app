import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Updates best performances table when a new run is logged
 * Checks if the run qualifies as a top 3 performance for its distance
 */
export async function updateBestPerformances(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
  distance: number,
  time: string,
  pace: string,
  date: string
) {
  // Map distance to standard categories
  const distanceMap: { [key: number]: string } = {
    1: '1K',
    5: '5K',
    10: '10K',
    21.1: 'Half Marathon',
    21.0975: 'Half Marathon', // Alternative half marathon distance
    42.2: 'Marathon',
    42.195: 'Marathon', // Official marathon distance
  }

  const standardDistance = distanceMap[distance]
  if (!standardDistance) {
    // Not a standard distance, skip
    return
  }

  // Convert time to seconds for comparison
  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number)
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    }
    return 0
  }

  const newTimeSeconds = timeToSeconds(time)
  if (newTimeSeconds === 0) return

  // Get existing performances for this distance
  const { data: existingPerfs, error: fetchError } = await supabase
    .from('best_performances')
    .select('*')
    .eq('user_id', userId)
    .eq('distance', standardDistance)
    .order('rank', { ascending: true })

  if (fetchError) {
    console.error('Error fetching best performances:', fetchError)
    return
  }

  // Check if this performance qualifies for top 3
  const performances = existingPerfs || []
  const performanceTimes = performances.map((p) => ({
    ...p,
    seconds: timeToSeconds(p.time),
  }))

  // Add new performance
  performanceTimes.push({
    id: null,
    run_id: runId,
    user_id: userId,
    distance: standardDistance,
    time,
    pace,
    date,
    rank: 0,
    seconds: newTimeSeconds,
    created_at: new Date().toISOString(),
  })

  // Sort by time (fastest first)
  performanceTimes.sort((a, b) => a.seconds - b.seconds)

  // Keep only top 3
  const top3 = performanceTimes.slice(0, 3)

  // Delete all existing performances for this distance
  if (performances.length > 0) {
    await supabase
      .from('best_performances')
      .delete()
      .eq('user_id', userId)
      .eq('distance', standardDistance)
  }

  // Insert top 3 with updated ranks
  const insertData = top3.map((perf, index) => ({
    user_id: userId,
    run_id: perf.run_id,
    distance: standardDistance,
    time: perf.time,
    pace: perf.pace,
    date: perf.date,
    rank: index + 1,
  }))

  const { error: insertError } = await supabase
    .from('best_performances')
    .insert(insertData)

  if (insertError) {
    console.error('Error inserting best performances:', insertError)
  }
}

