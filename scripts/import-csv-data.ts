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

// Helper to parse CSV with proper quote handling
function parseCSV(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())

  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const rows: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === headers.length) {
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      rows.push(obj)
    }
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())

  return values
}

// Parse date from "November 03" format
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null

  const monthMap: any = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3,
    'May': 4, 'June': 5, 'July': 6, 'August': 7,
    'September': 8, 'October': 9, 'November': 10, 'December': 11
  }

  const parts = dateStr.split(' ')
  if (parts.length === 2) {
    const month = monthMap[parts[0]]
    const day = parseInt(parts[1])
    // Nov/Dec = 2024, Jan+ = 2025
    const year = month >= 10 ? 2024 : 2025
    const date = new Date(year, month, day)
    return date.toISOString().split('T')[0]
  }

  return null
}

// Parse Strava date from "Nov 14, 2025 (Fri)" format
function parseStravaDate(dateStr: string): string | null {
  if (!dateStr) return null

  const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)/)
  if (match) {
    const monthMap: any = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    }
    const month = monthMap[match[1]]
    const day = parseInt(match[2])
    const year = parseInt(match[3])
    const date = new Date(year, month, day)
    return date.toISOString().split('T')[0]
  }

  return null
}

// Extract distance from "6km" or "6.67"
function extractDistance(distStr: string): number | null {
  if (!distStr) return null
  const match = distStr.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

// Extract pace from various formats
function extractPace(paceStr: string): string | null {
  if (!paceStr) return null
  const match = paceStr.match(/\d+:\d+/)
  return match ? match[0] : null
}

async function main() {
  console.log('🚀 Starting CSV import...\n')

  // Get user
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

  if (usersError || !users || users.length === 0) {
    console.error('❌ No users found')
    return
  }

  const userId = users[0].id
  console.log(`✅ Found user: ${users[0].email}\n`)

  // Create training plan
  console.log('📋 Creating training plan...')
  const { data: existingPlan } = await supabase
    .from('training_plans')
    .select()
    .eq('user_id', userId)
    .single()

  let planId
  if (existingPlan) {
    planId = existingPlan.id
    console.log('✅ Using existing plan\n')
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
      return
    }
    planId = newPlan.id
    console.log('✅ Plan created\n')
  }

  // Import data
  await importRuns(userId, planId)
  await importStravaActivities(userId)
  await importNutrition(userId)
  await importStrength(userId, planId)
  await importPersonalBests(userId)

  console.log('\n🎉 Import complete!')
}

async function importRuns(userId: string, planId: string) {
  console.log('🏃 Importing runs...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Runs.csv')
  const rows = parseCSV(csvPath)

  const runs = rows
    .filter(row => row.Week && !row.Week.includes('WEEKS') && !row.Week.includes('🟩') && !row.Week.includes('🟨') && !row.Week.includes('🟥'))
    .map(row => {
      const scheduledDate = parseDate(row.Date)
      if (!scheduledDate) return null

      return {
        user_id: userId,
        training_plan_id: planId,
        week_number: parseInt(row.Week) || 0,
        day_of_week: row.Day || '',
        run_type: row.Type || '',
        session_type: row['Session/Exercise'] || '',
        planned_distance: extractDistance(row['Distance/Load']),
        target_pace: extractPace(row['Target Pace']),
        scheduled_date: scheduledDate,
        completed: row.Completed?.toLowerCase() === 'yes',
        actuals: row.Actuals || '',
        notes: row.Comments || '',
        actual_distance: row.Actuals ? extractDistance(row.Actuals) : null,
        actual_pace: row.Actuals ? extractPace(row.Actuals) : null
      }
    })
    .filter(run => run !== null)

  let successCount = 0
  for (const run of runs) {
    const { error } = await supabase.from('runs').insert(run)
    if (error && !error.message.includes('duplicate')) {
      console.error(`  ❌ Error:`, error.message)
    } else if (!error) {
      successCount++
    }
  }

  console.log(`✅ Imported ${successCount} runs\n`)
}

async function importStravaActivities(userId: string) {
  console.log('🏃 Importing Strava activities...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Data.csv')
  const rows = parseCSV(csvPath)

  const activities = rows
    .filter(row => row['Activity ID'])
    .map(row => {
      const activityDate = parseStravaDate(row.Date)
      if (!activityDate) return null

      return {
        user_id: userId,
        strava_id: parseInt(row['Activity ID']),
        activity_name: row['Activity Name'] || '',
        activity_type: row.Type || 'Run',
        activity_date: activityDate,
        distance: parseFloat(row.Distance) || 0,
        moving_time: row['Moving Time'] || '',
        elapsed_time: parseInt(row['Elapsed Time (s)']) || 0,
        pace: row['Pace (/km)'] || '',
        elevation_gain: parseFloat(row['Elevation Gain (m)']) || 0,
        avg_hr: parseFloat(row['Avg HR']) || null,
        max_hr: parseFloat(row['Max HR']) || null,
        hr_zones: row['HR Zones'] || '',
        avg_speed: parseFloat(row['Avg Speed (km/h)']) || null,
        max_speed: parseFloat(row['Max Speed (km/h)']) || null,
        calories: parseInt(row.Calories) || null,
        suffer_score: parseInt(row['Suffer Score']) || null,
        description: row.Description || '',
        notes: row.Notes || '',
        splits: row.Splits || ''
      }
    })
    .filter(activity => activity !== null)

  let successCount = 0
  for (const activity of activities) {
    const { error } = await supabase.from('strava_activities').insert(activity)
    if (error && !error.message.includes('duplicate')) {
      console.error(`  ❌ Error:`, error.message)
    } else if (!error) {
      successCount++
    }
  }

  console.log(`✅ Imported ${successCount} Strava activities\n`)
}

async function importNutrition(userId: string) {
  console.log('🍎 Importing nutrition...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Nutrition.csv')
  const rows = parseCSV(csvPath)

  const nutrition = rows
    .filter(row => row.Week && row.Day)
    .map(row => {
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
        week_number: week,
        day_of_week: row.Day,
        meals: row['Example Meals'] || '',
        total_calories: caloriesMatch ? parseInt(caloriesMatch[1]) : 0,
        protein: proteinMatch ? parseInt(proteinMatch[1]) : 0,
        carbs: carbsMatch ? parseInt(carbsMatch[1]) : 0,
        fats: fatsMatch ? parseInt(fatsMatch[1]) : 0,
        completed: row.Completed?.toLowerCase() === 'yes',
        actuals: row.Actuals || '',
        notes: row.Comments || ''
      }
    })

  let successCount = 0
  for (const item of nutrition) {
    const { error } = await supabase.from('nutrition_logs').insert(item)
    if (error && !error.message.includes('duplicate')) {
      console.error(`  ❌ Error:`, error.message)
    } else if (!error) {
      successCount++
    }
  }

  console.log(`✅ Imported ${successCount} nutrition logs\n`)
}

async function importStrength(userId: string, planId: string) {
  console.log('💪 Importing strength sessions...')

  const csvPath = path.join(__dirname, '../Half Marathon Plan - Strength.csv')
  const rows = parseCSV(csvPath)

  const sessions = rows
    .filter(row => row.Week && row.Day)
    .map(row => {
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
        training_plan_id: planId,
        session_date: sessionDate.toISOString().split('T')[0],
        week_number: week,
        day_of_week: row.Day,
        session_type: row.Type || '',
        exercises: row['Session/Exercise'] || '',
        load_description: row.Load || '',
        rpe: row.RPE || '',
        completed: row.Completed?.toLowerCase() === 'yes',
        actuals: row.Actuals || '',
        notes: row.Comments || '',
        duration_minutes: 45
      }
    })

  let successCount = 0
  for (const session of sessions) {
    const { error } = await supabase.from('strength_sessions').insert(session)
    if (error && !error.message.includes('duplicate')) {
      console.error(`  ❌ Error:`, error.message)
    } else if (!error) {
      successCount++
    }
  }

  console.log(`✅ Imported ${successCount} strength sessions\n`)
}

async function importPersonalBests(userId: string) {
  console.log('🏆 Setting personal bests...')

  const pbs = [
    { user_id: userId, distance: '5K', time: '00:26:01', pace: '5:11', date: '2024-09-30', is_target: false },
    { user_id: userId, distance: '10K', time: '00:57:44', pace: '5:46', date: '2024-10-28', is_target: false },
    { user_id: userId, distance: 'Half Marathon', time: '01:45:00', pace: '4:59', date: '2025-01-25', is_target: true },
    { user_id: userId, distance: 'Marathon', time: '03:45:00', pace: '5:20', date: '2025-01-01', is_target: true },
  ]

  let successCount = 0
  for (const pb of pbs) {
    const { error } = await supabase.from('personal_bests').insert(pb)
    if (error && !error.message.includes('duplicate')) {
      console.error(`  ❌ Error:`, error.message)
    } else if (!error) {
      successCount++
    }
  }

  console.log(`✅ Set ${successCount} personal bests\n`)
}

main().catch(console.error)

