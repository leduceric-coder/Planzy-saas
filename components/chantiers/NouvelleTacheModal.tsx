'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { AssignmentPicker, type AssignValue, type TeamOption, type ArtisanOption } from '@/components/ui/AssignmentPicker'

interface Props {
  projectId: string
  orgId: string
  artisans: ArtisanOption[]
  teams?: TeamOption[]
  onClose: () => void
}

export function NouvelleTacheModal({ projectId, orgId, artisans, teams = [], onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'done'>('todo')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [assignment, setAssignment] = useState<AssignValue>({ assigned_to: null, assigned_team: null })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est obligatoire'); return }
    if ((startDate && !endDate) || (!startDate && endDate)) {
      setError('Veuillez renseigner les deux dates ou aucune')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('La date de fin ne peut pas être antérieure à la date de début')
      return
    }
    setLoading(true)
    setError(null)

    const { error: err } = await mutationClient().from('tasks').insert({
      project_id: projectId,
      org_id: orgId,
      title: title.trim(),
      status,
      start_date: startDate || null,
      end_date: endDate || null,
      assigned_to: assignment.assigned_to,
      assigned_team: assignment.assigned_team,
      position: 0,
    })

    if (err) { setError(err.message); setLoading(false); return }
    toast('Tâche créée avec succès')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Nouvelle tâche">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Titre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Titre <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Ex : Pose carrelage salle de bain"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
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

        {/* Assignation */}
        <AssignmentPicker
          artisans={artisans}
          teams={teams}
          value={assignment}
          onChange={setAssignment}
        />

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Ajout…' : 'Ajouter la tâche'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </SlidePanel>
  )
}
