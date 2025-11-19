import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function removeDuplicates() {
  console.log('🧹 Removing duplicate runs...\n')

  // Get all runs
  const { data: runs, error } = await supabase
    .from('runs')
    .select('*')
    .order('scheduled_date', { ascending: true })

  if (error) {
    console.error('❌ Error fetching runs:', error)
    return
  }

  console.log(`Found ${runs.length} total runs\n`)

  // Group by unique key: user_id + scheduled_date + run_type
  const uniqueRuns = new Map<string, any>()
  const duplicates: string[] = []

  for (const run of runs) {
    const key = `${run.user_id}-${run.scheduled_date}-${run.run_type}`
    
    if (uniqueRuns.has(key)) {
      // This is a duplicate, mark for deletion
      duplicates.push(run.id)
      console.log(`🗑️  Duplicate found: Week ${run.week_number} ${run.day_of_week} ${run.run_type}`)
    } else {
      // Keep the first occurrence
      uniqueRuns.set(key, run)
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Total runs: ${runs.length}`)
  console.log(`   Unique runs: ${uniqueRuns.size}`)
  console.log(`   Duplicates to remove: ${duplicates.length}\n`)

  if (duplicates.length > 0) {
    console.log('Deleting duplicates...')
    const { error: deleteError } = await supabase
      .from('runs')
      .delete()
      .in('id', duplicates)

    if (deleteError) {
      console.error('❌ Error deleting duplicates:', deleteError)
    } else {
      console.log(`✅ Deleted ${duplicates.length} duplicate runs\n`)
    }
  } else {
    console.log('✅ No duplicates found!\n')
  }

  // Verify
  const { data: finalRuns } = await supabase
    .from('runs')
    .select('*')

  console.log(`✅ Final count: ${finalRuns?.length || 0} runs`)
}

removeDuplicates().catch(console.error)

