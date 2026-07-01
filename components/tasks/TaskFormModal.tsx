'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import { cn, formatDate, taskStatusLabel, priorityLabel } from '@/lib/utils'
import {
  addBusinessDays,
  countBusinessDays,
  businessDaysToDuration,
  durationToBusinessDays,
  toISODate,
  type DurationInput,
} from '@/lib/business-days'
import { createTask, updateTask, checkArtisanConflicts, type TaskWithRelations, type TaskFormInput, type ArtisanConflict } from '@/lib/actions/tasks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { TaskStatus } from '@/lib/types'

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'review', 'done', 'validated']
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
type AssignmentType = 'none' | 'artisan' | 'team'

export interface ProjectOption { id: string; name: string; color: string }
export interface ArtisanOption { id: string; full_name: string; trade: string; color: string }
export interface TeamOption { id: string; name: string; color: string }

interface Props {
  mode: 'create' | 'edit'
  task?: TaskWithRelations
  projects: ProjectOption[]
  artisans: ArtisanOption[]
  teams: TeamOption[]
  defaultProjectId?: string
  defaultStartDate?: string
  onClose: () => void
  onSaved: (task: TaskWithRelations) => void
}

const selectClass = 'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50'
const labelClass = 'text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5 block'

export function TaskFormModal({ mode, task, projects, artisans, teams, defaultProjectId, defaultStartDate, onClose, onSaved }: Props) {
  const [projectId, setProjectId] = useState(() => task?.project_id ?? defaultProjectId ?? projects[0]?.id ?? '')
  const [title, setTitle] = useState(() => task?.title ?? '')
  const [description, setDescription] = useState(() => task?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(() => task?.status ?? 'todo')
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>(() => task?.priority ?? 'medium')

  const [startDate, setStartDate] = useState(() => task?.start_date ?? defaultStartDate ?? toISODate(new Date()))
  const [endDate, setEndDate] = useState(() => {
    if (task?.end_date) return task.end_date
    const start = task?.start_date ?? defaultStartDate ?? toISODate(new Date())
    return toISODate(addBusinessDays(start, 1))
  })
  const [durationValue, setDurationValue] = useState(() => {
    if (task?.start_date && task?.end_date) return businessDaysToDuration(countBusinessDays(task.start_date, task.end_date)).value
    return 1
  })
  const [durationUnit, setDurationUnit] = useState<DurationInput['unit']>(() => {
    if (task?.start_date && task?.end_date) return businessDaysToDuration(countBusinessDays(task.start_date, task.end_date)).unit
    return 'jours'
  })
  const [dateMode, setDateMode] = useState<'duration' | 'end'>(() => (task ? 'end' : 'duration'))

  const [assignmentType, setAssignmentType] = useState<AssignmentType>(() => (task?.assigned_to ? 'artisan' : task?.assigned_team ? 'team' : 'none'))
  const [assignedArtisanId, setAssignedArtisanId] = useState(() => task?.assigned_to ?? '')
  const [assignedTeamId, setAssignedTeamId] = useState(() => task?.assigned_team ?? '')

  const [conflicts, setConflicts] = useState<ArtisanConflict[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const selectedArtisan = artisans.find(a => a.id === assignedArtisanId)

  // Avertissement de conflit — n'empêche jamais l'enregistrement.
  useEffect(() => {
    const canCheck = assignmentType === 'artisan' && assignedArtisanId && startDate && endDate && endDate >= startDate
    let cancelled = false
    const timer = setTimeout(async () => {
      if (!canCheck) {
        if (!cancelled) setConflicts([])
        return
      }
      const result = await checkArtisanConflicts(assignedArtisanId, startDate, endDate, task?.id)
      if (!cancelled) setConflicts(result)
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [assignmentType, assignedArtisanId, startDate, endDate, task?.id])

  function recomputeEndFromDuration(start: string, value: number, unit: DurationInput['unit']) {
    if (!start || !value || value <= 0) return ''
    return toISODate(addBusinessDays(start, durationToBusinessDays({ value, unit })))
  }

  function applyDatesDuration(start: string, end: string) {
    if (!start || !end || end < start) return
    const dur = businessDaysToDuration(countBusinessDays(start, end))
    setDurationValue(dur.value)
    setDurationUnit(dur.unit)
  }

  const handleStartDateChange = (value: string) => {
    setStartDate(value)
    if (dateMode === 'duration') {
      setEndDate(recomputeEndFromDuration(value, durationValue, durationUnit))
    } else if (endDate) {
      applyDatesDuration(value, endDate)
    }
  }

  const handleEndDateChange = (value: string) => {
    setEndDate(value)
    setDateMode('end')
    applyDatesDuration(startDate, value)
  }

  const handleDurationValueChange = (value: number) => {
    setDurationValue(value)
    setDateMode('duration')
    if (startDate) setEndDate(recomputeEndFromDuration(startDate, value, durationUnit))
  }

  const handleDurationUnitChange = (unit: DurationInput['unit']) => {
    setDurationUnit(unit)
    setDateMode('duration')
    if (startDate) setEndDate(recomputeEndFromDuration(startDate, durationValue, unit))
  }

  const handleAssignmentTypeChange = (type: AssignmentType) => {
    setAssignmentType(type)
    if (type !== 'artisan') setAssignedArtisanId('')
    if (type !== 'team') setAssignedTeamId('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) return setError('Le nom de la tâche est obligatoire.')
    if (!projectId) return setError('Le chantier est obligatoire.')
    if (startDate && endDate && endDate < startDate) return setError('La date de fin doit être égale ou postérieure à la date de début.')
    if (durationValue <= 0) return setError('La durée doit être strictement positive.')
    if (assignmentType === 'artisan' && !assignedArtisanId) return setError('Sélectionnez un artisan, ou choisissez « Aucun ».')
    if (assignmentType === 'team' && !assignedTeamId) return setError('Sélectionnez une équipe, ou choisissez « Aucun ».')

    const payload: TaskFormInput = {
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      start_date: startDate || null,
      end_date: endDate || null,
      assigned_to: assignmentType === 'artisan' ? assignedArtisanId : null,
      assigned_team: assignmentType === 'team' ? assignedTeamId : null,
    }

    setSaving(true)
    const result = mode === 'edit' && task ? await updateTask(task.id, payload) : await createTask(payload)
    setSaving(false)

    if (result.error || !result.data) {
      setError(result.error ?? 'Une erreur inattendue est survenue. Merci de réessayer.')
      return
    }

    setJustSaved(true)
    onSaved(result.data)
    setTimeout(onClose, 900)
  }

  const previousAssignmentLabel =
    assignmentType === 'team' && task?.assigned_to && task.assignee
      ? `Basculer vers « Équipe » retirera l'artisan ${task.assignee.full_name} actuellement affecté.`
      : assignmentType === 'artisan' && task?.assigned_team && task.team
        ? `Basculer vers « Artisan » retirera l'équipe ${task.team.name} actuellement affectée.`
        : null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Chantier + nom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Chantier</label>
              <select className={selectClass} value={projectId} onChange={e => setProjectId(e.target.value)} required>
                <option value="" disabled>Sélectionner un chantier…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Nom de la tâche</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Pose du carrelage" required />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date de début</label>
              <Input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Date de fin</label>
              <Input type="date" value={endDate} min={startDate || undefined} onChange={e => handleEndDateChange(e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label className={labelClass}>Durée</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={durationValue}
                onChange={e => handleDurationValueChange(Math.max(1, Number(e.target.value) || 0))}
                className="w-24"
              />
              <select className={cn(selectClass, 'w-36')} value={durationUnit} onChange={e => handleDurationUnitChange(e.target.value as DurationInput['unit'])}>
                <option value="jours">jours</option>
                <option value="semaines">semaines</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {durationUnit === 'semaines' && (
                <>{durationValue} semaine{durationValue > 1 ? 's' : ''} = {durationValue * 5} jours ouvrés · </>
              )}
              {endDate && startDate && endDate >= startDate ? `Date de fin estimée : ${formatDate(endDate)}` : 'Renseignez une date de début valide.'}
            </p>
          </div>

          {/* Statut + priorité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Statut</label>
              <select className={selectClass} value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{taskStatusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priorité</label>
              <select className={selectClass} value={priority} onChange={e => setPriority(e.target.value as (typeof PRIORITIES)[number])}>
                {PRIORITIES.map(p => <option key={p} value={p}>{priorityLabel(p)}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={description ?? ''}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Détails, consignes particulières…"
              className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
            />
          </div>

          {/* Affectation */}
          <div>
            <label className={labelClass}>Affectation</label>
            <div className="flex gap-2 mb-3">
              {(['none', 'artisan', 'team'] as const).map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => handleAssignmentTypeChange(t)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-600 border transition-all',
                    assignmentType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-border/60 hover:text-foreground'
                  )}
                >
                  {t === 'none' ? 'Aucun' : t === 'artisan' ? 'Artisan' : 'Équipe'}
                </button>
              ))}
            </div>

            {previousAssignmentLabel && (
              <p className="text-xs text-yellow-500 mb-2">{previousAssignmentLabel}</p>
            )}

            {assignmentType === 'artisan' && (
              <>
                <select className={selectClass} value={assignedArtisanId} onChange={e => setAssignedArtisanId(e.target.value)}>
                  <option value="" disabled>Sélectionner un artisan…</option>
                  {artisans.map(a => <option key={a.id} value={a.id}>{a.full_name} — {a.trade}</option>)}
                </select>
                {selectedArtisan && (
                  <div className="mt-2 flex items-center gap-2.5 bg-background border border-border rounded-lg p-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-700 shrink-0" style={{ background: selectedArtisan.color }}>
                      {selectedArtisan.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-600 text-foreground truncate">{selectedArtisan.full_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{selectedArtisan.trade}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {assignmentType === 'team' && (
              <select className={selectClass} value={assignedTeamId} onChange={e => setAssignedTeamId(e.target.value)}>
                <option value="" disabled>Sélectionner une équipe…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            {conflicts.length > 0 && (
              <div className="mt-3 flex gap-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-xs text-foreground space-y-1">
                  <p className="font-600">Double affectation possible</p>
                  {conflicts.map(c => (
                    <p key={c.taskId} className="text-muted-foreground">
                      {selectedArtisan?.full_name} est déjà affecté du {formatDate(c.startDate)} au {formatDate(c.endDate)} sur {c.projectName} ({c.taskTitle}).
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {justSaved && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-500">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Tâche enregistrée avec succès.
            </div>
          )}

          <DialogFooter className="mt-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving || justSaved}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
