'use client'

// Confirmation non bloquante et accessible (remplace window.confirm, qui gèle le
// thread principal et provoque un INP de plusieurs secondes). Rendu au-dessus du
// SlidePanel (z-[300] > z-[200]). role="alertdialog" + aria-labelledby/describedby.

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ConfirmTone = 'danger' | 'warning' | 'default'

export interface ConfirmState {
  title: string
  description: string
  confirmLabel: string
  tone?: ConfirmTone
  onConfirm: () => void
}

const TONE: Record<ConfirmTone, { btn: string; icon: string }> = {
  danger:  { btn: 'bg-destructive hover:bg-destructive/90 text-white', icon: 'text-destructive' },
  warning: { btn: 'bg-amber-500 hover:bg-amber-600 text-white',        icon: 'text-amber-500' },
  default: { btn: 'bg-primary hover:bg-primary/90 text-white',         icon: 'text-primary' },
}

export function ConfirmDialog({
  state, loading, onCancel,
}: {
  state: ConfirmState | null
  loading?: boolean
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!state) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, loading, onCancel])

  if (!state) return null
  const tone = TONE[state.tone ?? 'default']

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!loading) onCancel() }} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <div className={cn('w-9 h-9 rounded-xl bg-elevated flex items-center justify-center shrink-0', tone.icon)}>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="font-700 text-foreground leading-tight">{state.title}</h2>
            <p id="confirm-dialog-desc" className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{state.description}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-border text-sm font-600 text-foreground hover:bg-elevated disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={state.onConfirm}
            disabled={loading}
            className={cn('px-4 py-2 rounded-xl text-sm font-600 disabled:opacity-60 transition-colors', tone.btn)}
          >
            {loading ? '…' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
