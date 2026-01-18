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
  sodium_mg?: number
  serving_size: number
  serving_unit: string
  source: 'usda' | 'openfoodfacts' | 'api_ninjas' | 'cached'
}

// Search API Ninjas Nutrition API (excellent for NLP-style queries like "2 eggs and toast")
async function searchAPINinjas(query: string, apiKey: string): Promise<FoodSearchResult[]> {
  try {
    console.log('Searching API Ninjas for:', query)
    const response = await fetch(
      `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'X-Api-Key': apiKey,
        },
      }
    )

    if (!response.ok) {
      console.error('API Ninjas error:', response.status, await response.text())
      return []
    }

    const data = await response.json()
    console.log('API Ninjas results count:', data?.length || 0)

    // API Ninjas returns an array of food items with nutrition data
    return (data || []).map((item: any, index: number) => ({
      id: `apininjas_${Date.now()}_${index}`,
      name: item.name || 'Unknown',
      calories: Math.round(item.calories || 0),
      protein_g: Math.round((item.protein_g || 0) * 10) / 10,
      carbs_g: Math.round((item.carbohydrates_total_g || 0) * 10) / 10,
      fat_g: Math.round((item.fat_total_g || 0) * 10) / 10,
      fiber_g: item.fiber_g ? Math.round(item.fiber_g * 10) / 10 : undefined,
      sugar_g: item.sugar_g ? Math.round(item.sugar_g * 10) / 10 : undefined,
      sodium_mg: item.sodium_mg ? Math.round(item.sodium_mg) : undefined,
      serving_size: Math.round(item.serving_size_g || 100),
      serving_unit: 'g',
      source: 'api_ninjas' as const,
    }))
  } catch (e) {
    console.error('API Ninjas search error:', e)
    return []
  }
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
    // API Ninjas key for NLP-style food queries
    const apiNinjasKey = Deno.env.get('API_NINJAS_KEY')

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { query, barcode, useNLP } = await req.json()
    console.log('Food search:', { query, barcode, useNLP })

    const results: FoodSearchResult[] = []

    // Detect if query looks like NLP (contains quantities, multiple items, etc.)
    const isNLPQuery = (q: string): boolean => {
      if (!q) return false
      // Check for patterns that suggest NLP: numbers, "and", commas, multiple words with quantities
      const nlpPatterns = [
        /\d+\s*(g|oz|cup|tbsp|tsp|lb|kg|ml|slice|piece|serving)/i, // quantities with units
        /\d+\s+\w+/,  // number followed by word (e.g., "2 eggs")
        /\band\b/i,   // "and" connector
        /,/,          // comma-separated items
        /with\s+\w+/i, // "with" something
      ]
      return nlpPatterns.some(pattern => pattern.test(q))
    }

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

    // Text search: Determine search strategy based on query type
    if (query && results.length < 10) {
      const shouldUseNLP = useNLP === true || isNLPQuery(query)
      console.log('Starting food search for:', query, '| NLP mode:', shouldUseNLP)

      if (shouldUseNLP && apiNinjasKey) {
        // For NLP-style queries, use API Ninjas first (best at parsing "2 eggs and toast")
        console.log('Using API Ninjas for NLP query')
        const ninjaResults = await searchAPINinjas(query, apiNinjasKey)

        if (ninjaResults.length > 0) {
          // API Ninjas successfully parsed the query - use these results
          results.push(...ninjaResults)
          console.log('API Ninjas returned', ninjaResults.length, 'items')
        } else {
          // Fall back to traditional search if API Ninjas fails
          console.log('API Ninjas returned no results, falling back to USDA/OFF')
          const [usdaResults, offResults] = await Promise.all([
            searchUSDA(query, usdaApiKey),
            searchOpenFoodFacts(query),
          ])
          results.push(...usdaResults.slice(0, 8))
          results.push(...offResults.slice(0, 5))
        }
      } else {
        // Traditional search: Query all APIs in parallel
        console.log('Using traditional parallel search (USDA + OFF + API Ninjas)')

        const searchPromises = [
          searchUSDA(query, usdaApiKey),
          searchOpenFoodFacts(query),
        ]

        // Include API Ninjas if key is available
        if (apiNinjasKey) {
          searchPromises.push(searchAPINinjas(query, apiNinjasKey))
        }

        const [usdaResults, offResults, ninjaResults = []] = await Promise.all(searchPromises)

        console.log(`Search complete - USDA: ${usdaResults.length}, OFF: ${offResults.length}, Ninjas: ${ninjaResults.length}`)

        // Combine results, prioritizing API Ninjas (most accurate for portions),
        // then USDA for generic foods, then Open Food Facts for branded products
        const combinedResults: FoodSearchResult[] = []

        // Add API Ninjas results first (best portion/serving accuracy)
        combinedResults.push(...ninjaResults.slice(0, 5))

        // Add USDA results (better for generic foods)
        for (const usdaFood of usdaResults.slice(0, 8)) {
          const isDuplicate = combinedResults.some(existing =>
            existing.name.toLowerCase() === usdaFood.name.toLowerCase()
          )
          if (!isDuplicate) {
            combinedResults.push(usdaFood)
          }
        }

        // Add Open Food Facts results, avoiding duplicates
        for (const offFood of offResults) {
          const isDuplicate = combinedResults.some(existing =>
            existing.name.toLowerCase().includes(offFood.name.toLowerCase()) ||
            offFood.name.toLowerCase().includes(existing.name.toLowerCase())
          )
          if (!isDuplicate && combinedResults.length < 20) {
            combinedResults.push(offFood)
          }
        }

        results.push(...combinedResults)
      }

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

