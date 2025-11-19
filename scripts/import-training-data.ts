/**
 * Script to import training data from your spreadsheet to Supabase
 * 
 * Usage:
 * 1. Set up your .env.local file with Supabase credentials
 * 2. Run: npx tsx scripts/import-training-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Your training data from the spreadsheet
const trainingData = [
  // Week 1-4: Base + Fartlek
  { week: 1, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 6, pace: '6:40', date: '2024-11-03', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 1, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 6, pace: '6:00', date: '2024-11-05', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 1, day: 'Fri', type: 'Quality Run', session: 'Quality Run', distance: 6, pace: '5:15', date: '2024-11-07', notes: 'Full amazing during the run, leant into the new stride', completed: true, actual: '6.8km Sub 5/km 6x1km @pace' },
  { week: 1, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 12, pace: '6:50', date: '2024-11-09', notes: '36 first, extreme fatigue at 7.5km', completed: true, actual: 'Ran 7.5km avg 6:30/km' },
  
  { week: 2, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 6, pace: '6:38', date: '2024-11-10', notes: 'Truly easy run felt really', completed: true, actual: '6km 6:53/km 1:06/kg heart' },
  { week: 2, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 9, pace: '5:58', date: '2024-11-12', notes: 'It felt awesome, good speed pace and felt lots of spring energy', completed: true, actual: '9km 5:58/km avg' },
  { week: 2, day: 'Fri', type: 'Quality Run', session: 'Quality Run', distance: 6, pace: '5:12', date: '2024-11-14', notes: 'Run was great, working on forward lean. Got made me sick into 5th km and 6th km', completed: true, actual: '6.67km 4:30-5:15/km' },
  { week: 2, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 13, pace: '6:45', date: '2024-11-16', notes: 'Felt good in Zone 2, more than 13km', completed: true, actual: '13km 6:33/km avg in Zone 2' },
  
  { week: 3, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 6, pace: '6:35', date: '2024-11-17', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 3, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 8, pace: '5:55', date: '2024-11-19', notes: 'Tempo run to watch pace' },
  { week: 3, day: 'Fri', type: 'Quality Run', session: 'Fartlek', distance: 7, pace: '5:10', date: '2024-11-21', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 3, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 14, pace: '6:40', date: '2024-11-23', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 4, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 7, pace: '6:33', date: '2024-11-24', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 4, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 8, pace: '5:52', date: '2024-11-26', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 4, day: 'Fri', type: 'Quality Run', session: 'Quality Run', distance: 7, pace: '5:08', date: '2024-11-28', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 4, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 15, pace: '6:35', date: '2024-11-30', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  // Week 5-8: Performance Build + Speed Endurance
  { week: 5, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 7, pace: '6:30', date: '2024-12-01', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 5, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 8, pace: '5:50', date: '2024-12-03', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 5, day: 'Fri', type: 'Quality Run', session: 'Intervals', distance: 7, pace: '5:05', date: '2024-12-05', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 5, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 16, pace: '6:30', date: '2024-12-07', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 6, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 7, pace: '6:28', date: '2024-12-08', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 6, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 7, pace: '5:48', date: '2024-12-10', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 6, day: 'Fri', type: 'Quality Run', session: 'Fartlek', distance: 7, pace: '5:03', date: '2024-12-12', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 6, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 17, pace: '6:25', date: '2024-12-14', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 7, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 7, pace: '6:25', date: '2024-12-15', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 7, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 7, pace: '5:45', date: '2024-12-17', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 7, day: 'Fri', type: 'Quality Run', session: 'Intervals', distance: 7, pace: '5:00', date: '2024-12-19', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 7, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 18, pace: '6:20', date: '2024-12-21', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 8, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 7, pace: '6:23', date: '2024-12-23', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 8, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 7, pace: '5:43', date: '2024-12-25', notes: 'Steady tempo run, RPE 7. Include VDOT' },
  { week: 8, day: 'Fri', type: 'Quality Run', session: 'Hills', distance: 7, pace: '4:58', date: '2024-12-27', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 8, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 19, pace: '6:18', date: '2024-12-28', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  // Week 9-12: Race Peak + Taper
  { week: 9, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 8, pace: '6:20', date: '2024-12-29', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 9, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 8, pace: '5:42', date: '2024-12-31', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 9, day: 'Fri', type: 'Quality Run', session: 'Fartlek', distance: 8, pace: '4:57', date: '2025-01-02', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 9, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 20, pace: '6:10', date: '2025-01-04', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 10, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 8, pace: '6:18', date: '2025-01-05', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 10, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 8, pace: '5:40', date: '2025-01-07', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 10, day: 'Fri', type: 'Quality Run', session: 'Intervals', distance: 8, pace: '4:55', date: '2025-01-09', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 10, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 21, pace: '6:05', date: '2025-01-11', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 11, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 8, pace: '6:15', date: '2025-01-12', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
  { week: 11, day: 'Wed', type: 'Tempo Run', session: 'Tempo Run', distance: 8, pace: '5:40', date: '2025-01-14', notes: 'Steady tempo run, RPE 7, focus on breathing' },
  { week: 11, day: 'Fri', type: 'Quality Run', session: 'Intervals', distance: 8, pace: '4:55', date: '2025-01-16', notes: 'Alternate intensity: Fartlek 45 min (2 min on/off) | Hills 6×200 m | Intervals 6×1 km @ pace' },
  { week: 11, day: 'Sun', type: 'Long Run', session: 'Long Run', distance: 14, pace: '6:00', date: '2025-01-18', notes: 'Endurance build, RPE 6. Negative split last 3 km' },
  
  { week: 12, day: 'Mon', type: 'Easy Run', session: 'Easy Run', distance: 8, pace: '6:15', date: '2025-01-19', notes: 'Relaxed aerobic run, RPE 4-6, focus on cadence & breathing' },
]

async function importData() {
  console.log('Starting data import...')

  // First, create a training plan
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      name: 'Half Marathon Training - 12 Weeks',
      goal_race: 'Half Marathon',
      goal_distance: 21.0975,
      goal_time: '01:45:00',
      start_date: '2024-11-03',
      end_date: '2025-01-19',
      weeks: 12,
      status: 'active',
    })
    .select()
    .single()

  if (planError) {
    console.error('Error creating training plan:', planError)
    return
  }

  console.log('Training plan created:', plan.id)

  // Import runs
  const runs = trainingData.map(run => ({
    training_plan_id: plan.id,
    week_number: run.week,
    day_of_week: run.day,
    run_type: run.type,
    session_type: run.session,
    planned_distance: run.distance,
    target_pace: run.pace,
    scheduled_date: run.date,
    notes: run.notes,
    completed: run.completed || false,
    comments: run.actual || null,
  }))

  const { data: insertedRuns, error: runsError } = await supabase
    .from('runs')
    .insert(runs)
    .select()

  if (runsError) {
    console.error('Error importing runs:', runsError)
    return
  }

  console.log(`Successfully imported ${insertedRuns.length} runs!`)
}

importData()

