import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Helper function to parse CSV
function parseCSV(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`)
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim())

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    return obj
  })
}

async function migrateAllData() {
  console.log('🚀 Starting comprehensive data migration...\n')

  // Get the authenticated user
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError || !users || users.length === 0) {
    console.error('❌ No users found. Please create an account first.')
    console.log('   1. Run: npm run dev')
    console.log('   2. Visit: http://localhost:3000/login')
    console.log('   3. Sign up with your email')
    console.log('   4. Run this script again')
    return
  }

  const userId = users[0].id
  console.log(`✅ Found user: ${users[0].email} (${userId})\n`)

  // Create training plan
  console.log('📋 Creating training plan...')
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .upsert({
      user_id: userId,
      name: '12-Week Half Marathon Training Plan',
      goal_race: 'Half Marathon',
      goal_distance: 21.1,
      goal_time: '01:45:00',
      start_date: '2024-11-03',
      end_date: '2025-01-26',
      weeks: 12,
      status: 'active'
    })
    .select()
    .single()

  if (planError) {
    console.error('❌ Error creating training plan:', planError)
    return
  }

  console.log(`✅ Training plan created: ${plan.name}\n`)

  // Import all data
  await importRunsFromData(userId, plan.id)
  await importNutritionFromData(userId)
  await importStrengthFromData(userId)
  await setPersonalBests(userId)

  console.log('\n🎉 Migration complete!')
  console.log('   Visit http://localhost:3000/dashboard to see your data')
}

async function importRunsFromData(userId: string, planId: string) {
  console.log('🏃 Importing runs data from your spreadsheet...')

  // Based on your screenshot, here's the complete 12-week plan
  const runsData = [
    // WEEKS 1-4: Aerobic Base + Fat Utilization
    { week: 1, day: 'Mon', type: 'Easy Run', distance: 6, target_pace: '6:45', scheduled_date: '2024-11-03', completed: true, actual_distance: 7.03, actual_pace: '6:50', notes: 'Relaxed aerobic run. RPE 6-8, focus on cadence & breathing.', phase: 'Base + Fartlek' },
    { week: 1, day: 'Wed', type: 'Tempo Run', distance: 8, target_pace: '6:00', scheduled_date: '2024-11-06', completed: true, actual_distance: 8.67, actual_pace: '6:07', notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Base + Fartlek' },
    { week: 1, day: 'Fri', type: 'Quality Run', distance: 6, target_pace: '5:12', scheduled_date: '2024-11-08', completed: false, notes: 'Full amazing session. Lift 6km. Felt amazing and the new stride.', phase: 'Base + Fartlek' },
    { week: 1, day: 'Sun', type: 'Long Run', distance: 13, target_pace: '6:50', scheduled_date: '2024-11-10', completed: true, actual_distance: 13, actual_pace: '6:33', notes: '8km 7:35/km lift 6km, extreme heat. Relaxed the run and had to walk and take lots of sips.', phase: 'Base + Fartlek' },

    { week: 2, day: 'Mon', type: 'Easy Run', distance: 6, target_pace: '6:38', scheduled_date: '2024-11-11', completed: false, notes: '6km 7:05/km (slow easy run)', phase: 'Base + Fartlek' },
    { week: 2, day: 'Wed', type: 'Tempo Run', distance: 9, target_pace: '5:58', scheduled_date: '2024-11-13', completed: false, notes: '9km 5:44/km avg. It felt awesome, good speed patches. Slowed down and did lots of sprints to help Passion 6.', phase: 'Base + Fartlek' },
    { week: 2, day: 'Fri', type: 'Quality Run', distance: 6, target_pace: '5:12', scheduled_date: '2024-11-15', completed: false, notes: '6.87km 4:45. 4.5 5km. Ran with working on forward lean. Got major me and lateral.', phase: 'Base + Fartlek' },
    { week: 2, day: 'Sun', type: 'Long Run', distance: 13, target_pace: '6:45', scheduled_date: '2024-11-17', completed: true, actual_distance: 13, actual_pace: '6:33', notes: '13km 6:33/km HR in Zone 2. Felt super solid at a higher pace than usual and felt literally easy.', phase: 'Base + Fartlek' },

    { week: 3, day: 'Mon', type: 'Easy Run', distance: 6, target_pace: '6:35', scheduled_date: '2024-11-18', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Base + Fartlek' },
    { week: 3, day: 'Wed', type: 'Tempo Run', distance: 9, target_pace: '5:55', scheduled_date: '2024-11-20', completed: true, actual_distance: 9, actual_pace: '5:30', notes: '9km 4:30/km avg. Treadmill run, pace on watch study off.', phase: 'Base + Fartlek' },
    { week: 3, day: 'Fri', type: 'Quality Run', distance: 'Fartlek', target_pace: '5:10', scheduled_date: '2024-11-22', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Base + Fartlek' },
    { week: 3, day: 'Sun', type: 'Long Run', distance: 14, target_pace: '6:40', scheduled_date: '2024-11-24', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Base + Fartlek' },

    { week: 4, day: 'Mon', type: 'Easy Run', distance: 7, target_pace: '6:33', scheduled_date: '2024-11-25', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Base + Fartlek' },
    { week: 4, day: 'Wed', type: 'Tempo Run', distance: 9, target_pace: '5:52', scheduled_date: '2024-11-27', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Base + Fartlek' },
    { week: 4, day: 'Fri', type: 'Quality Run', distance: 'Hills', target_pace: '5:08', scheduled_date: '2024-11-29', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Base + Fartlek' },
    { week: 4, day: 'Sun', type: 'Long Run', distance: 15, target_pace: '6:38', scheduled_date: '2024-12-01', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Base + Fartlek' },

    // WEEKS 5-8: Performance Build + Speed Endurance
    { week: 5, day: 'Mon', type: 'Easy Run', distance: 7, target_pace: '6:30', scheduled_date: '2024-12-02', completed: false, notes: 'Relaxed aerobic run. RPE 6-8, focus on cadence & breathing.', phase: 'Performance Build' },
    { week: 5, day: 'Wed', type: 'Tempo Run', distance: 9, target_pace: '5:50', scheduled_date: '2024-12-04', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Performance Build' },
    { week: 5, day: 'Fri', type: 'Quality Run', distance: 'Intervals', target_pace: '5:05', scheduled_date: '2024-12-06', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Performance Build' },
    { week: 5, day: 'Sun', type: 'Long Run', distance: 16, target_pace: '6:30', scheduled_date: '2024-12-08', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Performance Build' },

    { week: 6, day: 'Mon', type: 'Easy Run', distance: 7, target_pace: '6:28', scheduled_date: '2024-12-09', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Performance Build' },
    { week: 6, day: 'Wed', type: 'Tempo Run', distance: 7, target_pace: '5:48', scheduled_date: '2024-12-11', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Performance Build' },
    { week: 6, day: 'Fri', type: 'Quality Run', distance: 'Fartlek', target_pace: '5:03', scheduled_date: '2024-12-13', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Performance Build' },
    { week: 6, day: 'Sun', type: 'Long Run', distance: 17, target_pace: '6:25', scheduled_date: '2024-12-15', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Performance Build' },

    { week: 7, day: 'Mon', type: 'Easy Run', distance: 7, target_pace: '6:25', scheduled_date: '2024-12-16', completed: false, notes: 'Relaxed aerobic run. RPE 6-8, focus on cadence & breathing.', phase: 'Performance Build' },
    { week: 7, day: 'Wed', type: 'Tempo Run', distance: 7, target_pace: '5:45', scheduled_date: '2024-12-18', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Performance Build' },
    { week: 7, day: 'Fri', type: 'Quality Run', distance: 'Intervals', target_pace: '5:00', scheduled_date: '2024-12-20', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Performance Build' },
    { week: 7, day: 'Sun', type: 'Long Run', distance: 18, target_pace: '6:20', scheduled_date: '2024-12-22', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Performance Build' },

    { week: 8, day: 'Mon', type: 'Easy Run', distance: 8, target_pace: '6:23', scheduled_date: '2024-12-23', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Performance Build' },
    { week: 8, day: 'Wed', type: 'Tempo Run', distance: 7, target_pace: '5:43', scheduled_date: '2024-12-25', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Performance Build' },
    { week: 8, day: 'Fri', type: 'Quality Run', distance: 'Hills', target_pace: '4:58', scheduled_date: '2024-12-27', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Performance Build' },
    { week: 8, day: 'Sun', type: 'Long Run', distance: 18, target_pace: '6:15', scheduled_date: '2024-12-29', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Performance Build' },

    // WEEKS 9-12: Race Peak + Taper
    { week: 9, day: 'Mon', type: 'Easy Run', distance: 8, target_pace: '6:20', scheduled_date: '2024-12-30', completed: false, notes: 'Relaxed aerobic run. RPE 6-8, focus on cadence & breathing.', phase: 'Race Peak + Taper' },
    { week: 9, day: 'Wed', type: 'Tempo Run', distance: 9, target_pace: '5:42', scheduled_date: '2025-01-01', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Race Peak + Taper' },
    { week: 9, day: 'Fri', type: 'Quality Run', distance: 'Intervals', target_pace: '4:55', scheduled_date: '2025-01-03', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Race Peak + Taper' },
    { week: 9, day: 'Sun', type: 'Long Run', distance: 20, target_pace: '6:10', scheduled_date: '2025-01-05', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Race Peak + Taper' },

    { week: 10, day: 'Mon', type: 'Easy Run', distance: 8, target_pace: '6:18', scheduled_date: '2025-01-06', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Race Peak + Taper' },
    { week: 10, day: 'Wed', type: 'Tempo Run', distance: 8, target_pace: '5:40', scheduled_date: '2025-01-08', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Race Peak + Taper' },
    { week: 10, day: 'Fri', type: 'Quality Run', distance: 'Intervals', target_pace: '4:55', scheduled_date: '2025-01-10', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Race Peak + Taper' },
    { week: 10, day: 'Sun', type: 'Long Run', distance: 21, target_pace: '6:05', scheduled_date: '2025-01-12', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Race Peak + Taper' },

    { week: 11, day: 'Mon', type: 'Easy Run', distance: 8, target_pace: '6:15', scheduled_date: '2025-01-13', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Race Peak + Taper' },
    { week: 11, day: 'Wed', type: 'Tempo Run', distance: 8, target_pace: '5:40', scheduled_date: '2025-01-15', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Race Peak + Taper' },
    { week: 11, day: 'Fri', type: 'Quality Run', distance: 'Intervals', target_pace: '4:55', scheduled_date: '2025-01-17', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Race Peak + Taper' },
    { week: 11, day: 'Sun', type: 'Long Run', distance: 14, target_pace: '6:00', scheduled_date: '2025-01-19', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Race Peak + Taper' },

    { week: 12, day: 'Mon', type: 'Easy Run', distance: 8, target_pace: '6:15', scheduled_date: '2025-01-20', completed: false, notes: 'Relaxed aerobic run. RPE 6-8.', phase: 'Race Peak + Taper' },
    { week: 12, day: 'Wed', type: 'Tempo Run', distance: 8, target_pace: '5:38', scheduled_date: '2025-01-22', completed: false, notes: 'Steady tempo holding threshold pace. RPE 7. Include WU/CD.', phase: 'Race Peak + Taper' },
    { week: 12, day: 'Fri', type: 'Quality Run', distance: 'Fartlek', target_pace: '4:55', scheduled_date: '2025-01-24', completed: false, notes: 'Alternate intensity: Fartlek 45 min (2 min on/2 min off). Historic intervals 6+1 km @ pace.', phase: 'Race Peak + Taper' },
    { week: 12, day: 'Sun', type: 'Long Run', distance: 21, target_pace: '5:58', scheduled_date: '2025-01-26', completed: false, notes: 'Endurance build. RPE 6. Negative split last 3 km.', phase: 'Race Peak + Taper' },
  ]

  const runs = runsData.map(run => ({
    user_id: userId,
    training_plan_id: planId,
    week_number: run.week,
    day_of_week: run.day,
    run_type: run.type,
    planned_distance: typeof run.distance === 'number' ? run.distance : null,
    target_pace: run.target_pace,
    scheduled_date: run.scheduled_date,
    completed: run.completed || false,
    actual_distance: run.actual_distance || null,
    actual_pace: run.actual_pace || null,
    notes: run.notes || '',
    comments: run.comments || '',
    phase: run.phase
  }))

  const { data, error } = await supabase
    .from('runs')
    .upsert(runs, { onConflict: 'user_id,scheduled_date' })

  if (error) {
    console.error('❌ Error importing runs:', error)
  } else {
    console.log(`✅ Imported ${runs.length} runs`)
  }
}

async function importNutritionFromData(userId: string) {
  console.log('🍎 Importing nutrition data...')

  // Based on your nutrition screenshot
  const nutritionData = [
    { week: 1, day: 'Mon', meals: 'Oats + banana, Chicken + rice, Fish + veggies', calories: '2600 kcal', macros: 'P180 C400 F70', completed: true },
    { week: 1, day: 'Wed', meals: 'Toast + PB, Tuna + rice, Beef + potato', calories: '2700 kcal', macros: 'P180 C450 F70', completed: true },
    { week: 1, day: 'Fri', meals: 'Smoothie, Chicken + pasta, Fish + rice', calories: '2700 kcal', macros: 'P180 C480 F65', completed: true },
    { week: 1, day: 'Sun', meals: 'Oats + honey, Pasta, Salmon dinner', calories: '2800 kcal', macros: 'P180 C500 F70', completed: true },

    { week: 2, day: 'Mon', meals: 'Oats + banana, Chicken + rice, Fish + veggies', calories: '2600 kcal', macros: 'P180 C400 F70', completed: false },
    { week: 2, day: 'Wed', meals: 'Toast + PB, Tuna + rice, Beef + potato', calories: '2700 kcal', macros: 'P180 C450 F70', completed: false },
    { week: 2, day: 'Fri', meals: 'Smoothie, Chicken + pasta, Fish + rice', calories: '2700 kcal', macros: 'P180 C480 F65', completed: false },
    { week: 2, day: 'Sun', meals: 'Oats + honey, Pasta, Salmon dinner', calories: '2800 kcal', macros: 'P180 C500 F70', completed: false },
  ]

  const nutrition = nutritionData.map((item, index) => ({
    user_id: userId,
    log_date: new Date(2024, 10, 3 + index).toISOString().split('T')[0], // Starting from Nov 3, 2024
    meals: item.meals,
    total_calories: parseInt(item.calories.match(/\d+/)?.[0] || '0'),
    protein: parseInt(item.macros.match(/P(\d+)/)?.[1] || '0'),
    carbs: parseInt(item.macros.match(/C(\d+)/)?.[1] || '0'),
    fats: parseInt(item.macros.match(/F(\d+)/)?.[1] || '0'),
    notes: `Week ${item.week} - ${item.day}`,
    completed: item.completed
  }))

  const { data, error } = await supabase
    .from('nutrition_logs')
    .upsert(nutrition, { onConflict: 'user_id,log_date' })

  if (error) {
    console.error('❌ Error importing nutrition:', error)
  } else {
    console.log(`✅ Imported ${nutrition.length} nutrition logs`)
  }
}

async function importStrengthFromData(userId: string) {
  console.log('💪 Importing strength training data...')

  // Based on your strength screenshot
  const strengthData = [
    { week: 1, day: 'Thursday', type: 'Full Body Strength', session: 'Bodyweight to Moderate', load: '8-7', rpe: 8, completed: true, comments: 'Focus on movement quality, moderate load. 10-12 reps per set. Exercises: Back Squat (RDL, Deadlift), Hip Rotation, Plank, Calf Raises, Focus on controlled tempo, proper form, and progressive overload.' },
    { week: 1, day: 'Saturday', type: 'Full Body Strength', session: 'Bodyweight to Moderate', load: '8-7', rpe: 8, completed: true, comments: 'Focus on movement quality, moderate load. 10-12 reps per set. Exercises: Back Squat (RDL, Deadlift), Hip Rotation, Plank, Calf Raises, Focus on controlled tempo, proper form, and progressive overload.' },
    { week: 2, day: 'Thursday', type: 'Full Body Strength', session: 'Bodyweight to Moderate', load: '8-7', rpe: 8, completed: false },
    { week: 2, day: 'Saturday', type: 'Full Body Strength', session: 'Bodyweight to Moderate', load: '8-7', rpe: 8, completed: false },
  ]

  const strength = strengthData.map((item, index) => ({
    user_id: userId,
    session_date: new Date(2024, 10, 3 + index * 2).toISOString().split('T')[0],
    session_type: item.type,
    exercises: item.session,
    duration_minutes: 45,
    rpe: item.rpe,
    notes: item.comments || '',
    completed: item.completed
  }))

  const { data, error } = await supabase
    .from('strength_sessions')
    .upsert(strength, { onConflict: 'user_id,session_date' })

  if (error) {
    console.error('❌ Error importing strength:', error)
  } else {
    console.log(`✅ Imported ${strength.length} strength sessions`)
  }
}

async function setPersonalBests(userId: string) {
  console.log('🏆 Setting personal bests...')

  const pbs = [
    { user_id: userId, distance: '5K', time: '00:20:00', pace: '4:00', date: '2024-01-01', is_target: false },
    { user_id: userId, distance: '10K', time: '00:42:00', pace: '4:12', date: '2024-01-01', is_target: false },
    { user_id: userId, distance: 'Half Marathon', time: '01:45:00', pace: '4:59', date: '2024-01-01', is_target: true },
    { user_id: userId, distance: 'Marathon', time: '03:45:00', pace: '5:20', date: '2024-01-01', is_target: true },
  ]

  const { data, error } = await supabase
    .from('personal_bests')
    .upsert(pbs, { onConflict: 'user_id,distance,is_target' })

  if (error) {
    console.error('❌ Error setting personal bests:', error)
  } else {
    console.log(`✅ Set ${pbs.length} personal bests`)
  }
}

// Run the migration
migrateAllData().catch(console.error)

