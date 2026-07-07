'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { cn } from '@/lib/utils'
import { SlidePanel } from '@/components/ui/SlidePanel'
import type { Project, ProjectStatus } from '@/lib/types'

const PALETTE = [
  '#2563EB', '#16A34A', '#DC2626', '#D97706',
  '#7C3AED', '#0891B2', '#DB2777', '#65A30D',
]

const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Actif' },
  { value: 'paused', label: 'En pause' },
  { value: 'completed', label: 'Terminé' },
  { value: 'archived', label: 'Archivé' },
]

const QUICK_VALUES = [0, 25, 50, 75, 100]

interface Props {
  project: Project
  suggestedProgress?: number
  onClose: () => void
}

export function EditChantierModal({ project, suggestedProgress, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(project.name)
  const [address, setAddress] = useState(project.address ?? '')
  const [startDate, setStartDate] = useState(project.start_date ?? '')
  const [endDate, setEndDate] = useState(project.end_date ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [description, setDescription] = useState(project.description ?? '')
  const [color, setColor] = useState(project.color ?? PALETTE[0])
  const [progress, setProgress] = useState(project.progress ?? 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom du chantier est obligatoire'); return }
    if (startDate && endDate && endDate < startDate) {
      setError('La date de fin ne peut pas être antérieure à la date de début'); return
    }
    setLoading(true)
    setError(null)

    const safeProgress = Math.min(100, Math.max(0, Math.round(progress)))

    const { error: err } = await mutationClient()
      .from('projects')
      .update({
        name: name.trim(),
        address: address.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        status,
        description: description.trim() || null,
        color,
        progress: safeProgress,
      })
      .eq('id', project.id)
      .eq('org_id', project.org_id)

    if (err) { setError(err.message); setLoading(false); return }
    toast('Chantier mis à jour')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Modifier le chantier">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Nom */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Nom du chantier <span className="text-destructive">*</span>
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-10"
            autoFocus
          />
        </div>

        {/* Adresse */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Adresse <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <Input
            placeholder="12 rue de la Paix, Paris"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">Date de début</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">Date de fin</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10" />
          </div>
        </div>

        {/* Statut */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Statut</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as ProjectStatus)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Description <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <textarea
            placeholder="Détails du chantier, contexte, contraintes…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
          />
        </div>

        {/* Avancement */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-600 text-foreground">Avancement</label>
            <span className="text-sm font-700 text-foreground">{progress}%</span>
          </div>

          {suggestedProgress !== undefined && suggestedProgress !== progress && (
            <div className="flex items-center justify-between text-xs bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
              <span className="text-primary">
                Suggéré d'après les tâches : <strong>{suggestedProgress}%</strong>
              </span>
              <button
                type="button"
                onClick={() => setProgress(suggestedProgress)}
                className="text-primary font-600 hover:underline ml-3 shrink-0"
              >
                Utiliser
              </button>
            </div>
          )}

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={progress}
            onChange={e => setProgress(Number(e.target.value))}
            className="w-full accent-primary h-2 cursor-pointer"
          />

          <div className="flex gap-1.5">
            {QUICK_VALUES.map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setProgress(v)}
                className={cn(
                  'flex-1 text-xs py-1 rounded-lg font-600 transition-colors',
                  progress === v
                    ? 'bg-primary text-white'
                    : 'bg-elevated text-muted-foreground hover:bg-border'
                )}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>

        {/* Couleur */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">Couleur</label>
          <div className="flex gap-2">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.2)' : undefined,
                  boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </SlidePanel>
  )
}
