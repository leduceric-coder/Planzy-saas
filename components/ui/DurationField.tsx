'use client'

// ─── LOT 26A — Saisie de durée en jours / semaines ──────────────────────────────
// Règle produit : 1 semaine = 5 jours ouvrés (lun-ven). Les dates start_date /
// end_date restent la vérité métier : ce champ ne fait que PILOTER end_date à
// partir d'une durée saisie, sans stocker d'unité en base.
//
// Comportement :
//  - tant qu'aucune durée n'est saisie, on affiche seulement la durée déduite
//    des dates existantes (mode dates manuelles inchangé) ;
//  - dès qu'une durée est saisie avec une date de début, on recalcule end_date
//    via l'arithmétique des jours ouvrés et on l'applique.

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import {
  addBusinessDays,
  countBusinessDays,
  durationToBusinessDays,
  toISODate,
  type DurationInput,
} from '@/lib/business-days'

interface Props {
  startDate: string
  endDate: string
  /** Applique la date de fin calculée (au format ISO yyyy-mm-dd). */
  onEndDateChange: (iso: string) => void
}

export function DurationField({ startDate, endDate, onEndDateChange }: Props) {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<DurationInput['unit']>('jours')

  // Durée déduite des dates existantes (bornes incluses), pour l'indication.
  const derivedDays = startDate && endDate ? countBusinessDays(startDate, endDate) : 0

  // Dès qu'une durée est saisie avec une date de début, end_date suit la durée.
  useEffect(() => {
    const n = Number(value)
    if (!startDate || !value || !Number.isFinite(n) || n <= 0) return
    const businessDays = durationToBusinessDays({ value: n, unit })
    const end = toISODate(addBusinessDays(startDate, businessDays))
    if (end !== endDate) onEndDateChange(end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, value, unit])

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-600 text-foreground flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
        Durée <span className="text-muted-foreground font-400">(optionnel)</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder={derivedDays > 0 ? String(derivedDays) : 'Ex : 3'}
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-10"
          disabled={!startDate}
        />
        <select
          value={unit}
          onChange={e => setUnit(e.target.value as DurationInput['unit'])}
          disabled={!startDate}
          className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
        >
          <option value="jours">jours ouvrés</option>
          <option value="semaines">semaines (5 j)</option>
        </select>
      </div>
      {!startDate ? (
        <p className="text-xs text-muted-foreground">Renseignez une date de début pour saisir une durée.</p>
      ) : Number(value) > 0 && endDate ? (
        <p className="text-xs text-primary">Fin estimée : {formatDate(endDate)}</p>
      ) : derivedDays > 0 ? (
        <p className="text-xs text-muted-foreground">Durée actuelle : {derivedDays} jour{derivedDays > 1 ? 's' : ''} ouvré{derivedDays > 1 ? 's' : ''}.</p>
      ) : null}
    </div>
  )
}
