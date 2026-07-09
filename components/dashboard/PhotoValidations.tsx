'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { PhotoThumb } from '@/components/ui/PhotoThumb'
import { PhotoSideWindow, type SidePhoto } from './PhotoSideWindow'

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

export type DashPhoto = {
  id: string
  url: string | null
  thumbnail_url: string | null
  caption: string | null
  project_id: string
  issue_status?: string | null
  project?: { name: string } | null
  author?: string | null
  created_at?: string | null
  validation_status?: string | null
  task?: { id: string; title: string } | null
  reviewer?: string | null
  reviewed_at?: string | null
  review_comment?: string | null
}

interface Props {
  photos: DashPhoto[]
  canReview?: boolean
}

export function PhotoValidations({ photos, canReview = false }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<SidePhoto | null>(null)

  return (
    <section className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[340px]">
      {/* Header — badge « N à valider » (LOT 40). Le compteur = longueur de la
          liste org-scoped affichée : badge == liste == pending autorisées. */}
      <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center gap-2 bg-surface">
        <Camera className="h-3.5 w-3.5 text-muted-foreground/70" />
        <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
          Photos &amp; validations
        </h2>
        {photos.length > 0 && (
          <span
            aria-label={`${photos.length} photo${photos.length > 1 ? 's' : ''} à valider`}
            title={`${photos.length} photo${photos.length > 1 ? 's' : ''} à valider`}
            className="ml-auto inline-flex items-center gap-1 px-2 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-700"
          >
            {photos.length} à valider
          </span>
        )}
      </div>

      {/* Photo grid — LOT 39 : uniquement les photos à valider (pending). */}
      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
          <Camera className="h-8 w-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground text-center">Aucune photo à valider.</p>
          <Link href="/documents" className="text-xs text-primary hover:underline">Accéder aux documents →</Link>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* LOT 40 — toutes les photos pending org-scoped (badge == liste). */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
            {photos.map(photo => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setSelected({
                  id: photo.id,
                  url: photo.url,
                  caption: photo.caption,
                  project_id: photo.project_id,
                  project: photo.project ?? null,
                  issue_status: photo.issue_status ?? null,
                  author: photo.author ?? null,
                  created_at: photo.created_at ?? null,
                  validation_status: photo.validation_status ?? 'pending',
                  task: photo.task ?? null,
                  reviewer: photo.reviewer ?? null,
                  reviewed_at: photo.reviewed_at ?? null,
                  review_comment: photo.review_comment ?? null,
                })}
                aria-label={`Ouvrir la photo : ${stripDemo(photo.caption) || 'Photo chantier'}`}
                className="aspect-square rounded-xl overflow-hidden bg-elevated relative group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <PhotoThumb
                  src={photo.thumbnail_url ?? photo.url}
                  caption={photo.caption}
                  alt={stripDemo(photo.caption) || 'Photo chantier'}
                  imgClassName="group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60 rounded-xl" />
                <div className="absolute bottom-1.5 inset-x-1.5">
                  <span className="flex items-center gap-1 text-[9px] font-700 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-white">
                    À valider
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <PhotoSideWindow
        photo={selected}
        canReview={canReview}
        onClose={() => setSelected(null)}
        onReviewed={() => { setSelected(null); router.refresh() }}
      />
    </section>
  )
}
