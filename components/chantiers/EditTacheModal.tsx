'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { DurationField } from '@/components/ui/DurationField'
import type { Task } from '@/lib/types'

interface Artisan {
  id: string
  full_name: string | null
  color: string | null
}

interface Props {
  task: Task & { assignee?: any }
  projectId: string
  artisans: Artisan[]
  onClose: () => void
}

export function EditTacheModal({ task, projectId, artisans, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'blocked' | 'done'>(
    (['todo', 'in_progress', 'blocked', 'done'].includes(task.status ?? '')
      ? task.status as 'todo' | 'in_progress' | 'blocked' | 'done'
      : 'todo')
  )
  const [startDate, setStartDate] = useState(task.start_date ?? '')
  const [endDate, setEndDate] = useState(task.end_date ?? '')
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est obligatoire'); return }
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setError('Veuillez renseigner les deux dates ou aucune'); return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('La date de fin ne peut pas être antérieure à la date de début'); return
    }
    setLoading(true)
    setError(null)

    const { error: err } = await mutationClient()
      .from('tasks')
      .update({
        title: title.trim(),
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        assigned_to: assignedTo || null,
      })
      .eq('id', task.id)
      .eq('project_id', projectId)

    if (err) { setError(err.message); setLoading(false); return }
    toast('Tâche mise à jour')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Modifier la tâche">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Titre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Titre <span className="text-destructive">*</span>
          </label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="h-10"
            autoFocus
          />
        </div>

        {/* Statut */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Statut</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as typeof status)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="todo">À faire</option>
            <option value="in_progress">En cours</option>
            <option value="blocked">Bloquée</option>
            <option value="done">Terminée</option>
          </select>
        </div>

        {/* Dates */}
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-600 text-foreground">Début</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-600 text-foreground">Fin</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10" />
            </div>
          </div>
          {!startDate && !endDate && (
            <p className="text-xs text-muted-foreground">
              Sans dates, la tâche n'apparaîtra pas dans le planning.
            </p>
          )}
        </div>

        {/* Durée (jours / semaines) — pilote la date de fin */}
        <DurationField startDate={startDate} endDate={endDate} onEndDateChange={setEndDate} />

        {/* Artisan */}
        {artisans.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">
              Artisan assigné <span className="text-muted-foreground font-400">(optionnel)</span>
            </label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="">— Aucun —</option>
              {artisans.map(a => (
                <option key={a.id} value={a.id}>{a.full_name ?? 'Artisan'}</option>
              ))}
            </select>
          </div>
        )}

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
