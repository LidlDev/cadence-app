import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function setCorrectDates() {
  console.log('🔧 Setting correct dates in Supabase...\n')
  console.log('Target: Nov/Dec → 2025, Jan → 2026\n')

  try {
    // Fix runs table
    console.log('📅 Updating runs table...')
    
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id, scheduled_date')
    
    if (runsError) throw runsError

    let updatedRuns = 0
    for (const run of runs || []) {
      // Parse date string directly to avoid timezone issues
      const [year, monthStr, dayStr] = run.scheduled_date.split('-')
      const month = parseInt(monthStr)
      const day = parseInt(dayStr)

      let targetYear: number
      if (month === 11 || month === 12) {
        // November or December → 2025
        targetYear = 2025
      } else if (month === 1) {
        // January → 2026
        targetYear = 2026
      } else {
        continue // Skip other months
      }

      if (parseInt(year) !== targetYear) {
        const newDateStr = `${targetYear}-${monthStr}-${dayStr}`

        const { error } = await supabase
          .from('runs')
          .update({ scheduled_date: newDateStr })
          .eq('id', run.id)

        if (!error) {
          updatedRuns++
          console.log(`  ✓ Updated run: ${run.scheduled_date} → ${newDateStr}`)
        }
      }
    }
    console.log(`✅ Updated ${updatedRuns} runs\n`)

    // Fix strava_activities table
    console.log('📅 Updating strava_activities table...')
    const { data: activities, error: activitiesError } = await supabase
      .from('strava_activities')
      .select('id, activity_date')
    
    if (activitiesError) throw activitiesError

    let updatedActivities = 0
    for (const activity of activities || []) {
      const [year, monthStr, dayStr] = activity.activity_date.split('-')
      const month = parseInt(monthStr)

      let targetYear: number
      if (month === 9 || month === 10 || month === 11) {
        // Sep/Oct/Nov → 2025
        targetYear = 2025
      } else if (month === 1) {
        // January → 2026
        targetYear = 2026
      } else {
        continue
      }

      if (parseInt(year) !== targetYear) {
        const newDateStr = `${targetYear}-${monthStr}-${dayStr}`

        const { error } = await supabase
          .from('strava_activities')
          .update({ activity_date: newDateStr })
          .eq('id', activity.id)

        if (!error) {
          updatedActivities++
          console.log(`  ✓ Updated activity: ${activity.activity_date} → ${newDateStr}`)
        }
      }
    }
    console.log(`✅ Updated ${updatedActivities} activities\n`)

    // Fix nutrition_logs table
    console.log('📅 Updating nutrition_logs table...')
    const { data: nutrition, error: nutritionError } = await supabase
      .from('nutrition_logs')
      .select('id, log_date')
    
    if (nutritionError) throw nutritionError

    let updatedNutrition = 0
    for (const log of nutrition || []) {
      const [year, monthStr, dayStr] = log.log_date.split('-')
      const month = parseInt(monthStr)

      let targetYear: number
      if (month === 11 || month === 12) {
        targetYear = 2025
      } else if (month === 1) {
        targetYear = 2026
      } else {
        continue
      }

      if (parseInt(year) !== targetYear) {
        const newDateStr = `${targetYear}-${monthStr}-${dayStr}`

        const { error } = await supabase
          .from('nutrition_logs')
          .update({ log_date: newDateStr })
          .eq('id', log.id)

        if (!error) {
          updatedNutrition++
          console.log(`  ✓ Updated nutrition log: ${log.log_date} → ${newDateStr}`)
        }
      }
    }
    console.log(`✅ Updated ${updatedNutrition} nutrition logs\n`)

    // Fix strength_sessions table
    console.log('📅 Updating strength_sessions table...')
    const { data: strength, error: strengthError } = await supabase
      .from('strength_sessions')
      .select('id, session_date')
    
    if (strengthError) throw strengthError

    let updatedStrength = 0
    for (const session of strength || []) {
      const [year, monthStr, dayStr] = session.session_date.split('-')
      const month = parseInt(monthStr)

      let targetYear: number
      if (month === 11 || month === 12) {
        targetYear = 2025
      } else if (month === 1) {
        targetYear = 2026
      } else {
        continue
      }

      if (parseInt(year) !== targetYear) {
        const newDateStr = `${targetYear}-${monthStr}-${dayStr}`

        const { error } = await supabase
          .from('strength_sessions')
          .update({ session_date: newDateStr })
          .eq('id', session.id)

        if (!error) {
          updatedStrength++
          console.log(`  ✓ Updated strength session: ${session.session_date} → ${newDateStr}`)
        }
      }
    }
    console.log(`✅ Updated ${updatedStrength} strength sessions\n`)

    console.log('🎉 All dates set correctly!')
    console.log('\n📊 Summary:')
    console.log(`  - Runs: ${updatedRuns}`)
    console.log(`  - Strava Activities: ${updatedActivities}`)
    console.log(`  - Nutrition Logs: ${updatedNutrition}`)
    console.log(`  - Strength Sessions: ${updatedStrength}`)
    console.log(`  - Total: ${updatedRuns + updatedActivities + updatedNutrition + updatedStrength}`)

  } catch (error) {
    console.error('❌ Error setting dates:', error)
    process.exit(1)
  }
}

setCorrectDates()

