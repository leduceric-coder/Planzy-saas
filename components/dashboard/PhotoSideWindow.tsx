'use client'

// Side-window de consultation d'une photo (LOT 38, ouverte depuis le Dashboard).
// Consulter, agrandir, identifier le chantier / l'auteur / la date / le statut.
//
// Valider / Refuser : NON implémenté ici. Le modèle `photos` ne possède aucun
// champ de validation (pas de status/validated/rejected) et aucun chemin de
// mutation « validation photo » n'existe. Créer ce statut relèverait d'un lot
// modèle (colonne + RLS), hors périmètre de ce lot (aucune modif DB/RLS/Storage).
// La side-window renvoie donc vers la fiche chantier pour le suivi des réserves.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Maximize2, Building2, User, Calendar, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

export type SidePhoto = {
  id: string
  url: string | null
  caption: string | null
  project_id: string
  project?: { name: string } | null
  issue_status?: string | null
  author?: string | null
  created_at?: string | null
}

function statusBadge(issueStatus: string | null | undefined): { label: string; cls: string } {
  if (issueStatus === 'open') return { label: 'Réserve ouverte', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' }
  if (issueStatus === 'closed' || issueStatus === 'resolved' || issueStatus === 'fixed' || issueStatus === 'validated')
    return { label: 'Réserve levée', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' }
  return { label: 'Photo terrain', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' }
}

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

interface Props {
  photo: SidePhoto | null
  onClose: () => void
}

export function PhotoSideWindow({ photo, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isOpen = !!photo
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!mounted) return null

  const badge = photo ? statusBadge(photo.issue_status) : null
  const title = stripDemo(photo?.caption) || 'Photo chantier'

  return createPortal(
    <>
      {/* Overlay — clic extérieur ferme */}
      <div
        className={cn(
          'fixed inset-0 z-[9980] bg-black/30 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Panneau */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Détail de la photo"
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[9981] w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col transition-transform duration-200 motion-reduce:transition-none',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-border">
          <h2 className="text-sm font-700 text-foreground truncate">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {photo && (
          <div className="flex-1 overflow-y-auto">
            {/* Image + agrandir */}
            <div className="relative bg-elevated">
              {photo.url ? (
                <>
                  <img src={photo.url} alt={title} className="w-full max-h-[46vh] object-contain bg-black/5" />
                  <a
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-600 hover:bg-black/75 transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Agrandir
                  </a>
                </>
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-xs text-muted-foreground">
                  Aperçu indisponible.
                </div>
              )}
            </div>

            {/* Métadonnées */}
            <div className="p-5 flex flex-col gap-4">
              {badge && (
                <span className={cn('inline-flex w-fit items-center px-2.5 py-1 rounded-full text-[11px] font-700', badge.cls)}>
                  {badge.label}
                </span>
              )}

              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <dt className="sr-only">Chantier</dt>
                  <dd className="text-foreground font-500 truncate">{photo.project?.name ?? 'Chantier inconnu'}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <dt className="sr-only">Transmise par</dt>
                  <dd className="text-foreground truncate">{photo.author ?? 'Auteur inconnu'}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <dt className="sr-only">Date</dt>
                  <dd className="text-muted-foreground">{photo.created_at ? formatDate(photo.created_at) : '—'}</dd>
                </div>
              </dl>

              {photo.caption && stripDemo(photo.caption) && (
                <p className="text-[13px] text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
                  {stripDemo(photo.caption)}
                </p>
              )}

              {/* Suivi de validation : via la fiche chantier (réserves).
                  Valider/Refuser au niveau photo nécessite un lot modèle. */}
              <Link
                href={`/chantiers/${photo.project_id}`}
                className="mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
              >
                Ouvrir le chantier
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-[11px] text-muted-foreground/70 text-center leading-relaxed">
                La validation ou le refus des photos se gère depuis les réserves du chantier.
              </p>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
