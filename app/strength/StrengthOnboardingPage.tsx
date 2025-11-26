'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell } from 'lucide-react'
import StrengthOnboarding from '@/components/strength/StrengthOnboarding'
import { StrengthOnboardingData } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'

interface StrengthOnboardingPageProps {
  userId: string
}

export default function StrengthOnboardingPage({ userId }: StrengthOnboardingPageProps) {
  const router = useRouter()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleComplete = async (data: StrengthOnboardingData) => {
    setIsGenerating(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Call the edge function to generate the plan
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-strength-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ onboardingData: data })
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate plan')
      }

      // Success - refresh to show the new plan
      router.refresh()
    } catch (err) {
      console.error('Error generating plan:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-orange-100 dark:bg-orange-900/30 rounded-2xl mb-4">
            <Dumbbell className="w-12 h-12 text-orange-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Build Your Strength Plan
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Answer a few questions and our AI will create a personalized strength training plan 
            that complements your running goals.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 text-sm underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Onboarding Form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 sm:p-8">
          <StrengthOnboarding
            onComplete={handleComplete}
            isGenerating={isGenerating}
          />
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="text-2xl mb-2">🏃</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Running-Focused</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Exercises selected to improve your running performance
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">AI-Personalized</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Tailored to your goals, equipment, and schedule
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <div className="text-2xl mb-2">📈</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Progressive</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Gradually increases challenge as you get stronger
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

