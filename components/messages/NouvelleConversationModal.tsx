'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'

interface Props {
  orgId: string
  currentUserId: string
  projects: { id: string; name: string; color: string }[]
  onClose: () => void
  onCreated: (threadId: string) => void
}

export function NouvelleConversationModal({ orgId, currentUserId, projects, onClose, onCreated }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() && !projectId) {
      setError('Saisissez un titre ou sélectionnez un chantier')
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await mutationClient()
      .from('message_threads')
      .insert({
        org_id: orgId,
        project_id: projectId || null,
        title: title.trim() || null,
        type: projectId ? 'project' : 'direct',
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    toast('Conversation créée')
    router.refresh()
    if (data?.id) onCreated(data.id)
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Nouvelle conversation">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Titre <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex : Réunion de chantier, Point hebdo…"
            className="h-10"
            autoFocus
          />
        </div>

        {/* Project */}
        {projects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-600 text-foreground">
              Chantier lié <span className="text-muted-foreground font-400">(optionnel)</span>
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="">— Aucun —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            {loading ? 'Création…' : 'Créer la conversation'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </SlidePanel>
  )
}
