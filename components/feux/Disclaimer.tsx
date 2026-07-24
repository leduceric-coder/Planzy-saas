'use client'

// ── Feux France — avertissements réglementaires / de prudence ────────────────
// Visible mais discret. Rappelle qu'une détection satellite n'est pas une
// confirmation officielle d'incendie, et les numéros d'urgence.

import { useEffect, useState } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

const DISMISS_KEY = 'feux-disclaimer-dismissed'

export default function Disclaimer() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed) return null

  return (
    <div
      role="note"
      className="pointer-events-auto mx-auto max-w-3xl rounded-lg border border-warning/40 bg-surface/95 p-3 text-xs shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
        <div className="space-y-1.5 text-muted-foreground">
          <p>
            Les points affichés sont des <strong className="text-foreground">détections satellitaires de chaleur</strong>. Ils ne
            constituent pas une confirmation officielle d&apos;incendie et peuvent inclure certaines
            sources de chaleur industrielles ou naturelles.
          </p>
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
            <span>
              En cas d&apos;urgence ou de départ de feu observé, appelez le{' '}
              <strong className="text-foreground">18</strong> ou le{' '}
              <strong className="text-foreground">112</strong>. Ne vous rendez pas sur les lieux
              signalés.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(DISMISS_KEY, '1')
            } catch {
              /* stockage indisponible */
            }
          }}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-elevated hover:text-foreground"
          aria-label="Masquer l'avertissement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
