import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Helper to parse CSV
function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header] = values[index] || ''
    })
    return obj
  })
}

// Parse date from various formats
function parseDate(dateStr: string, year: number = 2024): string {
  if (!dateStr) return ''
  
  // Handle "November 03" format
  const monthMap: any = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3,
    'May': 4, 'June': 5, 'July': 6, 'August': 7,
    'September': 8, 'October': 9, 'November': 10, 'December': 11
  }
  
  const parts = dateStr.split(' ')
  if (parts.length === 2) {
    const month = monthMap[parts[0]]
    const day = parseInt(parts[1])
    const actualYear = month >= 10 ? 2024 : 2025 // Nov/Dec = 2024, Jan+ = 2025
    const date = new Date(actualYear, month, day)
    return date.toISOString().split('T')[0]
  }
  
  return ''
}

// Extract distance from string like "6km" or "6.67"
function extractDistance(distStr: string): number | null {
  if (!distStr) return null
  const match = distStr.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

// Extract pace from string like "6:40" or "06:09"
function extractPace(paceStr: string): string | null {
  if (!paceStr) return null
  const match = paceStr.match(/\d+:\d+/)
  return match ? match[0] : null
}

async function importData() {
  console.log('🚀 Starting CSV import...\n')

  // Get user
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  
  if (usersError || !users || users.length === 0) {
    console.error('❌ No users found. Please create an account first.')
    return
  }

  const userId = users[0].id
  console.log(`✅ Found user: ${users[0].email}\n`)

  // Create training plan
  console.log('📋 Creating training plan...')

  // First check if plan exists
  const { data: existingPlan } = await supabase
    .from('training_plans')
    .select()
    .eq('user_id', userId)
    .single()

  let plan
  if (existingPlan) {
    plan = existingPlan
    console.log(`✅ Using existing plan\n`)
  } else {
    const { data: newPlan, error: planError } = await supabase
      .from('training_plans')
      .insert({
        user_id: userId,
        name: '12-Week Half Marathon Training Plan',
        goal_race: 'Half Marathon',
        goal_time: '01:45:00',
        start_date: '2024-11-03',
        end_date: '2025-01-25',
        weeks: 12
      })
      .select()
      .single()

    if (planError) {
      console.error('❌ Error creating plan:', planError)
      console.log('\n⚠️  Have you run the database schema?')
      console.log('   1. Go to https://wfdqshevlvuatzhpudqr.supabase.co')
      console.log('   2. Click "SQL Editor"')
      console.log('   3. Paste the contents of supabase-schema.sql')
      console.log('   4. Click "Run"')
      return
    }
    plan = newPlan
    console.log(`✅ Plan created\n`)
  }

  // Import Runs
  await importRuns(userId, plan.id)
  
  // Import Strava Data
  await importStravaData(userId)
  
  // Import Nutrition
  await importNutrition(userId)
  
  // Import Strength
  await importStrength(userId)
  
  // Set Personal Bests
  await setPersonalBests(userId)

  console.log('\n🎉 Import complete!')
}

async function importRuns(userId: string, planId: string) {
  console.log('🏃 Importing runs...')
  
  const csvPath = path.join(__dirname, '../Half Marathon Plan - Runs.csv')
  const rows = parseCSV(csvPath)
  
  const runs = rows
    .filter(row => row.Week && !row.Week.includes('WEEKS')) // Skip header rows
    .map(row => {
      const distance = extractDistance(row['Distance/Load'])
      const targetPace = extractPace(row['Target Pace'])
      const completed = row.Completed?.toLowerCase() === 'yes'
      const scheduledDate = parseDate(row.Date)
      
      // Parse actuals
      let actualDistance = null
      let actualPace = null
      if (row.Actuals) {
        const distMatch = row.Actuals.match(/([\d.]+)km/)
        const paceMatch = row.Actuals.match(/(\d+:\d+)\/km/)
        actualDistance = distMatch ? parseFloat(distMatch[1]) : null
        actualPace = paceMatch ? paceMatch[1] : null
      }
      
      return {
        user_id: userId,
        training_plan_id: planId,
        week_number: parseInt(row.Week),
        day_of_week: row.Day,
        run_type: row.Type,
        session_type: row['Session/Exercise'],
        planned_distance: distance,
        target_pace: targetPace,
        scheduled_date: scheduledDate,
        completed: completed,
        actual_distance: actualDistance,
        actual_pace: actualPace,
        notes: row.Comments || '',
        comments: row.Actuals || ''
      }
    })
    .filter(run => run.scheduled_date) // Only include runs with valid dates

  // Insert runs one by one to avoid conflict issues
  let successCount = 0
  let errorCount = 0

  for (const run of runs) {
    const { error } = await supabase.from('runs').insert(run)
    if (error) {
      if (!error.message.includes('duplicate')) {
        console.error(`  ❌ Error inserting run:`, error.message)
        errorCount++
      }
    } else {
      successCount++
    }
  }

  const error = errorCount > 0

  if (error) {
    console.error('❌ Error importing runs:', error)
  } else {
    console.log(`✅ Imported ${runs.length} runs`)
  }
}

async function importStravaData(userId: string) {
  console.log('🏃 Importing Strava activities...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Data.csv')
  const rows = parseCSV(csvPath)

  const activities = rows
    .filter(row => row['Activity ID'])
    .map(row => {
      // Parse date from "Nov 14, 2025 (Fri)" format
      let activityDate = ''
      if (row.Date) {
        const dateMatch = row.Date.match(/(\w+)\s+(\d+),\s+(\d+)/)
        if (dateMatch) {
          const monthMap: any = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          }
          const month = monthMap[dateMatch[1]]
          const day = parseInt(dateMatch[2])
          const year = parseInt(dateMatch[3])
          activityDate = new Date(year, month, day).toISOString().split('T')[0]
        }
      }

      const distance = parseFloat(row.Distance) || 0
      const movingTime = row['Moving Time'] || '00:00:00'
      const pace = row['Pace (/km)'] || ''
      const avgHR = parseInt(row['Avg HR']) || null
      const maxHR = parseInt(row['Max HR']) || null
      const calories = parseInt(row.Calories) || null
      const sufferScore = parseInt(row['Suffer Score']) || null

      return {
        user_id: userId,
        strava_id: row['Activity ID'],
        name: row['Activity Name'],
        type: row.Type,
        start_date: activityDate ? new Date(activityDate).toISOString() : null,
        distance: distance,
        moving_time: parseInt(row['Elapsed Time (s)']) || 0,
        elapsed_time: parseInt(row['Elapsed Time (s)']) || 0,
        total_elevation_gain: parseFloat(row['Elevation Gain (m)']) || 0,
        average_heartrate: avgHR,
        max_heartrate: maxHR,
        calories: calories,
        suffer_score: sufferScore,
        raw_data: {
          description: row.Description || '',
          notes: row.Notes || '',
          pace: pace,
          avg_speed: parseFloat(row['Avg Speed (km/h)']) || 0,
          max_speed: parseFloat(row['Max Speed (km/h)']) || 0
        }
      }
    })
    .filter(activity => activity.activity_date)

  const { error } = await supabase.from('strava_activities').upsert(activities, {
    onConflict: 'user_id,strava_id'
  })

  if (error) {
    console.error('❌ Error importing Strava data:', error)
  } else {
    console.log(`✅ Imported ${activities.length} Strava activities`)
  }
}

async function importNutrition(userId: string) {
  console.log('🍎 Importing nutrition...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Nutrition.csv')
  const rows = parseCSV(csvPath)

  let dateCounter = 0
  const nutrition = rows
    .filter(row => row.Week && row.Day)
    .map(row => {
      // Calculate date based on week and day
      const week = parseInt(row.Week)
      const dayMap: any = { 'Mon': 0, 'Wed': 2, 'Fri': 4, 'Sun': 6 }
      const dayOffset = dayMap[row.Day] || 0
      const daysFromStart = (week - 1) * 7 + dayOffset
      const startDate = new Date('2024-11-03')
      const logDate = new Date(startDate)
      logDate.setDate(startDate.getDate() + daysFromStart)

      // Parse macros from "2600 kcal | P180 C400 F70"
      const macros = row['Calories/Macros'] || ''
      const caloriesMatch = macros.match(/(\d+)\s*kcal/)
      const proteinMatch = macros.match(/P(\d+)/)
      const carbsMatch = macros.match(/C(\d+)/)
      const fatsMatch = macros.match(/F(\d+)/)

      return {
        user_id: userId,
        log_date: logDate.toISOString().split('T')[0],
        meals: row['Example Meals'] || '',
        total_calories: caloriesMatch ? parseInt(caloriesMatch[1]) : 0,
        protein: proteinMatch ? parseInt(proteinMatch[1]) : 0,
        carbs: carbsMatch ? parseInt(carbsMatch[1]) : 0,
        fats: fatsMatch ? parseInt(fatsMatch[1]) : 0,
        notes: row.Comments || '',
        completed: row.Completed?.toLowerCase() === 'yes'
      }
    })

  const { error } = await supabase.from('nutrition_logs').upsert(nutrition, {
    onConflict: 'user_id,log_date'
  })

  if (error) {
    console.error('❌ Error importing nutrition:', error)
  } else {
    console.log(`✅ Imported ${nutrition.length} nutrition logs`)
  }
}

async function importStrength(userId: string) {
  console.log('💪 Importing strength training...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Strength.csv')
  const rows = parseCSV(csvPath)

  const strength = rows
    .filter(row => row.Week && row.Day)
    .map(row => {
      // Calculate date
      const week = parseInt(row.Week)
      const dayMap: any = {
        'Tuesday': 1,
        'Thursday/Friday': 4,
        'Thursday': 3,
        'Friday': 4,
        'Saturday': 5
      }
      const dayOffset = dayMap[row.Day] || 0
      const daysFromStart = (week - 1) * 7 + dayOffset
      const startDate = new Date('2024-11-03')
      const sessionDate = new Date(startDate)
      sessionDate.setDate(startDate.getDate() + daysFromStart)

      return {
        user_id: userId,
        session_date: sessionDate.toISOString().split('T')[0],
        session_type: row.Type || '',
        exercises: row['Session/Exercise'] || '',
        duration_minutes: 45,
        rpe: parseInt(row.RPE?.split('-')[0]) || 7,
        notes: row.Comments || '',
        completed: row.Completed?.toLowerCase() === 'yes'
      }
    })

  const { error } = await supabase.from('strength_sessions').upsert(strength, {
    onConflict: 'user_id,session_date'
  })

  if (error) {
    console.error('❌ Error importing strength:', error)
  } else {
    console.log(`✅ Imported ${strength.length} strength sessions`)
  }
}

async function setPersonalBests(userId: string) {
  console.log('🏆 Setting personal bests...')

  const pbs = [
    { user_id: userId, distance: '5K', time: '00:26:01', pace: '5:11', date: '2024-09-30', is_target: false },
    { user_id: userId, distance: '10K', time: '00:57:44', pace: '5:46', date: '2024-10-28', is_target: false },
    { user_id: userId, distance: 'Half Marathon', time: '01:45:00', pace: '4:59', date: '2025-01-25', is_target: true },
    { user_id: userId, distance: 'Marathon', time: '03:45:00', pace: '5:20', date: '2025-01-01', is_target: true },
  ]

  const { error } = await supabase.from('personal_bests').upsert(pbs, {
    onConflict: 'user_id,distance,is_target'
  })

  if (error) {
    console.error('❌ Error setting PBs:', error)
  } else {
    console.log(`✅ Set ${pbs.length} personal bests`)
  }
}

// Run the import
importData().catch(console.error)

