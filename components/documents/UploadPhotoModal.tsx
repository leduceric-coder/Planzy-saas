'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'

const THEMES = ['Avancement', 'Problème', 'Livraison', 'Réception', 'Chantier', 'Autre']
const MAX_SIZE_MB = 10
// Must match bucket allowed_mime_types: image/jpeg, image/png, image/webp, image/heic
const ACCEPTED = '.jpg,.jpeg,.png,.webp,.heic'

interface Props {
  orgId: string
  projects: { id: string; name: string }[]
  onClose: () => void
  defaultProjectId?: string
}

export function UploadPhotoModal({ orgId, projects, onClose, defaultProjectId }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [theme, setTheme] = useState('Avancement')
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Sélectionnez une image (JPG, PNG, WebP, HEIC)'); return }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) { setError(`L'image dépasse ${MAX_SIZE_MB} Mo`); return }
    setError(null)
    setFile(f)
    const prevUrl = URL.createObjectURL(f)
    setPreview(prevUrl)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Sélectionnez une photo'); return }
    if (!projectId) { setError('Sélectionnez un chantier'); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    // Path format: {org_id}/{project_id}/{timestamp}-{random}.{ext}
    const path = `${orgId}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadErr) { setError(uploadErr.message); setLoading(false); return }

    const { data: { user } } = await supabase.auth.getUser()

    // Store durable storage_path — signed URLs are generated at render time (server-side)
    const { error: dbErr } = await mutationClient()
      .from('photos')
      .insert({
        org_id: orgId,
        project_id: projectId,
        url: path,
        storage_path: path,
        caption: caption.trim() || null,
        theme,
        taken_by: user?.id ?? null,
        taken_at: new Date().toISOString(),
      })

    if (dbErr) {
      await supabase.storage.from('photos').remove([path])
      setError(dbErr.message)
      setLoading(false)
      return
    }

    toast('Photo ajoutée')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Ajouter une photo">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Photo picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Photo <span className="text-destructive">*</span>
          </label>
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            {preview ? (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border border-border">
                <img src={preview} alt="preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-end justify-center pb-2 bg-gradient-to-t from-black/40 to-transparent">
                  <span className="text-white text-xs font-600">Cliquer pour changer</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full p-6 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors bg-background">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliquer pour sélectionner</span>
                <span className="text-xs text-muted-foreground opacity-70">JPG, PNG, WebP, HEIC — max {MAX_SIZE_MB} Mo</span>
              </div>
            )}
            <input type="file" className="hidden" onChange={handleFileChange} accept={ACCEPTED} />
          </label>
        </div>

        {/* Caption */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Légende <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <Input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Ex : Pose du dallage, niveau R+1…"
            className="h-10"
          />
        </div>

        {/* Theme */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Thème</label>
          <select
            value={theme}
            onChange={e => setTheme(e.target.value)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
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
            <p className="text-xs text-muted-foreground">Aucun chantier actif. Créez d'abord un chantier.</p>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading || projects.length === 0} className="flex-1">
            {loading ? 'Envoi…' : 'Ajouter la photo'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </SlidePanel>
  )
}
