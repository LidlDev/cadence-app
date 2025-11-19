import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixDates() {
  console.log('🔧 Fixing dates in Supabase...\n')

  try {
    // Fix runs table
    console.log('📅 Updating runs table...')
    
    // Get all runs
    const { data: runs, error: runsError } = await supabase
      .from('runs')
      .select('id, scheduled_date')
    
    if (runsError) throw runsError

    let updatedRuns = 0
    for (const run of runs || []) {
      const currentDate = new Date(run.scheduled_date)
      const currentYear = currentDate.getFullYear()
      
      if (currentYear === 2024 || currentYear === 2025) {
        // Add 1 year
        const newDate = new Date(currentDate)
        newDate.setFullYear(currentYear + 1)
        const newDateStr = newDate.toISOString().split('T')[0]
        
        const { error } = await supabase
          .from('runs')
          .update({ scheduled_date: newDateStr })
          .eq('id', run.id)
        
        if (!error) {
          updatedRuns++
          console.log(`  ✓ Updated run ${run.id}: ${run.scheduled_date} → ${newDateStr}`)
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
      const currentDate = new Date(activity.activity_date)
      const currentYear = currentDate.getFullYear()
      
      if (currentYear === 2024 || currentYear === 2025) {
        const newDate = new Date(currentDate)
        newDate.setFullYear(currentYear + 1)
        const newDateStr = newDate.toISOString().split('T')[0]
        
        const { error } = await supabase
          .from('strava_activities')
          .update({ activity_date: newDateStr })
          .eq('id', activity.id)
        
        if (!error) {
          updatedActivities++
          console.log(`  ✓ Updated activity ${activity.id}: ${activity.activity_date} → ${newDateStr}`)
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
      const currentDate = new Date(log.log_date)
      const currentYear = currentDate.getFullYear()

      if (currentYear === 2024 || currentYear === 2025) {
        const newDate = new Date(currentDate)
        newDate.setFullYear(currentYear + 1)
        const newDateStr = newDate.toISOString().split('T')[0]

        const { error } = await supabase
          .from('nutrition_logs')
          .update({ log_date: newDateStr })
          .eq('id', log.id)

        if (!error) {
          updatedNutrition++
          console.log(`  ✓ Updated nutrition log ${log.id}: ${log.log_date} → ${newDateStr}`)
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
      const currentDate = new Date(session.session_date)
      const currentYear = currentDate.getFullYear()

      if (currentYear === 2024 || currentYear === 2025) {
        const newDate = new Date(currentDate)
        newDate.setFullYear(currentYear + 1)
        const newDateStr = newDate.toISOString().split('T')[0]

        const { error } = await supabase
          .from('strength_sessions')
          .update({ session_date: newDateStr })
          .eq('id', session.id)

        if (!error) {
          updatedStrength++
          console.log(`  ✓ Updated strength session ${session.id}: ${session.session_date} → ${newDateStr}`)
        }
      }
    }
    console.log(`✅ Updated ${updatedStrength} strength sessions\n`)

    console.log('🎉 All dates fixed successfully!')
    console.log('\n📊 Summary:')
    console.log(`  - Runs: ${updatedRuns}`)
    console.log(`  - Strava Activities: ${updatedActivities}`)
    console.log(`  - Nutrition Logs: ${updatedNutrition}`)
    console.log(`  - Strength Sessions: ${updatedStrength}`)
    console.log(`  - Total: ${updatedRuns + updatedActivities + updatedNutrition + updatedStrength}`)

  } catch (error) {
    console.error('❌ Error fixing dates:', error)
    process.exit(1)
  }
}

fixDates()

