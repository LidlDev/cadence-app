'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, Plus, Loader2, ScanBarcode, Trash2, Clock, BookOpen, ChefHat, Star, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'

interface FoodItem {
  id: string
  name: string
  brand?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: number
  serving_unit: string
  source: string
}

interface SelectedFood extends FoodItem {
  quantity: number
}

interface RecentFood {
  food_item_id: string | null
  food_name: string
  food_brand?: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_size: number
  serving_unit: string
}

interface UserRecipe {
  id: string
  name: string
  description?: string
  category?: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  servings: number
  use_count: number
  is_favorite: boolean
}

type TabType = 'search' | 'recipes' | 'create'

interface LogMealModalProps {
  mealType: string
  date: Date
  onClose: () => void
  onSave: () => void
}

export default function LogMealModal({ mealType, date, onClose, onSave }: LogMealModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([])
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([])
  const [userRecipes, setUserRecipes] = useState<UserRecipe[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false)
  const [mealName, setMealName] = useState('')
  const [showBarcodeScan, setShowBarcodeScan] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isLoadingRecent, setIsLoadingRecent] = useState(true)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Create Recipe state
  const [recipeName, setRecipeName] = useState('')
  const [recipeDescription, setRecipeDescription] = useState('')
  const [recipeCategory, setRecipeCategory] = useState<string>('other')
  const [recipeServings, setRecipeServings] = useState(1)
  const [recipeIngredients, setRecipeIngredients] = useState<SelectedFood[]>([])
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('')
  const [recipeSearchResults, setRecipeSearchResults] = useState<FoodItem[]>([])
  const [isSearchingRecipe, setIsSearchingRecipe] = useState(false)
  const [isSavingRecipe, setIsSavingRecipe] = useState(false)

  // Recipe scaling state
  const [selectedRecipe, setSelectedRecipe] = useState<UserRecipe | null>(null)
  const [scaleServings, setScaleServings] = useState(1)

  // Load recent foods and user recipes on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get recent meal log items
        const { data: recentItems } = await supabase
          .from('meal_log_items')
          .select(`
            food_item_id,
            food_name,
            food_brand,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            serving_size,
            serving_unit,
            meal_logs!inner(user_id)
          `)
          .eq('meal_logs.user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (recentItems) {
          // Deduplicate by food_name
          const seen = new Set<string>()
          const unique = recentItems.filter(item => {
            if (seen.has(item.food_name)) return false
            seen.add(item.food_name)
            return true
          }).slice(0, 5)
          setRecentFoods(unique)
        }

        // Load user recipes
        const { data: recipes } = await supabase
          .from('user_recipes')
          .select('*')
          .eq('user_id', user.id)
          .order('use_count', { ascending: false })
          .limit(20)

        if (recipes) {
          setUserRecipes(recipes)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoadingRecent(false)
      }
    }
    loadData()
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) return

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const response = await fetch(`${supabaseUrl}/functions/v1/search-food-database`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: searchQuery }),
        })

        const data = await response.json()
        setSearchResults(data.results || [])
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const addFood = (food: FoodItem) => {
    setSelectedFoods(prev => [...prev, { ...food, quantity: 1 }])
    setSearchQuery('')
    setSearchResults([])
  }

  const addRecentFood = (recent: RecentFood) => {
    const food: FoodItem = {
      id: recent.food_item_id || `recent_${Date.now()}`,
      name: recent.food_name,
      brand: recent.food_brand,
      calories: recent.calories || 0,
      protein_g: recent.protein_g || 0,
      carbs_g: recent.carbs_g || 0,
      fat_g: recent.fat_g || 0,
      serving_size: recent.serving_size || 100,
      serving_unit: recent.serving_unit || 'g',
      source: 'recent',
    }
    setSelectedFoods(prev => [...prev, { ...food, quantity: 1 }])
  }

  const removeFood = (index: number) => {
    setSelectedFoods(prev => prev.filter((_, i) => i !== index))
  }

  const updateQuantity = (index: number, quantity: number) => {
    setSelectedFoods(prev => prev.map((f, i) => i === index ? { ...f, quantity } : f))
  }

  // Barcode scan handler
  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) return

    setIsSearching(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const response = await fetch(`${supabaseUrl}/functions/v1/search-food-database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode: barcodeInput.trim() }),
      })

      const data = await response.json()
      if (data.results && data.results.length > 0) {
        addFood(data.results[0])
        setShowBarcodeScan(false)
        setBarcodeInput('')
      } else {
        alert('Product not found. Try manual search.')
      }
    } catch (error) {
      console.error('Barcode scan error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const totalCalories = selectedFoods.reduce((sum, f) => sum + f.calories * f.quantity, 0)
  const totalProtein = selectedFoods.reduce((sum, f) => sum + f.protein_g * f.quantity, 0)
  const totalCarbs = selectedFoods.reduce((sum, f) => sum + f.carbs_g * f.quantity, 0)
  const totalFat = selectedFoods.reduce((sum, f) => sum + f.fat_g * f.quantity, 0)

  const handleSave = async () => {
    if (selectedFoods.length === 0) return
    
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Not authenticated')

      // Create meal log
      const { data: mealLog, error: mealError } = await supabase
        .from('meal_logs')
        .insert({
          user_id: user.id,
          log_date: format(date, 'yyyy-MM-dd'),
          meal_type: mealType,
          meal_name: mealName || `${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
          total_calories: Math.round(totalCalories),
          total_protein_g: Math.round(totalProtein * 10) / 10,
          total_carbs_g: Math.round(totalCarbs * 10) / 10,
          total_fat_g: Math.round(totalFat * 10) / 10,
        })
        .select()
        .single()

      if (mealError) throw mealError

      // Create meal log items
      const items = selectedFoods.map(food => ({
        meal_log_id: mealLog.id,
        food_item_id: food.source === 'cached' ? food.id : null,
        food_name: food.name,
        food_brand: food.brand,
        quantity: food.quantity,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        calories: Math.round(food.calories * food.quantity),
        protein_g: Math.round(food.protein_g * food.quantity * 10) / 10,
        carbs_g: Math.round(food.carbs_g * food.quantity * 10) / 10,
        fat_g: Math.round(food.fat_g * food.quantity * 10) / 10,
      }))

      await supabase.from('meal_log_items').insert(items)

      onSave()
    } catch (error) {
      console.error('Error saving meal:', error)
      alert('Failed to save meal. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Open recipe scaling modal
  const openRecipeScaling = (recipe: UserRecipe) => {
    setSelectedRecipe(recipe)
    setScaleServings(1)
  }

  // Add scaled recipe to selected foods (for logging)
  const addScaledRecipeToMeal = async () => {
    if (!selectedRecipe) return

    const food: FoodItem = {
      id: selectedRecipe.id,
      name: selectedRecipe.name,
      brand: 'Custom Recipe',
      calories: (selectedRecipe.total_calories / selectedRecipe.servings) * scaleServings,
      protein_g: (selectedRecipe.total_protein_g / selectedRecipe.servings) * scaleServings,
      carbs_g: (selectedRecipe.total_carbs_g / selectedRecipe.servings) * scaleServings,
      fat_g: (selectedRecipe.total_fat_g / selectedRecipe.servings) * scaleServings,
      serving_size: scaleServings,
      serving_unit: scaleServings === 1 ? 'serving' : 'servings',
      source: 'recipe',
    }
    setSelectedFoods(prev => [...prev, { ...food, quantity: 1 }])

    // Update use count
    const supabase = createClient()
    await supabase
      .from('user_recipes')
      .update({ use_count: selectedRecipe.use_count + 1, last_used_at: new Date().toISOString() })
      .eq('id', selectedRecipe.id)

    setSelectedRecipe(null)
    setActiveTab('search')
  }

  // Recipe search (for adding ingredients)
  useEffect(() => {
    if (recipeSearchQuery.length < 2) {
      setRecipeSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingRecipe(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const response = await fetch(`${supabaseUrl}/functions/v1/search-food-database`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: recipeSearchQuery }),
        })

        const data = await response.json()
        setRecipeSearchResults(data.results || [])
      } catch (error) {
        console.error('Recipe search error:', error)
      } finally {
        setIsSearchingRecipe(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [recipeSearchQuery])

  const addIngredientToRecipe = (food: FoodItem) => {
    setRecipeIngredients(prev => [...prev, { ...food, quantity: 1 }])
    setRecipeSearchQuery('')
    setRecipeSearchResults([])
  }

  const removeIngredientFromRecipe = (index: number) => {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== index))
  }

  const updateIngredientQuantity = (index: number, quantity: number) => {
    setRecipeIngredients(prev => prev.map((f, i) => i === index ? { ...f, quantity } : f))
  }

  // Calculate recipe totals
  const recipeTotalCalories = recipeIngredients.reduce((sum, f) => sum + f.calories * f.quantity, 0)
  const recipeTotalProtein = recipeIngredients.reduce((sum, f) => sum + f.protein_g * f.quantity, 0)
  const recipeTotalCarbs = recipeIngredients.reduce((sum, f) => sum + f.carbs_g * f.quantity, 0)
  const recipeTotalFat = recipeIngredients.reduce((sum, f) => sum + f.fat_g * f.quantity, 0)

  const handleSaveRecipe = async () => {
    if (!recipeName.trim() || recipeIngredients.length === 0) return

    setIsSavingRecipe(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('user_recipes')
        .insert({
          user_id: user.id,
          name: recipeName.trim(),
          description: recipeDescription.trim() || null,
          category: recipeCategory,
          total_calories: Math.round(recipeTotalCalories),
          total_protein_g: Math.round(recipeTotalProtein * 10) / 10,
          total_carbs_g: Math.round(recipeTotalCarbs * 10) / 10,
          total_fat_g: Math.round(recipeTotalFat * 10) / 10,
          servings: recipeServings,
        })
        .select()
        .single()

      if (recipeError) throw recipeError

      // Create recipe ingredients
      const ingredients = recipeIngredients.map((food, index) => ({
        recipe_id: recipe.id,
        food_item_id: food.source === 'cached' ? food.id : null,
        food_name: food.name,
        food_brand: food.brand,
        quantity: food.quantity,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        calories: Math.round(food.calories * food.quantity),
        protein_g: Math.round(food.protein_g * food.quantity * 10) / 10,
        carbs_g: Math.round(food.carbs_g * food.quantity * 10) / 10,
        fat_g: Math.round(food.fat_g * food.quantity * 10) / 10,
        sort_order: index,
      }))

      await supabase.from('user_recipe_ingredients').insert(ingredients)

      // Add to local state
      setUserRecipes(prev => [recipe, ...prev])

      // Reset form
      setRecipeName('')
      setRecipeDescription('')
      setRecipeCategory('other')
      setRecipeServings(1)
      setRecipeIngredients([])
      setActiveTab('recipes')

      alert('Recipe saved successfully!')
    } catch (error) {
      console.error('Error saving recipe:', error)
      alert('Failed to save recipe. Please try again.')
    } finally {
      setIsSavingRecipe(false)
    }
  }

  const toggleFavorite = async (recipe: UserRecipe) => {
    const supabase = createClient()
    await supabase
      .from('user_recipes')
      .update({ is_favorite: !recipe.is_favorite })
      .eq('id', recipe.id)

    setUserRecipes(prev => prev.map(r =>
      r.id === recipe.id ? { ...r, is_favorite: !r.is_favorite } : r
    ))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
            Log {mealType.replace('_', ' ')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'search'
                ? 'text-[#FF6F00] border-b-2 border-[#FF6F00]'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={() => setActiveTab('recipes')}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'recipes'
                ? 'text-[#FF6F00] border-b-2 border-[#FF6F00]'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            My Recipes
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'create'
                ? 'text-[#FF6F00] border-b-2 border-[#FF6F00]'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            Create
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <>
              {/* Meal Name */}
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="Meal name (optional)"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />

          {/* Search and Barcode Toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search foods..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
              )}
            </div>
            <button
              onClick={() => setShowBarcodeScan(!showBarcodeScan)}
              className={`p-3 rounded-lg border transition-colors ${
                showBarcodeScan
                  ? 'bg-[#FF6F00] text-white border-[#FF6F00]'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Scan barcode"
            >
              <ScanBarcode className="w-5 h-5" />
            </button>
          </div>

          {/* Barcode Input */}
          {showBarcodeScan && (
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter barcode number or scan with camera
              </p>
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBarcodeScan()}
                  placeholder="Enter barcode..."
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  autoFocus
                />
                <button
                  onClick={handleBarcodeScan}
                  disabled={!barcodeInput.trim() || isSearching}
                  className="px-4 py-2 bg-[#FF6F00] text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                </button>
              </div>
            </div>
          )}

          {/* Recent Foods Quick-Add */}
          {recentFoods.length > 0 && searchQuery.length < 2 && !showBarcodeScan && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Foods
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentFoods.map((recent, idx) => (
                  <button
                    key={idx}
                    onClick={() => addRecentFood(recent)}
                    className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {recent.food_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700 max-h-48 overflow-y-auto">
              {searchResults.map(food => (
                <button
                  key={food.id}
                  onClick={() => addFood(food)}
                  className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{food.name}</p>
                    {food.brand && <p className="text-xs text-slate-500">{food.brand}</p>}
                    <p className="text-xs text-slate-400">{food.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{food.calories} kcal</p>
                    <p className="text-xs text-slate-500">per {food.serving_size}{food.serving_unit}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected Foods */}
          {selectedFoods.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-slate-900 dark:text-white">Added Foods</h3>
              {selectedFoods.map((food, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{food.name}</p>
                    <p className="text-xs text-slate-500">{Math.round(food.calories * food.quantity)} kcal</p>
                  </div>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={food.quantity}
                    onChange={(e) => updateQuantity(index, parseFloat(e.target.value) || 1)}
                    className="w-16 px-2 py-1 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                  <button onClick={() => removeFood(index)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
            </>
          )}

          {/* MY RECIPES TAB */}
          {activeTab === 'recipes' && (
            <>
              {userRecipes.length === 0 ? (
                <div className="text-center py-8">
                  <ChefHat className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No saved recipes yet</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-3 text-[#FF6F00] font-medium hover:underline"
                  >
                    Create your first recipe
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {userRecipes.map(recipe => (
                    <div
                      key={recipe.id}
                      className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                      onClick={() => openRecipeScaling(recipe)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(recipe); }}
                        className={`p-1 rounded ${recipe.is_favorite ? 'text-yellow-500' : 'text-slate-300 hover:text-yellow-500'}`}
                      >
                        <Star className="w-4 h-4" fill={recipe.is_favorite ? 'currentColor' : 'none'} />
                      </button>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">{recipe.name}</p>
                        <p className="text-xs text-slate-500">
                          {Math.round(recipe.total_calories / recipe.servings)} kcal/serving •
                          P: {Math.round(recipe.total_protein_g / recipe.servings)}g •
                          C: {Math.round(recipe.total_carbs_g / recipe.servings)}g •
                          F: {Math.round(recipe.total_fat_g / recipe.servings)}g
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{recipe.servings} serving{recipe.servings > 1 ? 's' : ''} per recipe</p>
                      </div>
                      <div className="text-[#FF6F00]">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* CREATE RECIPE TAB */}
          {activeTab === 'create' && (
            <>
              <div className="space-y-3">
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="Recipe name *"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
                <input
                  type="text"
                  value={recipeDescription}
                  onChange={(e) => setRecipeDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
                <div className="flex gap-3">
                  <select
                    value={recipeCategory}
                    onChange={(e) => setRecipeCategory(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                    <option value="pre_workout">Pre-Workout</option>
                    <option value="post_workout">Post-Workout</option>
                    <option value="other">Other</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">Servings:</label>
                    <input
                      type="number"
                      min="1"
                      value={recipeServings}
                      onChange={(e) => setRecipeServings(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-2 text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Ingredient Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={recipeSearchQuery}
                  onChange={(e) => setRecipeSearchQuery(e.target.value)}
                  placeholder="Search ingredients to add..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                />
                {isSearchingRecipe && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 animate-spin" />
                )}
              </div>

              {/* Ingredient Search Results */}
              {recipeSearchResults.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700 max-h-32 overflow-y-auto">
                  {recipeSearchResults.map(food => (
                    <button
                      key={food.id}
                      onClick={() => addIngredientToRecipe(food)}
                      className="w-full p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between items-center text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{food.name}</p>
                        {food.brand && <p className="text-xs text-slate-500">{food.brand}</p>}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{food.calories} kcal</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Recipe Ingredients */}
              {recipeIngredients.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-slate-900 dark:text-white">Ingredients</h3>
                  {recipeIngredients.map((food, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{food.name}</p>
                        <p className="text-xs text-slate-500">{Math.round(food.calories * food.quantity)} kcal</p>
                      </div>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={food.quantity}
                        onChange={(e) => updateIngredientQuantity(index, parseFloat(e.target.value) || 1)}
                        className="w-14 px-2 py-1 text-center text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      />
                      <button onClick={() => removeIngredientFromRecipe(index)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Recipe Totals */}
                  <div className="p-3 bg-[#FF6F00]/10 rounded-lg">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Total: {Math.round(recipeTotalCalories)} kcal •
                      P: {Math.round(recipeTotalProtein)}g •
                      C: {Math.round(recipeTotalCarbs)}g •
                      F: {Math.round(recipeTotalFat)}g
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Per serving ({recipeServings}): {Math.round(recipeTotalCalories / recipeServings)} kcal
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          {/* Search Tab Footer */}
          {activeTab === 'search' && (
            <>
              {selectedFoods.length > 0 && (
                <div className="flex justify-between text-sm mb-4 px-2">
                  <span className="text-slate-600 dark:text-slate-400">Total:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {Math.round(totalCalories)} kcal • P: {Math.round(totalProtein)}g • C: {Math.round(totalCarbs)}g • F: {Math.round(totalFat)}g
                  </span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={selectedFoods.length === 0 || isSaving}
                className="w-full py-3 bg-[#FF6F00] hover:bg-[#E65100] disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Log Meal
                  </>
                )}
              </button>
            </>
          )}

          {/* Recipes Tab Footer */}
          {activeTab === 'recipes' && selectedFoods.length > 0 && (
            <>
              <div className="flex justify-between text-sm mb-4 px-2">
                <span className="text-slate-600 dark:text-slate-400">Total:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {Math.round(totalCalories)} kcal • P: {Math.round(totalProtein)}g • C: {Math.round(totalCarbs)}g • F: {Math.round(totalFat)}g
                </span>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3 bg-[#FF6F00] hover:bg-[#E65100] disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Log Meal
                  </>
                )}
              </button>
            </>
          )}

          {/* Create Tab Footer */}
          {activeTab === 'create' && (
            <button
              onClick={handleSaveRecipe}
              disabled={!recipeName.trim() || recipeIngredients.length === 0 || isSavingRecipe}
              className="w-full py-3 bg-[#FF6F00] hover:bg-[#E65100] disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSavingRecipe ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Recipe
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Recipe Scaling Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white">Add Recipe</h3>
                <button onClick={() => setSelectedRecipe(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{selectedRecipe.name}</p>
                <p className="text-sm text-slate-500">{selectedRecipe.servings} serving{selectedRecipe.servings > 1 ? 's' : ''} per recipe</p>
              </div>

              {/* Servings Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  How many servings?
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setScaleServings(Math.max(0.25, scaleServings - 0.25))}
                    className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center font-bold text-lg"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={scaleServings}
                    onChange={(e) => setScaleServings(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
                    step="0.25"
                    min="0.25"
                    className="flex-1 text-center text-xl font-bold py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                  <button
                    onClick={() => setScaleServings(scaleServings + 0.25)}
                    className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center font-bold text-lg"
                  >
                    +
                  </button>
                </div>
                {/* Quick select buttons */}
                <div className="flex gap-2 mt-2">
                  {[0.5, 1, 1.5, 2].map(val => (
                    <button
                      key={val}
                      onClick={() => setScaleServings(val)}
                      className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                        scaleServings === val
                          ? 'bg-[#FF6F00] text-white border-[#FF6F00]'
                          : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scaled Nutrition Preview */}
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                  Nutrition for {scaleServings} serving{scaleServings !== 1 ? 's' : ''}:
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {Math.round((selectedRecipe.total_calories / selectedRecipe.servings) * scaleServings)}
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">kcal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {Math.round((selectedRecipe.total_protein_g / selectedRecipe.servings) * scaleServings)}g
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">Protein</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {Math.round((selectedRecipe.total_carbs_g / selectedRecipe.servings) * scaleServings)}g
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">Carbs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {Math.round((selectedRecipe.total_fat_g / selectedRecipe.servings) * scaleServings)}g
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300">Fat</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={addScaledRecipeToMeal}
                className="w-full py-3 bg-[#FF6F00] hover:bg-[#E65100] text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add {scaleServings} Serving{scaleServings !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

