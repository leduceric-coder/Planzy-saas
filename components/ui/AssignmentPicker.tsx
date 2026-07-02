'use client'

import { Users, User, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignValue {
  assigned_to: string | null
  assigned_team: string | null
}

export type AssignMode = 'none' | 'team' | 'artisan'

export interface TeamOption {
  id: string
  name: string
  color: string | null
  type: string | null
  memberCount: number
}

export interface ArtisanOption {
  id: string
  full_name: string | null
  trade: string | null
  color: string | null
}

interface Props {
  artisans: ArtisanOption[]
  teams: TeamOption[]
  value: AssignValue
  onChange: (v: AssignValue) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  chantier: 'Chantier',
  metier: 'Métier',
  entreprise: 'Entreprise',
  libre: 'Libre',
}

function modeFrom(v: AssignValue): AssignMode {
  if (v.assigned_team) return 'team'
  if (v.assigned_to) return 'artisan'
  return 'none'
}

const selectCls =
  'flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary'

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignmentPicker({ artisans, teams, value, onChange }: Props) {
  const mode = modeFrom(value)

  const setMode = (m: AssignMode) => {
    if (m === 'none') onChange({ assigned_to: null, assigned_team: null })
    else if (m === 'team') onChange({ assigned_to: null, assigned_team: teams[0]?.id ?? null })
    else onChange({ assigned_to: artisans[0]?.id ?? null, assigned_team: null })
  }

  const btnBase =
    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-600 rounded-lg transition-colors'
  const btnActive = 'bg-primary text-white'
  const btnInactive = 'text-muted-foreground hover:text-foreground hover:bg-elevated'

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-600 text-foreground">Assignation</label>

      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-elevated rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setMode('none')}
          className={cn(btnBase, mode === 'none' ? btnActive : btnInactive)}
        >
          <Minus className="h-3.5 w-3.5" />
          Non assigné
        </button>
        <button
          type="button"
          onClick={() => setMode('team')}
          className={cn(btnBase, mode === 'team' ? btnActive : btnInactive)}
          disabled={teams.length === 0}
          title={teams.length === 0 ? 'Aucune équipe disponible' : undefined}
        >
          <Users className="h-3.5 w-3.5" />
          Équipe
        </button>
        <button
          type="button"
          onClick={() => setMode('artisan')}
          className={cn(btnBase, mode === 'artisan' ? btnActive : btnInactive)}
          disabled={artisans.length === 0}
          title={artisans.length === 0 ? 'Aucun artisan disponible' : undefined}
        >
          <User className="h-3.5 w-3.5" />
          Artisan
        </button>
      </div>

      {/* Team picker */}
      {mode === 'team' && teams.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-500 text-muted-foreground">Équipe</label>
          <select
            value={value.assigned_team ?? ''}
            onChange={e => onChange({ assigned_to: null, assigned_team: e.target.value || null })}
            className={selectCls}
          >
            <option value="">— Choisir une équipe —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.type ? ` · ${TYPE_LABEL[t.type] ?? t.type}` : ''}
                {` · ${t.memberCount} membre${t.memberCount !== 1 ? 's' : ''}`}
              </option>
            ))}
          </select>
          {value.assigned_team && (() => {
            const team = teams.find(t => t.id === value.assigned_team)
            if (!team) return null
            return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: team.color ?? '#94a3b8' }}
                />
                <span className="text-sm font-600 text-foreground">{team.name}</span>
                {team.type && (
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABEL[team.type] ?? team.type}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {team.memberCount} membre{team.memberCount !== 1 ? 's' : ''}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {/* Artisan picker */}
      {mode === 'artisan' && artisans.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-500 text-muted-foreground">
            Artisan principal
          </label>
          <select
            value={value.assigned_to ?? ''}
            onChange={e => onChange({ assigned_to: e.target.value || null, assigned_team: null })}
            className={selectCls}
          >
            <option value="">— Choisir un artisan —</option>
            {artisans.map(a => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? 'Artisan'}
                {a.trade ? ` · ${a.trade}` : ''}
              </option>
            ))}
          </select>
          {value.assigned_to && (() => {
            const artisan = artisans.find(a => a.id === value.assigned_to)
            if (!artisan) return null
            return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-700 shrink-0"
                  style={{ background: artisan.color ?? '#94a3b8' }}
                >
                  {(artisan.full_name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="text-sm font-600 text-foreground">{artisan.full_name ?? 'Artisan'}</span>
                {artisan.trade && (
                  <span className="text-xs text-muted-foreground">{artisan.trade}</span>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Empty states */}
      {mode === 'team' && teams.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucune équipe disponible. Créez une équipe dans la section Équipes.
        </p>
      )}
      {mode === 'artisan' && artisans.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucun artisan disponible. Ajoutez des artisans dans la section Équipes.
        </p>
      )}
    </div>
  )
}
