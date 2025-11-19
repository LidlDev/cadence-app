import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function createProfile() {
  console.log('👤 Creating user profile...\n')

  // Get all users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  
  if (usersError || !users || users.length === 0) {
    console.error('❌ No users found')
    return
  }

  const user = users[0]
  console.log(`Found user: ${user.email} (${user.id})`)

  // Check if profile already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select()
    .eq('id', user.id)
    .single()

  if (existingProfile) {
    console.log('✅ Profile already exists!')
    return
  }

  // Create profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      full_name: user.email?.split('@')[0] || 'Runner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (profileError) {
    console.error('❌ Error creating profile:', profileError)
    return
  }

  console.log('✅ Profile created successfully!')
  console.log('\nYou can now run: npx tsx scripts/import-from-csv.ts')
}

createProfile().catch(console.error)

