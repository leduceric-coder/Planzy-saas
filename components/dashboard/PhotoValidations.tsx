'use client'

import { useState } from 'react'
import { Camera, ArrowRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
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
}

interface Props {
  photos: DashPhoto[]
}

function photoBadge(issueStatus: string | null | undefined): { label: string; cls: string } | null {
  if (issueStatus === 'open') return { label: 'Réserve', cls: 'bg-red-600/85 text-white' }
  if (issueStatus === 'closed' || issueStatus === 'resolved') return { label: 'Validé', cls: 'bg-green-600/85 text-white' }
  return { label: 'À valider', cls: 'bg-amber-500/85 text-white' }
}

export function PhotoValidations({ photos }: Props) {
  const [selected, setSelected] = useState<SidePhoto | null>(null)

  return (
    <section className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[340px]">
      {/* Header — LOT 38 : lien « Voir tout » retiré. */}
      <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center gap-2 bg-surface">
        <Camera className="h-3.5 w-3.5 text-muted-foreground/70" />
        <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
          Photos &amp; validations
        </h2>
      </div>

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
          <Camera className="h-8 w-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground text-center">Aucune photo récente.</p>
          <Link href="/documents" className="text-xs text-primary hover:underline">Accéder aux documents →</Link>
        </div>
      ) : (
        <div className="flex-1 p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
            {photos.slice(0, 6).map(photo => {
              const badge = photoBadge(photo.issue_status)
              return (
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
                  {badge && (
                    <div className="absolute bottom-1.5 inset-x-1.5">
                      <span className={cn(
                        'flex items-center gap-1 text-[9px] font-700 px-1.5 py-0.5 rounded-md',
                        badge.cls,
                      )}>
                        {badge.label === 'À valider' && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                        {badge.label}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <PhotoSideWindow photo={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
