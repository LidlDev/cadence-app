'use client'

import { DailyNutritionTarget } from '@/lib/types/database'
import { Flame, Beef, Wheat, Droplet } from 'lucide-react'

interface DailyProgressCardProps {
  target: DailyNutritionTarget | null
  actual: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

export default function DailyProgressCard({ target, actual }: DailyProgressCardProps) {
  const targetCalories = target?.target_calories || 2000
  const targetProtein = target?.target_protein_g || 120
  const targetCarbs = target?.target_carbs_g || 250
  const targetFat = target?.target_fat_g || 65

  const caloriePercent = Math.min((actual.calories / targetCalories) * 100, 100)
  const proteinPercent = Math.min((actual.protein_g / targetProtein) * 100, 100)
  const carbsPercent = Math.min((actual.carbs_g / targetCarbs) * 100, 100)
  const fatPercent = Math.min((actual.fat_g / targetFat) * 100, 100)

  // Calculate macro distribution for pie chart
  const totalMacroGrams = actual.protein_g + actual.carbs_g + actual.fat_g
  const proteinDeg = totalMacroGrams > 0 ? (actual.protein_g / totalMacroGrams) * 360 : 120
  const carbsDeg = totalMacroGrams > 0 ? (actual.carbs_g / totalMacroGrams) * 360 : 120
  const fatDeg = totalMacroGrams > 0 ? (actual.fat_g / totalMacroGrams) * 360 : 120

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Daily Progress</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {/* Calorie Ring */}
        <div className="flex items-center justify-center">
          <div className="relative w-48 h-48">
            {/* Background ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                className="text-slate-200 dark:text-slate-700"
              />
              <circle
                cx="96"
                cy="96"
                r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                strokeDasharray={`${caloriePercent * 5.02} 502`}
                strokeLinecap="round"
                className="text-orange-500 transition-all duration-500"
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Flame className="w-6 h-6 text-orange-500 mb-1" />
              <span className="text-3xl font-bold text-slate-900 dark:text-white">
                {actual.calories}
              </span>
              <span className="text-sm text-slate-500">/ {targetCalories} kcal</span>
            </div>
          </div>
        </div>

        {/* Macro Bars */}
        <div className="space-y-4">
          {/* Protein */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Beef className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Protein</span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {actual.protein_g}g / {targetProtein}g
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full transition-all duration-500"
                style={{ width: `${proteinPercent}%` }}
              />
            </div>
          </div>

          {/* Carbs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Wheat className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Carbs</span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {actual.carbs_g}g / {targetCarbs}g
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${carbsPercent}%` }}
              />
            </div>
          </div>

          {/* Fat */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Fat</span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {actual.fat_g}g / {targetFat}g
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${fatPercent}%` }}
              />
            </div>
          </div>

          {/* Remaining calories */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Remaining</span>
              <span className={`font-medium ${targetCalories - actual.calories >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {targetCalories - actual.calories} kcal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

