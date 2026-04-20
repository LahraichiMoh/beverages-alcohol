import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function update() {
  // Find Orange Money campaign
  const { data: campaigns, error: findError } = await supabase
    .from('campaigns')
    .select('id, theme')
    .ilike('name', '%orange money%')
    .limit(1)

  if (findError) {
    console.error('Error finding campaign:', findError)
    return
  }

  if (!campaigns || campaigns.length === 0) {
    console.error('Orange Money campaign not found')
    return
  }

  const campaign = campaigns[0]
  const newTheme = {
    ...(campaign.theme || {}),
    logoUrl: '/casa_logo.png', 
    backgroundUrl: '/flag-back.jpg',
    primaryColor: '#ff7900',
    secondaryColor: '#000000'
  }

  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ theme: newTheme })
    .eq('id', campaign.id)

  if (updateError) {
    console.error('Error updating campaign:', updateError)
  } else {
    console.log('Successfully updated Orange Money campaign theme')
  }
}

update()
