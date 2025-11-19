import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch recent completed runs
    const { data: runs } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('scheduled_date', { ascending: false })
      .limit(20)

    if (!runs || runs.length === 0) {
      return NextResponse.json({ predictions: [] })
    }

    // Calculate VDOT and race predictions using Riegel formula
    const predictions = calculateRacePredictions(runs)

    return NextResponse.json({ predictions })
  } catch (error) {
    console.error('Predictions error:', error)
    return NextResponse.json({ error: 'Failed to generate predictions' }, { status: 500 })
  }
}

function calculateRacePredictions(runs: any[]) {
  // Find best recent performances
  const bestRuns = runs
    .filter(r => r.actual_distance && r.actual_time)
    .sort((a, b) => {
      const paceA = parseTime(a.actual_time) / a.actual_distance
      const paceB = parseTime(b.actual_time) / b.actual_distance
      return paceA - paceB
    })
    .slice(0, 5)

  if (bestRuns.length === 0) return []

  // Use Riegel formula: T2 = T1 * (D2/D1)^1.06
  const baseRun = bestRuns[0]
  const baseTime = parseTime(baseRun.actual_time)
  const baseDistance = baseRun.actual_distance

  const distances = [
    { name: '5K', distance: 5 },
    { name: '10K', distance: 10 },
    { name: 'Half Marathon', distance: 21.0975 },
    { name: 'Marathon', distance: 42.195 },
  ]

  return distances.map(d => {
    const predictedTime = baseTime * Math.pow(d.distance / baseDistance, 1.06)
    const pace = predictedTime / d.distance / 60 // min/km
    
    return {
      distance: d.name,
      predictedTime: formatTime(predictedTime),
      pace: formatPace(pace),
    }
  })
}

function parseTime(timeStr: string): number {
  // Parse "XX minutes" or "HH:MM:SS" format to seconds
  if (timeStr.includes('minutes')) {
    return parseInt(timeStr) * 60
  }
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatPace(minPerKm: number): string {
  const minutes = Math.floor(minPerKm)
  const seconds = Math.floor((minPerKm - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

