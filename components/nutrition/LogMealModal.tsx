'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search, Plus, Loader2, ScanBarcode, Trash2, Clock, Camera } from 'lucide-react'
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

interface LogMealModalProps {
  mealType: string
  date: Date
  onClose: () => void
  onSave: () => void
}

export default function LogMealModal({ mealType, date, onClose, onSave }: LogMealModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([])
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mealName, setMealName] = useState('')
  const [showBarcodeScan, setShowBarcodeScan] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isLoadingRecent, setIsLoadingRecent] = useState(true)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Load recent foods on mount
  useEffect(() => {
    const loadRecentFoods = async () => {
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
      } catch (error) {
        console.error('Error loading recent foods:', error)
      } finally {
        setIsLoadingRecent(false)
      }
    }
    loadRecentFoods()
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          {/* Totals */}
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
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
        </div>
      </div>
    </div>
  )
}

