'use client'

import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Dumbbell, Target, Scale, Calendar, Wrench, BarChart3, MessageSquare, Sparkles, Loader2 } from 'lucide-react'
import { StrengthOnboardingData, StrengthGoal, WeightGoal, RunningIntegration, EquipmentAccess, ExperienceLevel } from '@/lib/types/database'

interface StrengthOnboardingProps {
  onComplete: (data: StrengthOnboardingData) => Promise<void>
  isGenerating: boolean
}

const STEPS = [
  { id: 'goals', title: 'Strength Goals', icon: Target },
  { id: 'weight', title: 'Weight Goals', icon: Scale },
  { id: 'running', title: 'Running Integration', icon: Dumbbell },
  { id: 'days', title: 'Training Days', icon: Calendar },
  { id: 'equipment', title: 'Equipment Access', icon: Wrench },
  { id: 'experience', title: 'Experience Level', icon: BarChart3 },
  { id: 'notes', title: 'Additional Info', icon: MessageSquare },
]

const STRENGTH_GOALS: { value: StrengthGoal; label: string; description: string }[] = [
  { value: 'running_performance', label: '🏃 Improve Running', description: 'Build strength to run faster and more efficiently' },
  { value: 'injury_prevention', label: '🛡️ Injury Prevention', description: 'Strengthen weak areas to stay injury-free' },
  { value: 'build_muscle', label: '💪 Build Muscle', description: 'Increase muscle mass and definition' },
  { value: 'power_development', label: '⚡ Develop Power', description: 'Explosive strength for hills and sprints' },
  { value: 'general_fitness', label: '🎯 General Fitness', description: 'Overall strength and conditioning' },
  { value: 'weight_loss', label: '🔥 Support Weight Loss', description: 'Build muscle to boost metabolism' },
]

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string; description: string }[] = [
  { value: 'full_gym', label: '🏋️ Full Gym', description: 'Access to barbells, dumbbells, machines, cables' },
  { value: 'home_gym', label: '🏠 Home Gym', description: 'Dumbbells, kettlebells, resistance bands' },
  { value: 'minimal', label: '🎒 Minimal Equipment', description: 'Just a few dumbbells or bands' },
  { value: 'bodyweight', label: '🤸 Bodyweight Only', description: 'No equipment needed' },
]

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner', label: '🌱 Beginner', description: 'New to strength training or returning after a long break' },
  { value: 'intermediate', label: '📈 Intermediate', description: '6+ months of consistent training' },
  { value: 'advanced', label: '🏆 Advanced', description: '2+ years of structured strength training' },
]

export default function StrengthOnboarding({ onComplete, isGenerating }: StrengthOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<StrengthOnboardingData>({
    strength_goals: [],
    weight_goal: 'maintain',
    running_integration: 'complement_running',
    training_days: [],
    equipment_access: 'full_gym',
    experience_level: 'beginner',
    plan_weeks: 12,
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

  const toggleGoal = (goal: StrengthGoal) => {
    setFormData(prev => ({
      ...prev,
      strength_goals: prev.strength_goals.includes(goal)
        ? prev.strength_goals.filter(g => g !== goal)
        : [...prev.strength_goals, goal]
    }))
  }

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      training_days: prev.training_days.includes(day)
        ? prev.training_days.filter(d => d !== day)
        : [...prev.training_days, day]
    }))
  }

  const canProceed = () => {
    switch (STEPS[currentStep].id) {
      case 'goals': return formData.strength_goals.length > 0
      case 'days': return formData.training_days.length > 0
      default: return true
    }
  }

  const renderStepContent = () => {
    const stepId = STEPS[currentStep].id

    switch (stepId) {
      case 'goals':
        return (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Select your primary strength training goals (choose all that apply):
            </p>
            <div className="grid gap-3">
              {STRENGTH_GOALS.map(goal => (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() => toggleGoal(goal.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.strength_goals.includes(goal.value)
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{goal.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{goal.description}</div>
                </button>
              ))}
            </div>
          </div>
        )

      case 'weight':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              What are your weight-related goals?
            </p>
            <div className="grid gap-3">
              {(['maintain', 'lose', 'gain'] as WeightGoal[]).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, weight_goal: option }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.weight_goal === option
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white capitalize">
                    {option === 'maintain' ? '⚖️ Maintain Weight' : option === 'lose' ? '📉 Lose Weight' : '📈 Gain Weight/Muscle'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      case 'running':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              How should strength training fit with your running?
            </p>
            <div className="grid gap-3">
              {[
                { value: 'complement_running' as RunningIntegration, label: '🤝 Complement Running', desc: 'Schedule around runs for optimal recovery' },
                { value: 'recovery_focused' as RunningIntegration, label: '🧘 Recovery Focused', desc: 'Light sessions on easy/rest days' },
                { value: 'separate' as RunningIntegration, label: '📊 Separate Focus', desc: 'Independent strength block' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, running_integration: option.value }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.running_integration === option.value
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )

      case 'days':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Which days can you dedicate to strength training?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    formData.training_days.includes(day)
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{day.slice(0, 3)}</div>
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
              Selected: {formData.training_days.length} days/week
            </p>
          </div>
        )

      case 'equipment':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              What equipment do you have access to?
            </p>
            <div className="grid gap-3">
              {EQUIPMENT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, equipment_access: option.value }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.equipment_access === option.value
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        )

      case 'experience':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              What's your strength training experience level?
            </p>
            <div className="grid gap-3">
              {EXPERIENCE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, experience_level: option.value }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.experience_level === option.value
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-orange-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-white">{option.label}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        )

      case 'notes':
        return (
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Anything else we should know? (injuries, limitations, preferences)
            </p>
            <textarea
              value={formData.additional_notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, additional_notes: e.target.value }))}
              placeholder="E.g., recovering from knee injury, prefer morning workouts, limited time on weekdays..."
              className="w-full h-32 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-orange-500 focus:outline-none"
            />
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Plan Duration (weeks)
              </label>
              <select
                value={formData.plan_weeks}
                onChange={(e) => setFormData(prev => ({ ...prev, plan_weeks: parseInt(e.target.value) }))}
                className="w-full p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value={8}>8 weeks</option>
                <option value={12}>12 weeks</option>
                <option value={16}>16 weeks</option>
              </select>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header with Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <Dumbbell className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Your Strength Plan
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-1">
          {STEPS.map((step, idx) => (
            <div
              key={step.id}
              className={`h-2 flex-1 rounded-full transition-colors ${
                idx <= currentStep
                  ? 'bg-orange-500'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${
            currentStep === 0
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${
              canProceed()
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isGenerating || !canProceed()}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-colors ${
              isGenerating
                ? 'bg-orange-400 text-white cursor-wait'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Plan...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Create AI Plan
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
