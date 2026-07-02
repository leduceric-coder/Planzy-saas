'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Mail, Pencil, Archive, X } from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-context'
import { EditArtisanModal } from '@/components/equipes/EditArtisanModal'

interface ArtisanRow {
  id: string
  org_id: string
  full_name: string | null
  trade: string | null
  color: string | null
  phone: string | null
  email: string | null
}

interface Props {
  artisans: ArtisanRow[]
}

export function ArtisanList({ artisans }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)

  const editingArtisan = artisans.find(a => a.id === editingId) ?? null
  const archivingArtisan = artisans.find(a => a.id === archivingId) ?? null

  const handleArchive = async () => {
    if (!archivingArtisan) return
    setArchiveLoading(true)
    const { error: err } = await mutationClient()
      .from('artisans')
      .update({ is_archived: true })
      .eq('id', archivingArtisan.id)
      .eq('org_id', archivingArtisan.org_id)
    setArchiveLoading(false)
    if (err) { toast(err.message, 'error'); return }
    toast('Artisan archivé')
    setArchivingId(null)
    router.refresh()
  }

  return (
    <>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {artisans.map((artisan) => {
            const artisanName = artisan.full_name ?? 'Artisan'
            const artisanInitial = artisanName.charAt(0).toUpperCase()
            const artisanColor = artisan.color ?? '#94a3b8'
            return (
              <div key={artisan.id} className="flex items-center gap-4 px-6 py-4 hover:bg-elevated transition-colors group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-700 shrink-0"
                  style={{ background: artisanColor }}
                >
                  {artisanInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{artisanName}</p>
                  <p className="text-xs text-muted-foreground">{artisan.trade}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  {artisan.phone && (
                    <a href={`tel:${artisan.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Phone className="h-3.5 w-3.5" />
                      {artisan.phone}
                    </a>
                  )}
                  {artisan.email && (
                    <a href={`mailto:${artisan.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      <Mail className="h-3.5 w-3.5" />
                      {artisan.email}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => setEditingId(artisan.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setArchivingId(artisan.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-colors"
                    title="Archiver"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {!artisans.length && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun artisan enregistré
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editingArtisan && (
        <EditArtisanModal
          artisan={editingArtisan}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Archive confirmation modal */}
      {archivingArtisan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-orange-500" />
                <h2 className="font-700 text-foreground">Archiver cet artisan ?</h2>
              </div>
              <button onClick={() => setArchivingId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-600 text-foreground">{archivingArtisan.full_name}</span> ne sera plus affiché dans la liste ni dans les assignations de tâches. Ses données sont conservées.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={handleArchive}
                  disabled={archiveLoading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-0"
                >
                  {archiveLoading ? 'Archivage…' : 'Archiver'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setArchivingId(null)} disabled={archiveLoading}>
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
