'use client'

// ── Feux France — légende des couleurs d'ancienneté ──────────────────────────

import { AGE_COLORS, AGE_LABELS } from '@/lib/firms/format'
import type { AgeBucket } from '@/lib/firms/types'

const ORDER: AgeBucket[] = ['lt3h', '3to12h', '12to24h', 'gt24h']

export default function Legend() {
  return (
    <div
      className="pointer-events-auto rounded-lg border border-border bg-surface/95 p-3 text-xs shadow-lg backdrop-blur"
      aria-label="Légende de l'ancienneté des détections"
    >
      <p className="mb-2 font-semibold text-foreground">Ancienneté de la détection</p>
      <ul className="space-y-1.5">
        {ORDER.map((b) => (
          <li key={b} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/70"
              style={{ backgroundColor: AGE_COLORS[b] }}
              aria-hidden
            />
            <span className="text-muted-foreground">{AGE_LABELS[b]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
