'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'
import type { IssueStatus } from '@/lib/types'

const PRIORITIES = [
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Normale' },
  { value: 'high', label: 'Haute' },
  { value: 'critical', label: 'Critique' },
]

const STATUSES: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Ouvert' },
  { value: 'assigned', label: 'Assigné' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'fixed', label: 'Corrigé' },
  { value: 'validated', label: 'Validé' },
  { value: 'rejected', label: 'Rejeté' },
]

interface Artisan {
  id: string
  full_name: string | null
  color: string | null
}

interface IssueRow {
  id: string
  title: string
  description: string | null
  status: IssueStatus
  priority: string | null
  assigned_to: string | null
  artisan?: any
}

interface Props {
  issue: IssueRow
  projectId: string
  orgId: string
  artisans: Artisan[]
  onClose: () => void
}

export function EditReserveModal({ issue, projectId, orgId, artisans, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description ?? '')
  const [priority, setPriority] = useState(issue.priority ?? 'medium')
  const [status, setStatus] = useState<IssueStatus>(issue.status ?? 'open')
  const [assignedTo, setAssignedTo] = useState(issue.assigned_to ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est obligatoire'); return }
    setLoading(true)
    setError(null)

    const { error: err } = await mutationClient()
      .from('issues')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        assigned_to: assignedTo || null,
      })
      .eq('id', issue.id)
      .eq('project_id', projectId)
      .eq('org_id', orgId)

    if (err) { setError(err.message); setLoading(false); return }
    toast('Réserve mise à jour')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Modifier la réserve">
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

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Description <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
          />
        </div>

        {/* Priorité */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Priorité</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Statut */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Statut</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as IssueStatus)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

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
