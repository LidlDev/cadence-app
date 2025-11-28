'use client'

import { MealLog, DailyNutritionTarget } from '@/lib/types/database'
import { Plus, Coffee, Sun, Moon, Cookie, Utensils } from 'lucide-react'
import { format } from 'date-fns'

interface MealLogCardProps {
  meals: MealLog[]
  target: DailyNutritionTarget | null
  onLogMeal: (mealType: string) => void
}

const MEAL_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-5 h-5 text-amber-600" />,
  lunch: <Sun className="w-5 h-5 text-orange-500" />,
  dinner: <Moon className="w-5 h-5 text-indigo-500" />,
  snack: <Cookie className="w-5 h-5 text-pink-500" />,
  pre_workout: <Utensils className="w-5 h-5 text-green-500" />,
  post_workout: <Utensils className="w-5 h-5 text-blue-500" />,
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout']

export default function MealLogCard({ meals, target, onLogMeal }: MealLogCardProps) {
  // Group meals by type
  const mealsByType = meals.reduce((acc, meal) => {
    const type = meal.meal_type || 'snack'
    if (!acc[type]) acc[type] = []
    acc[type].push(meal)
    return acc
  }, {} as Record<string, MealLog[]>)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Today&apos;s Meals</h2>
        <button
          onClick={() => onLogMeal('snack')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Meal
        </button>
      </div>

      <div className="space-y-4">
        {MEAL_ORDER.map(mealType => {
          const typeMeals = mealsByType[mealType] || []
          const totalCals = typeMeals.reduce((sum, m) => sum + (m.total_calories || 0), 0)
          
          return (
            <div 
              key={mealType}
              className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
            >
              {/* Meal Type Header */}
              <div 
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => onLogMeal(mealType)}
              >
                <div className="flex items-center gap-3">
                  {MEAL_ICONS[mealType] || <Utensils className="w-5 h-5 text-slate-500" />}
                  <span className="font-medium text-slate-900 dark:text-white capitalize">
                    {mealType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {totalCals > 0 && (
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {totalCals} kcal
                    </span>
                  )}
                  <Plus className="w-5 h-5 text-slate-400" />
                </div>
              </div>

              {/* Logged Items */}
              {typeMeals.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {typeMeals.map(meal => (
                    <div key={meal.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {meal.name || 'Logged meal'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {meal.logged_at && format(new Date(meal.logged_at), 'h:mm a')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {meal.total_calories} kcal
                        </p>
                        <p className="text-xs text-slate-500">
                          P: {meal.total_protein_g}g • C: {meal.total_carbs_g}g • F: {meal.total_fat_g}g
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

