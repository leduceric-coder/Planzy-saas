'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'

const CATEGORIES = ['Plan', 'Contrat', 'Facture', 'CCTP', 'PV de réception', 'Autre']
const MAX_SIZE_MB = 20
const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip'

// Certains navigateurs (Chrome/Edge) envoient des MIME types incorrects pour certains formats.
// Le bucket Supabase vérifie allowed_mime_types strictement — on normalise ici.
const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip:  'application/zip',  // Chrome envoie application/x-zip-compressed
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

function normalizeMime(file: File): string {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  return MIME_MAP[ext] ?? file.type ?? 'application/octet-stream'
}

interface Props {
  orgId: string
  projects: { id: string; name: string }[]
  onClose: () => void
  defaultProjectId?: string
}

export function UploadDocumentModal({ orgId, projects, onClose, defaultProjectId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Autre')
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Le fichier dépasse ${MAX_SIZE_MB} Mo`)
      return
    }
    setError(null)
    setFile(f)
    if (!name) setName(f.name.replace(/\.[^/.]+$/, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Sélectionnez un fichier'); return }
    if (!name.trim()) { setError('Le nom est obligatoire'); return }
    if (!projectId) { setError('Sélectionnez un chantier'); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    // Path format: {org_id}/{project_id}/{timestamp}-{random}.{ext}
    const path = `${orgId}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const contentType = normalizeMime(file)
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false, contentType })

    if (uploadErr) { setError(uploadErr.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()

    // Store durable storage_path — signed URLs are generated at render time (server-side)
    const { error: dbErr } = await mutationClient()
      .from('documents')
      .insert({
        org_id: orgId,
        project_id: projectId,
        name: name.trim(),
        file_url: path,
        storage_path: path,
        file_type: file.type,
        file_size: file.size,
        category,
        uploaded_by: user?.id ?? null,
      })

    if (dbErr) {
      await supabase.storage.from('documents').remove([path])
      setError(dbErr.message)
      setLoading(false)
      return
    }

    toast('Document ajouté')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Ajouter un document">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* File picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Fichier <span className="text-destructive">*</span>
          </label>
          <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-background">
            <Upload className="h-8 w-8 text-muted-foreground" />
            {file ? (
              <span className="text-sm text-foreground font-500">{file.name}</span>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Cliquer pour sélectionner</span>
                <span className="text-xs text-muted-foreground opacity-70">PDF, Word, Excel, image — max {MAX_SIZE_MB} Mo</span>
              </>
            )}
            <input type="file" className="hidden" onChange={handleFileChange} accept={ACCEPTED} />
          </label>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Nom <span className="text-destructive">*</span>
          </label>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-10" />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Catégorie</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Project */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Chantier <span className="text-destructive">*</span>
          </label>
          {projects.length > 0 ? (
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <option value="">— Sélectionner un chantier —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun chantier actif disponible. Créez d'abord un chantier.</p>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading || projects.length === 0} className="flex-1">
            {loading ? 'Envoi…' : 'Ajouter le document'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </SlidePanel>
  )
}
