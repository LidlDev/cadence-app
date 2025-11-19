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

async function setupDatabase() {
  console.log('🗄️  Setting up database schema...\n')
  
  // Read the schema file
  const schemaPath = path.join(__dirname, '../supabase-schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  
  // Split into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`📝 Found ${statements.length} SQL statements\n`)
  
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'
    
    // Skip comments
    if (statement.trim().startsWith('--')) continue
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // Some errors are expected (like "already exists")
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Skipped (already exists): Statement ${i + 1}`)
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message)
          errorCount++
        }
      } else {
        successCount++
        console.log(`✅ Executed statement ${i + 1}`)
      }
    } catch (err: any) {
      console.error(`❌ Error in statement ${i + 1}:`, err.message)
      errorCount++
    }
  }
  
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  
  if (errorCount === 0) {
    console.log('\n🎉 Database setup complete!')
    console.log('   You can now run: npx tsx scripts/import-from-csv.ts')
  } else {
    console.log('\n⚠️  Some errors occurred. You may need to run the schema manually.')
    console.log('   1. Go to https://wfdqshevlvuatzhpudqr.supabase.co')
    console.log('   2. Click "SQL Editor"')
    console.log('   3. Paste the contents of supabase-schema.sql')
    console.log('   4. Click "Run"')
  }
}

setupDatabase().catch(console.error)

