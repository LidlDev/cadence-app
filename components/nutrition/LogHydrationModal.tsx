'use client'

import { useState } from 'react'
import { X, Droplets, Coffee, Zap, Leaf, GlassWater, CupSoda, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LogHydrationModalProps {
  onClose: () => void
  onSave: () => void
}

const BEVERAGE_OPTIONS = [
  { type: 'water', label: 'Water', icon: GlassWater, color: 'bg-blue-100 text-blue-600 border-blue-300' },
  { type: 'electrolytes', label: 'Electrolytes', icon: Zap, color: 'bg-yellow-100 text-yellow-600 border-yellow-300' },
  { type: 'sports_drink', label: 'Sports Drink', icon: CupSoda, color: 'bg-green-100 text-green-600 border-green-300' },
  { type: 'coffee', label: 'Coffee', icon: Coffee, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { type: 'tea', label: 'Tea', icon: Leaf, color: 'bg-emerald-100 text-emerald-600 border-emerald-300' },
  { type: 'other', label: 'Other', icon: Droplets, color: 'bg-slate-100 text-slate-600 border-slate-300' },
]

const QUICK_AMOUNTS = [100, 200, 250, 300, 350, 500, 750, 1000]

export default function LogHydrationModal({ onClose, onSave }: LogHydrationModalProps) {
  const [selectedType, setSelectedType] = useState('water')
  const [amount, setAmount] = useState(250)
  const [customAmount, setCustomAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const finalAmount = customAmount ? parseInt(customAmount) : amount
      const { error } = await supabase.from('hydration_logs').insert({
        user_id: user.id,
        log_date: new Date().toISOString().split('T')[0],
        amount_ml: finalAmount,
        beverage_type: selectedType,
        notes: notes || null,
      })
      if (error) throw error
      onSave()
      onClose()
    } catch (error) {
      console.error('Error logging hydration:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const displayAmount = customAmount ? parseInt(customAmount) || 0 : amount

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Log Hydration</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Beverage Type</label>
            <div className="grid grid-cols-3 gap-2">
              {BEVERAGE_OPTIONS.map(option => (
                <button
                  key={option.type}
                  onClick={() => setSelectedType(option.type)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    selectedType === option.type
                      ? `${option.color} border-current ring-2 ring-offset-2 ring-current`
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                  }`}
                >
                  <option.icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Amount (ml)</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {QUICK_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => { setAmount(amt); setCustomAmount(''); }}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    amount === amt && !customAmount
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {amt}ml
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Custom:</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                max="5000"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">ml</span>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{displayAmount}ml</p>
            <p className="text-sm text-blue-700 dark:text-blue-300 capitalize">
              {BEVERAGE_OPTIONS.find(o => o.type === selectedType)?.label || 'Water'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Post-run, With meal..."
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleSave}
            disabled={isSaving || displayAmount <= 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" />Saving...</> : <><Droplets className="w-5 h-5" />Log {displayAmount}ml</>}
          </button>
        </div>
      </div>
    </div>
  )
}
