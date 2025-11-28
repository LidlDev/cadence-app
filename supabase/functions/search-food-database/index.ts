import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FoodSearchResult {
  id: string
  name: string
  brand?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: number
  serving_unit: string
  source: 'fatsecret' | 'openfoodfacts' | 'cached'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const fatSecretClientId = Deno.env.get('FATSECRET_CLIENT_ID')
    const fatSecretClientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET')

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { query, barcode } = await req.json()
    console.log('Food search:', { query, barcode })

    const results: FoodSearchResult[] = []

    // First, check our cached food_items table
    if (query) {
      const { data: cachedFoods } = await supabase
        .from('food_items')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(5)

      if (cachedFoods && cachedFoods.length > 0) {
        results.push(...cachedFoods.map(f => ({
          id: f.id,
          name: f.name,
          brand: f.brand,
          calories: f.calories || 0,
          protein_g: f.protein_g || 0,
          carbs_g: f.carbs_g || 0,
          fat_g: f.fat_g || 0,
          serving_size: f.serving_size || 100,
          serving_unit: f.serving_unit || 'g',
          source: 'cached' as const,
        })))
      }
    }

    // If barcode provided, try Open Food Facts first (free, no auth)
    if (barcode) {
      try {
        const offResponse = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
        )
        const offData = await offResponse.json()
        
        if (offData.status === 1 && offData.product) {
          const p = offData.product
          const nutriments = p.nutriments || {}
          
          const foodItem = {
            id: `off_${barcode}`,
            name: p.product_name || 'Unknown Product',
            brand: p.brands,
            calories: nutriments['energy-kcal_100g'] || 0,
            protein_g: nutriments.proteins_100g || 0,
            carbs_g: nutriments.carbohydrates_100g || 0,
            fat_g: nutriments.fat_100g || 0,
            serving_size: 100,
            serving_unit: 'g',
            source: 'openfoodfacts' as const,
          }
          
          results.unshift(foodItem) // Add to front
          
          // Cache for future use
          await supabase.from('food_items').upsert({
            external_id: barcode,
            source: 'openfoodfacts',
            barcode: barcode,
            name: foodItem.name,
            brand: foodItem.brand,
            calories: foodItem.calories,
            protein_g: foodItem.protein_g,
            carbs_g: foodItem.carbs_g,
            fat_g: foodItem.fat_g,
            fiber_g: nutriments.fiber_100g,
            sugar_g: nutriments.sugars_100g,
            sodium_mg: nutriments.sodium_100g ? nutriments.sodium_100g * 1000 : null,
            serving_size: 100,
            serving_unit: 'g',
            image_url: p.image_url,
          }, { onConflict: 'barcode' })
        }
      } catch (e) {
        console.error('Open Food Facts error:', e)
      }
    }

    // Search FatSecret API if we have credentials and need more results
    if (fatSecretClientId && fatSecretClientSecret && query && results.length < 10) {
      try {
        // Get OAuth 2.0 access token
        const tokenResponse = await fetch('https://oauth.fatsecret.com/connect/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: fatSecretClientId,
            client_secret: fatSecretClientSecret,
            scope: 'basic',
          }),
        })
        
        const tokenData = await tokenResponse.json()
        const accessToken = tokenData.access_token

        if (accessToken) {
          // Search foods
          const searchResponse = await fetch(
            `https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(query)}&format=json&max_results=10`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          )
          
          const searchData = await searchResponse.json()
          const foods = searchData.foods?.food || []
          
          for (const food of Array.isArray(foods) ? foods : [foods]) {
            // Parse the description to extract macros
            const desc = food.food_description || ''
            const match = desc.match(/Calories: (\d+).*Fat: ([\d.]+)g.*Carbs: ([\d.]+)g.*Protein: ([\d.]+)g/)
            
            if (match) {
              results.push({
                id: `fs_${food.food_id}`,
                name: food.food_name,
                brand: food.brand_name,
                calories: parseFloat(match[1]),
                protein_g: parseFloat(match[4]),
                carbs_g: parseFloat(match[3]),
                fat_g: parseFloat(match[2]),
                serving_size: 100,
                serving_unit: 'g',
                source: 'fatsecret',
              })
            }
          }
        }
      } catch (e) {
        console.error('FatSecret API error:', e)
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

