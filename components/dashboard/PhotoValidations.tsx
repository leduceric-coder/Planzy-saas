'use client'

import Link from 'next/link'
import { Camera, ArrowRight, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PhotoThumb } from '@/components/ui/PhotoThumb'

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
}

interface Props {
  photos: DashPhoto[]
  openIssuesCount: number
}

function photoBadge(issueStatus: string | null | undefined): { label: string; cls: string } | null {
  if (issueStatus === 'open') return { label: 'Réserve', cls: 'bg-red-600/85 text-white' }
  if (issueStatus === 'closed' || issueStatus === 'resolved') return { label: 'Validé', cls: 'bg-green-600/85 text-white' }
  return { label: 'À valider', cls: 'bg-amber-500/85 text-white' }
}

export function PhotoValidations({ photos, openIssuesCount }: Props) {
  return (
    <section className="dashboard-tile bg-surface rounded-2xl border border-border/50 dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-full min-h-[340px]">
      {/* Header */}
      <div className="shrink-0 px-5 py-3.5 border-b border-border/25 flex items-center justify-between bg-surface">
        <div className="flex items-center gap-2">
          <Camera className="h-3.5 w-3.5 text-muted-foreground/70" />
          <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground">
            Photos & validations
          </h2>
        </div>
        <Link
          href="/documents"
          className="text-[11px] text-primary hover:text-primary/80 font-600 flex items-center gap-0.5 transition-colors"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Validation alert */}
      {openIssuesCount > 0 && (
        <div className="shrink-0 mx-4 mt-3 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
          <p className="text-[12px] font-600 text-orange-600 dark:text-orange-400 flex-1">
            {openIssuesCount} validation{openIssuesCount > 1 ? 's' : ''} en attente
          </p>
          <Link href="/chantiers" className="text-[11px] text-primary font-600 hover:underline shrink-0 flex items-center gap-0.5">
            Voir <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
          <Camera className="h-8 w-8 text-muted-foreground/25" />
          <p className="text-xs text-muted-foreground text-center">Aucune photo récente.</p>
          <Link href="/documents" className="text-xs text-primary hover:underline">Accéder aux documents →</Link>
        </div>
      ) : (
        <div className="flex-1 p-4">
          {/* LOT 27K — même correction que Documents & photos : grille intrinsèque
              (auto-fill/minmax) au lieu d'un nombre de colonnes fixe. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
            {photos.slice(0, 6).map(photo => {
              const badge = photoBadge(photo.issue_status)
              return (
                <Link
                  key={photo.id}
                  href={`/chantiers/${photo.project_id}`}
                  className="aspect-square rounded-xl overflow-hidden bg-elevated relative group block"
                >
                  <PhotoThumb
                    src={photo.thumbnail_url ?? photo.url}
                    caption={photo.caption}
                    alt={stripDemo(photo.caption) || 'Photo chantier'}
                    imgClassName="group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60 rounded-xl" />

                  {/* Badge */}
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
                </Link>
              )
            })}
          </div>

          {photos.length > 6 && (
            <Link
              href="/documents"
              className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/55 hover:text-primary transition-colors"
            >
              Voir toutes les photos <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
