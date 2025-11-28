'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Apple, Droplets, Plus, Calendar, TrendingUp, Sparkles, ChevronRight, X, Utensils } from 'lucide-react'
import { format, startOfDay, isToday, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { 
  NutritionPlan, 
  DailyNutritionTarget, 
  MealLog, 
  HydrationLog,
  DailyNutritionSummary,
  NutritionOnboardingData 
} from '@/lib/types/database'
import NutritionOnboarding from './NutritionOnboarding'
import DailyProgressCard from './DailyProgressCard'
import MealLogCard from './MealLogCard'
import HydrationTracker from './HydrationTracker'
import LogMealModal from './LogMealModal'

interface NutritionClientProps {
  plan: NutritionPlan | null
  todayTarget: DailyNutritionTarget | null
  todayMeals: MealLog[]
  todayHydration: HydrationLog[]
  todaySummary: DailyNutritionSummary | null
}

export default function NutritionClient({ 
  plan, 
  todayTarget, 
  todayMeals, 
  todayHydration,
  todaySummary 
}: NutritionClientProps) {
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(!plan)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showLogMeal, setShowLogMeal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<string>('breakfast')
  const [selectedDate, setSelectedDate] = useState(new Date())

  const handleGeneratePlan = async (data: NutritionOnboardingData) => {
    setIsGenerating(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) throw new Error('Not authenticated')

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-nutrition-plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ onboardingData: data, planWeeks: 12 }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setShowOnboarding(false)
      router.refresh()
    } catch (error) {
      console.error('Error generating plan:', error)
      alert('Failed to generate nutrition plan. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLogMeal = (mealType: string) => {
    setSelectedMealType(mealType)
    setShowLogMeal(true)
  }

  const handleMealLogged = () => {
    setShowLogMeal(false)
    router.refresh()
  }

  // Calculate totals from today's meals
  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.total_calories || 0), 0)
  const totalProtein = todayMeals.reduce((sum, m) => sum + (m.total_protein_g || 0), 0)
  const totalCarbs = todayMeals.reduce((sum, m) => sum + (m.total_carbs_g || 0), 0)
  const totalFat = todayMeals.reduce((sum, m) => sum + (m.total_fat_g || 0), 0)
  const totalHydration = todayHydration.reduce((sum, h) => sum + (h.amount_ml || 0), 0)

  // If no plan, show onboarding
  if (showOnboarding || !plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Apple className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Set Up Your Nutrition Plan
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Get personalized macro targets that adapt to your training schedule
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <NutritionOnboarding 
              onComplete={handleGeneratePlan} 
              isGenerating={isGenerating} 
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              <Apple className="w-10 h-10 text-green-600" />
              Nutrition
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {isToday(selectedDate) ? "Today's" : format(selectedDate, 'EEEE, MMM d')} nutrition tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(parseISO(e.target.value))}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - Left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Daily Progress */}
            <DailyProgressCard
              target={todayTarget}
              actual={{
                calories: totalCalories,
                protein_g: totalProtein,
                carbs_g: totalCarbs,
                fat_g: totalFat,
              }}
            />

            {/* Today's Meals */}
            <MealLogCard
              meals={todayMeals}
              target={todayTarget}
              onLogMeal={handleLogMeal}
            />
          </div>

          {/* Sidebar - Right col */}
          <div className="space-y-6">
            {/* Hydration Tracker */}
            <HydrationTracker
              logs={todayHydration}
              targetMl={todayTarget?.target_hydration_ml || plan.base_hydration_ml || 2500}
              totalMl={totalHydration}
            />

            {/* AI Insight */}
            {todaySummary?.ai_insight && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100">AI Insight</h3>
                </div>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  {todaySummary.ai_insight}
                </p>
              </div>
            )}

            {/* Training Day Info */}
            {todayTarget && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">Training Day</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Day Type</span>
                    <span className="font-medium text-slate-900 dark:text-white capitalize">
                      {todayTarget.day_type?.replace('_', ' ') || 'Rest'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Training Load</span>
                    <span className="font-medium text-slate-900 dark:text-white capitalize">
                      {todayTarget.training_load || 'None'}
                    </span>
                  </div>
                  {todayTarget.calorie_modifier && todayTarget.calorie_modifier !== 1 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Calorie Adjustment</span>
                      <span className={`font-medium ${todayTarget.calorie_modifier > 1 ? 'text-green-600' : 'text-orange-600'}`}>
                        {todayTarget.calorie_modifier > 1 ? '+' : ''}{Math.round((todayTarget.calorie_modifier - 1) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Quick Log</h3>
              <div className="grid grid-cols-2 gap-2">
                {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(meal => (
                  <button
                    key={meal}
                    onClick={() => handleLogMeal(meal.toLowerCase())}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {meal}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log Meal Modal */}
      {showLogMeal && (
        <LogMealModal
          mealType={selectedMealType}
          date={selectedDate}
          onClose={() => setShowLogMeal(false)}
          onSave={handleMealLogged}
        />
      )}
    </div>
  )
}

