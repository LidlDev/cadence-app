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
  fiber_g?: number
  sugar_g?: number
  serving_size: number
  serving_unit: string
  source: 'usda' | 'openfoodfacts' | 'cached'
}

// Search USDA FoodData Central API
async function searchUSDA(query: string, apiKey: string): Promise<FoodSearchResult[]> {
  try {
    console.log('Searching USDA for:', query)
    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=10&dataType=Foundation,SR%20Legacy,Branded`
    )

    if (!response.ok) {
      console.error('USDA API error:', response.status)
      return []
    }

    const data = await response.json()
    console.log('USDA results count:', data.foods?.length || 0)

    return (data.foods || []).map((food: any) => {
      // Extract nutrients from the foodNutrients array
      const nutrients = food.foodNutrients || []
      const getNutrient = (name: string) => {
        const n = nutrients.find((n: any) => n.nutrientName?.toLowerCase().includes(name.toLowerCase()))
        return n?.value || 0
      }

      return {
        id: `usda_${food.fdcId}`,
        name: food.description || food.lowercaseDescription || 'Unknown',
        brand: food.brandName || food.brandOwner,
        calories: getNutrient('energy'),
        protein_g: getNutrient('protein'),
        carbs_g: getNutrient('carbohydrate'),
        fat_g: getNutrient('total lipid') || getNutrient('fat'),
        fiber_g: getNutrient('fiber'),
        sugar_g: getNutrient('sugars'),
        serving_size: food.servingSize || 100,
        serving_unit: food.servingSizeUnit || 'g',
        source: 'usda' as const,
      }
    })
  } catch (e) {
    console.error('USDA search error:', e)
    return []
  }
}

// Search Open Food Facts API (text search)
async function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  try {
    console.log('Searching Open Food Facts for:', query)
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=10&fields=code,product_name,brands,nutriments,serving_size,image_url`
    )

    if (!response.ok) {
      console.error('Open Food Facts API error:', response.status)
      return []
    }

    const data = await response.json()
    console.log('Open Food Facts results count:', data.products?.length || 0)

    return (data.products || [])
      .filter((p: any) => p.product_name) // Only include products with names
      .map((p: any) => {
        const n = p.nutriments || {}
        return {
          id: `off_${p.code}`,
          name: p.product_name,
          brand: p.brands,
          calories: n['energy-kcal_100g'] || Math.round((n['energy_100g'] || 0) / 4.184),
          protein_g: n.proteins_100g || 0,
          carbs_g: n.carbohydrates_100g || 0,
          fat_g: n.fat_100g || 0,
          fiber_g: n.fiber_100g,
          sugar_g: n.sugars_100g,
          serving_size: 100,
          serving_unit: 'g',
          source: 'openfoodfacts' as const,
        }
      })
  } catch (e) {
    console.error('Open Food Facts search error:', e)
    return []
  }
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
    // USDA API key - uses DEMO_KEY if not set (rate limited but works)
    const usdaApiKey = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY'

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

    // If barcode provided, try Open Food Facts barcode lookup
    if (barcode) {
      try {
        console.log('Looking up barcode:', barcode)
        const offResponse = await fetch(
          `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
        )
        const offData = await offResponse.json()

        if (offData.status === 1 && offData.product) {
          const p = offData.product
          const nutriments = p.nutriments || {}

          const foodItem: FoodSearchResult = {
            id: `off_${barcode}`,
            name: p.product_name || 'Unknown Product',
            brand: p.brands,
            calories: nutriments['energy-kcal_100g'] || Math.round((nutriments['energy_100g'] || 0) / 4.184),
            protein_g: nutriments.proteins_100g || 0,
            carbs_g: nutriments.carbohydrates_100g || 0,
            fat_g: nutriments.fat_100g || 0,
            fiber_g: nutriments.fiber_100g,
            sugar_g: nutriments.sugars_100g,
            serving_size: 100,
            serving_unit: 'g',
            source: 'openfoodfacts',
          }

          results.unshift(foodItem) // Add to front
          console.log('Barcode found:', foodItem.name)

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
        } else {
          console.log('Barcode not found in Open Food Facts')
        }
      } catch (e) {
        console.error('Open Food Facts barcode error:', e)
      }
    }

    // Text search: Query USDA and Open Food Facts in parallel
    if (query && results.length < 10) {
      console.log('Starting parallel food search for:', query)

      const [usdaResults, offResults] = await Promise.all([
        searchUSDA(query, usdaApiKey),
        searchOpenFoodFacts(query),
      ])

      console.log(`Search complete - USDA: ${usdaResults.length}, OFF: ${offResults.length}`)

      // Combine results, prioritizing USDA for generic foods
      // and Open Food Facts for branded products
      const combinedResults: FoodSearchResult[] = []

      // Add USDA results first (better for generic foods)
      combinedResults.push(...usdaResults.slice(0, 8))

      // Add Open Food Facts results, avoiding duplicates
      for (const offFood of offResults) {
        const isDuplicate = combinedResults.some(existing =>
          existing.name.toLowerCase().includes(offFood.name.toLowerCase()) ||
          offFood.name.toLowerCase().includes(existing.name.toLowerCase())
        )
        if (!isDuplicate && combinedResults.length < 15) {
          combinedResults.push(offFood)
        }
      }

      results.push(...combinedResults)
      console.log('Total results after API search:', results.length)
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

