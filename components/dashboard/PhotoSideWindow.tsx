'use client'

// Side-window de consultation + validation d'une photo (LOT 39).
// Consulter, agrandir, chantier, TÂCHE liée, auteur, date, statut de validation,
// et — pour les rôles autorisés — Valider / Refuser via la RPC sécurisée
// `review_photo` (SECURITY DEFINER, role-gated). JAMAIS d'UPDATE direct sur
// photos depuis le client.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Maximize2, Building2, User, Calendar, ArrowRight, ListChecks, Check, Ban, CheckCircle2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export type SidePhoto = {
  id: string
  url: string | null
  caption: string | null
  project_id: string
  project?: { name: string } | null
  issue_status?: string | null
  author?: string | null
  created_at?: string | null
  validation_status?: string | null
  task?: { id: string; title: string } | null
  reviewer?: string | null
  reviewed_at?: string | null
  review_comment?: string | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'À valider', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  approved: { label: 'Validée',   cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  rejected: { label: 'Refusée',   cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

function humanError(msg: string): string {
  if (msg.includes('NOT_AUTHORIZED')) return "Vous n'êtes pas autorisé à valider les photos."
  if (msg.includes('NOT_AUTHENTICATED')) return 'Session expirée, reconnectez-vous.'
  if (msg.includes('PHOTO_NOT_FOUND')) return 'Photo introuvable.'
  if (msg.includes('INVALID_STATUS')) return 'Statut invalide.'
  return msg || 'Une erreur est survenue.'
}

interface Props {
  photo: SidePhoto | null
  canReview?: boolean
  onClose: () => void
  onReviewed?: () => void
}

export function PhotoSideWindow({ photo, canReview = false, onClose, onReviewed }: Props) {
  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refusMode, setRefusMode] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const isOpen = !!photo
  const status = photo?.validation_status ?? 'pending'
  const statusMeta = STATUS_META[status] ?? STATUS_META.pending
  // Saisie non sauvegardée = motif de refus en cours de saisie.
  const dirty = refusMode && comment.trim().length > 0

  // Réinitialise l'état de review à chaque ouverture/changement de photo.
  useEffect(() => {
    setRefusMode(false); setComment(''); setError(null); setSubmitting(false)
  }, [photo?.id])

  const requestClose = () => { if (!submitting && !dirty) onClose() }

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, submitting, dirty])

  if (!mounted) return null

  const title = stripDemo(photo?.caption) || 'Photo chantier'
  const canAct = canReview && status === 'pending'

  async function submitReview(newStatus: 'approved' | 'rejected') {
    if (!photo || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: rpcErr } = await (createClient() as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }).rpc('review_photo', {
      p_photo_id: photo.id,
      p_status: newStatus,
      p_comment: comment.trim() || null,
    })
    setSubmitting(false)
    if (rpcErr) { setError(humanError(rpcErr.message)); return }
    onReviewed?.()
  }

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-0 z-[9980] bg-black/30 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={requestClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Détail de la photo"
        className={cn(
          'fixed top-0 right-0 bottom-0 z-[9981] w-full max-w-md bg-surface border-l border-border shadow-2xl flex flex-col transition-transform duration-200 motion-reduce:transition-none',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-border">
          <h2 className="text-sm font-700 text-foreground truncate">{title}</h2>
          <button
            onClick={requestClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {photo && (
          <div className="flex-1 overflow-y-auto">
            <div className="relative bg-elevated">
              {photo.url ? (
                <>
                  <img src={photo.url} alt={title} className="w-full max-h-[42vh] object-contain bg-black/5" />
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
                <div className="w-full h-40 flex items-center justify-center text-xs text-muted-foreground">Aperçu indisponible.</div>
              )}
            </div>

            <div className="p-5 flex flex-col gap-4">
              <span className={cn('inline-flex w-fit items-center px-2.5 py-1 rounded-full text-[11px] font-700', statusMeta.cls)}>
                {statusMeta.label}
              </span>

              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <dt className="sr-only">Chantier</dt>
                  <dd className="text-foreground font-500 truncate">{photo.project?.name ?? 'Chantier inconnu'}</dd>
                </div>
                <div className="flex items-center gap-3">
                  <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
                  <dt className="sr-only">Tâche</dt>
                  <dd className={cn('truncate', photo.task ? 'text-foreground' : 'text-muted-foreground italic')}>
                    {photo.task?.title ?? 'Photo générale du chantier'}
                  </dd>
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

              {/* Historique de review si déjà traité */}
              {status !== 'pending' && (photo.reviewer || photo.reviewed_at || photo.review_comment) && (
                <div className="rounded-xl border border-border/50 bg-elevated/40 p-3 text-[12px] text-muted-foreground flex flex-col gap-1">
                  <span>
                    {status === 'approved' ? 'Validée' : 'Refusée'}
                    {photo.reviewer ? ` par ${photo.reviewer}` : ''}
                    {photo.reviewed_at ? ` · ${formatDate(photo.reviewed_at)}` : ''}
                  </span>
                  {photo.review_comment && <span className="text-foreground/80 italic">« {photo.review_comment} »</span>}
                </div>
              )}

              {error && (
                <p className="text-[12px] text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Actions de validation — rôles autorisés uniquement, statut pending */}
              {canAct && !refusMode && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => submitReview('approved')}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-600 hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    <Check className="h-4 w-4" /> {submitting ? '…' : 'Valider'}
                  </button>
                  <button
                    onClick={() => { setRefusMode(true); setError(null) }}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 text-sm font-600 hover:bg-red-500/10 disabled:opacity-60 transition-colors"
                  >
                    <Ban className="h-4 w-4" /> Refuser
                  </button>
                </div>
              )}

              {canAct && refusMode && (
                <div className="flex flex-col gap-2 pt-1">
                  <label className="text-[11px] font-600 uppercase tracking-wider text-muted-foreground">Motif du refus (optionnel)</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    placeholder="Ex. photo floue, mauvais angle…"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => submitReview('rejected')}
                      disabled={submitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      <Ban className="h-4 w-4" /> {submitting ? '…' : 'Confirmer le refus'}
                    </button>
                    <button
                      onClick={() => { setRefusMode(false); setComment('') }}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-600 hover:bg-elevated disabled:opacity-60 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {status !== 'pending' && (
                <div className="flex items-center gap-2 text-[12px] text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Photo déjà traitée.
                </div>
              )}

              <Link
                href={`/chantiers/${photo.project_id}`}
                className="mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
              >
                Ouvrir le chantier
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}
