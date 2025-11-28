'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Target, Utensils, Leaf, Activity, Sparkles, Loader2, Check } from 'lucide-react'
import { 
  NutritionOnboardingData, 
  NutritionGoal, 
  DietType, 
  CookingFrequency, 
  MealPrepPreference, 
  ActivityLevel 
} from '@/lib/types/database'

interface NutritionOnboardingProps {
  onComplete: (data: NutritionOnboardingData) => Promise<void>
  isGenerating: boolean
}

const STEPS = [
  { id: 'goals', title: 'Your Goals', icon: Target },
  { id: 'habits', title: 'Eating Habits', icon: Utensils },
  { id: 'diet', title: 'Diet Preferences', icon: Leaf },
  { id: 'lifestyle', title: 'Lifestyle', icon: Activity },
  { id: 'review', title: 'Review & Generate', icon: Sparkles },
]

const NUTRITION_GOALS: { value: NutritionGoal; label: string; description: string; emoji: string }[] = [
  { value: 'performance', label: 'Optimize Performance', description: 'Fuel training and racing for best results', emoji: '🏆' },
  { value: 'weight_loss', label: 'Lose Weight', description: 'Sustainable fat loss while maintaining energy', emoji: '📉' },
  { value: 'weight_gain', label: 'Gain Weight', description: 'Build muscle and increase body mass', emoji: '📈' },
  { value: 'maintain', label: 'Maintain Current', description: 'Keep current weight while optimizing nutrition', emoji: '⚖️' },
  { value: 'body_recomposition', label: 'Body Recomposition', description: 'Lose fat while building muscle', emoji: '🔄' },
]

const DIET_TYPES: { value: DietType; label: string; emoji: string }[] = [
  { value: 'omnivore', label: 'Omnivore', emoji: '🍖' },
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥬' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian', emoji: '🐟' },
  { value: 'keto', label: 'Keto', emoji: '🥑' },
  { value: 'paleo', label: 'Paleo', emoji: '🥩' },
  { value: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
]

const COMMON_ALLERGIES = ['Gluten', 'Dairy', 'Nuts', 'Peanuts', 'Shellfish', 'Soy', 'Eggs', 'Fish', 'Sesame']

const COOKING_OPTIONS: { value: CookingFrequency; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'I cook most of my meals' },
  { value: 'few_times_week', label: 'A few times a week', description: 'Mix of cooking and convenience' },
  { value: 'rarely', label: 'Rarely', description: 'I rely on prepared foods' },
]

const MEAL_PREP_OPTIONS: { value: MealPrepPreference; label: string }[] = [
  { value: 'yes', label: 'Yes, I meal prep regularly' },
  { value: 'sometimes', label: 'Sometimes, when I have time' },
  { value: 'no', label: 'No, I prefer fresh each day' },
]

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Desk job, minimal movement' },
  { value: 'lightly_active', label: 'Lightly Active', description: 'Light walking, some standing' },
  { value: 'moderately_active', label: 'Moderately Active', description: 'Regular movement throughout day' },
  { value: 'very_active', label: 'Very Active', description: 'Physical job or very active lifestyle' },
]

export default function NutritionOnboarding({ onComplete, isGenerating }: NutritionOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<NutritionOnboardingData>({
    primary_goal: 'performance',
    meals_per_day: 3,
    cooking_frequency: 'few_times_week',
    meal_prep_preference: 'sometimes',
    diet_type: 'omnivore',
    allergies: [],
    activity_level: 'moderately_active',
    hydration_baseline_ml: 2000,
    supplements: [],
  })

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    await onComplete(formData)
  }

  const toggleAllergy = (allergy: string) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy]
    }))
  }

  const canProceed = () => {
    switch (STEPS[currentStep].id) {
      case 'goals': return formData.primary_goal
      case 'habits': return formData.meals_per_day >= 2 && formData.meals_per_day <= 6
      case 'diet': return formData.diet_type
      case 'lifestyle': return formData.activity_level
      default: return true
    }
  }

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'goals':
        return <GoalsStep formData={formData} setFormData={setFormData} />
      case 'habits':
        return <HabitsStep formData={formData} setFormData={setFormData} cookingOptions={COOKING_OPTIONS} mealPrepOptions={MEAL_PREP_OPTIONS} />
      case 'diet':
        return <DietStep formData={formData} setFormData={setFormData} dietTypes={DIET_TYPES} allergies={COMMON_ALLERGIES} toggleAllergy={toggleAllergy} />
      case 'lifestyle':
        return <LifestyleStep formData={formData} setFormData={setFormData} activityLevels={ACTIVITY_LEVELS} />
      case 'review':
        return <ReviewStep formData={formData} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="px-6 pt-4">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                index < currentStep 
                  ? 'bg-green-500 text-white' 
                  : index === currentStep 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-8 md:w-16 h-1 mx-1 rounded ${
                  index < currentStep ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {renderStepContent()}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {currentStep === STEPS.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate My Plan
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Step 1: Goals
function GoalsStep({ formData, setFormData }: { formData: NutritionOnboardingData; setFormData: React.Dispatch<React.SetStateAction<NutritionOnboardingData>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">What&apos;s your primary nutrition goal?</h3>
        <div className="space-y-3">
          {NUTRITION_GOALS.map(goal => (
            <button
              key={goal.value}
              onClick={() => setFormData(prev => ({ ...prev, primary_goal: goal.value }))}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                formData.primary_goal === goal.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{goal.emoji}</span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{goal.label}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{goal.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {(formData.primary_goal === 'weight_loss' || formData.primary_goal === 'weight_gain') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Current Weight (kg)
            </label>
            <input
              type="number"
              value={formData.current_weight_kg || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, current_weight_kg: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              placeholder="70"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Target Weight (kg)
            </label>
            <input
              type="number"
              value={formData.target_weight_kg || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, target_weight_kg: parseFloat(e.target.value) || undefined }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              placeholder="65"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Step 2: Eating Habits
function HabitsStep({ formData, setFormData, cookingOptions, mealPrepOptions }: {
  formData: NutritionOnboardingData;
  setFormData: React.Dispatch<React.SetStateAction<NutritionOnboardingData>>;
  cookingOptions: typeof COOKING_OPTIONS;
  mealPrepOptions: typeof MEAL_PREP_OPTIONS;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">How many meals do you eat per day?</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="2"
            max="6"
            value={formData.meals_per_day}
            onChange={(e) => setFormData(prev => ({ ...prev, meals_per_day: parseInt(e.target.value) }))}
            className="flex-1 accent-orange-500"
          />
          <span className="w-12 text-center text-2xl font-bold text-orange-600">{formData.meals_per_day}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Including snacks</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Eating Window (optional)</h3>
        <p className="text-sm text-slate-500 mb-3">For intermittent fasting or time-restricted eating</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">First meal</label>
            <input
              type="time"
              value={formData.eating_window_start || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, eating_window_start: e.target.value || undefined }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Last meal</label>
            <input
              type="time"
              value={formData.eating_window_end || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, eating_window_end: e.target.value || undefined }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">How often do you cook?</h3>
        <div className="space-y-2">
          {cookingOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormData(prev => ({ ...prev, cooking_frequency: opt.value }))}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                formData.cooking_frequency === opt.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
              }`}
            >
              <p className="font-medium text-slate-900 dark:text-white">{opt.label}</p>
              <p className="text-sm text-slate-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Do you meal prep?</h3>
        <div className="space-y-2">
          {mealPrepOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFormData(prev => ({ ...prev, meal_prep_preference: opt.value }))}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                formData.meal_prep_preference === opt.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
              }`}
            >
              <p className="font-medium text-slate-900 dark:text-white">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Step 3: Dietary Preferences
function DietStep({ formData, setFormData, dietTypes, allergies, toggleAllergy }: {
  formData: NutritionOnboardingData;
  setFormData: React.Dispatch<React.SetStateAction<NutritionOnboardingData>>;
  dietTypes: typeof DIET_TYPES;
  allergies: string[];
  toggleAllergy: (allergy: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Diet Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {dietTypes.map(diet => (
            <button
              key={diet.value}
              onClick={() => setFormData(prev => ({ ...prev, diet_type: diet.value }))}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                formData.diet_type === diet.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
              }`}
            >
              <span className="text-2xl block mb-1">{diet.emoji}</span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{diet.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Allergies & Intolerances</h3>
        <div className="flex flex-wrap gap-2">
          {allergies.map(allergy => (
            <button
              key={allergy}
              onClick={() => toggleAllergy(allergy)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                formData.allergies.includes(allergy)
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {allergy}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Foods to Avoid</h3>
        <textarea
          value={formData.foods_to_avoid || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, foods_to_avoid: e.target.value || undefined }))}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          placeholder="Any specific foods you dislike or want to avoid..."
          rows={2}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Favorite Foods & Cuisines</h3>
        <textarea
          value={formData.favorite_foods || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, favorite_foods: e.target.value || undefined }))}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          placeholder="Foods and cuisines you enjoy..."
          rows={2}
        />
      </div>
    </div>
  )
}

// Step 4: Lifestyle
function LifestyleStep({ formData, setFormData, activityLevels }: {
  formData: NutritionOnboardingData;
  setFormData: React.Dispatch<React.SetStateAction<NutritionOnboardingData>>;
  activityLevels: typeof ACTIVITY_LEVELS;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Activity Level (outside training)</h3>
        <div className="space-y-2">
          {activityLevels.map(level => (
            <button
              key={level.value}
              onClick={() => setFormData(prev => ({ ...prev, activity_level: level.value }))}
              className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                formData.activity_level === level.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
              }`}
            >
              <p className="font-medium text-slate-900 dark:text-white">{level.label}</p>
              <p className="text-sm text-slate-500">{level.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Daily Hydration Goal</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1500"
            max="4000"
            step="250"
            value={formData.hydration_baseline_ml}
            onChange={(e) => setFormData(prev => ({ ...prev, hydration_baseline_ml: parseInt(e.target.value) }))}
            className="flex-1 accent-blue-500"
          />
          <span className="w-20 text-center text-lg font-bold text-blue-600">
            {(formData.hydration_baseline_ml / 1000).toFixed(1)}L
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">Adjust based on your typical daily water intake</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Sleep Schedule (optional)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Bedtime</label>
            <input
              type="time"
              value={formData.sleep_schedule_start || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, sleep_schedule_start: e.target.value || undefined }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Wake time</label>
            <input
              type="time"
              value={formData.sleep_schedule_end || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, sleep_schedule_end: e.target.value || undefined }))}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Supplements (optional)</h3>
        <textarea
          value={formData.supplements?.join(', ') || ''}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            supplements: e.target.value ? e.target.value.split(',').map(s => s.trim()) : []
          }))}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          placeholder="e.g., Vitamin D, Fish Oil, Creatine..."
          rows={2}
        />
      </div>
    </div>
  )
}

// Step 5: Review
function ReviewStep({ formData }: { formData: NutritionOnboardingData }) {
  const goalLabel = NUTRITION_GOALS.find(g => g.value === formData.primary_goal)?.label || formData.primary_goal
  const dietLabel = DIET_TYPES.find(d => d.value === formData.diet_type)?.label || formData.diet_type
  const activityLabel = ACTIVITY_LEVELS.find(a => a.value === formData.activity_level)?.label || formData.activity_level

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Review Your Nutrition Profile</h3>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Primary Goal</span>
          <span className="font-medium text-slate-900 dark:text-white">{goalLabel}</span>
        </div>
        {formData.current_weight_kg && (
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Current Weight</span>
            <span className="font-medium text-slate-900 dark:text-white">{formData.current_weight_kg} kg</span>
          </div>
        )}
        {formData.target_weight_kg && (
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Target Weight</span>
            <span className="font-medium text-slate-900 dark:text-white">{formData.target_weight_kg} kg</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Meals Per Day</span>
          <span className="font-medium text-slate-900 dark:text-white">{formData.meals_per_day}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Diet Type</span>
          <span className="font-medium text-slate-900 dark:text-white">{dietLabel}</span>
        </div>
        {formData.allergies.length > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Allergies</span>
            <span className="font-medium text-slate-900 dark:text-white">{formData.allergies.join(', ')}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Activity Level</span>
          <span className="font-medium text-slate-900 dark:text-white">{activityLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Hydration Goal</span>
          <span className="font-medium text-blue-600">{(formData.hydration_baseline_ml / 1000).toFixed(1)}L / day</span>
        </div>
      </div>

      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4">
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <Sparkles className="w-4 h-4 inline-block mr-1" />
          Click &quot;Generate My Plan&quot; to create a personalized nutrition plan that adapts to your training schedule,
          providing daily macro targets, meal suggestions, and hydration goals.
        </p>
      </div>
    </div>
  )
}

