'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  FileText, Camera, Plus, Search, AlertTriangle,
  CheckCircle2, FileSpreadsheet, Archive, Image as ImageIcon,
  ExternalLink, Clock, FolderOpen, X, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { PhotoThumb } from '@/components/ui/PhotoThumb'
import { UploadDocumentModal } from './UploadDocumentModal'
import { UploadPhotoModal } from './UploadPhotoModal'
import { cn, formatDateShort, formatRelative } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocumentRow {
  id: string
  project_id?: string | null
  name?: string | null
  file_url?: string | null
  file_type?: string | null
  file_size?: number | null
  category?: string | null
  created_at?: string | null
  project?: { name?: string | null; color?: string | null } | null
  uploader?: { full_name?: string | null } | null
}

interface PhotoRow {
  id: string
  project_id?: string | null
  url?: string | null
  thumbnail_url?: string | null
  caption?: string | null
  theme?: string | null
  taken_at?: string | null
  issue_id?: string | null
  project?: { name?: string | null; color?: string | null } | null
}

interface Props {
  orgId: string
  documents: DocumentRow[]
  photos: PhotoRow[]
  projects: { id: string; name: string; color: string | null }[]
  issues: { id: string; status: string }[]
  today: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

// ── Constants ─────────────────────────────────────────────────────────────────

type ActiveFilter = 'all' | 'photos' | 'documents' | 'to_validate' | 'reserves'

const FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: 'all',         label: 'Tous' },
  { value: 'photos',      label: 'Photos' },
  { value: 'documents',   label: 'Documents' },
  { value: 'to_validate', label: 'À valider' },
  { value: 'reserves',    label: 'Réserves' },
]

const OPEN_STATUSES  = new Set(['open', 'assigned', 'in_progress'])
const FIXED_STATUSES = new Set(['fixed'])
const DONE_STATUSES  = new Set(['validated', 'rejected'])

// ── Helpers ────────────────────────────────────────────────────────────────────

type PhotoStatus = 'reserve' | 'a_valider' | 'valide' | 'normal'

function getPhotoStatus(photo: PhotoRow, issueById: Map<string, string>): PhotoStatus {
  if (!photo.issue_id) return 'normal'
  const s = issueById.get(photo.issue_id)
  if (!s) return 'normal'
  if (OPEN_STATUSES.has(s))  return 'reserve'
  if (FIXED_STATUSES.has(s)) return 'a_valider'
  if (DONE_STATUSES.has(s))  return 'valide'
  return 'normal'
}

const STATUS_BADGE: Record<PhotoStatus, { label: string; cls: string } | null> = {
  reserve:   { label: 'Réserve',   cls: 'bg-red-600/85 text-white' },
  a_valider: { label: 'À valider', cls: 'bg-amber-500/85 text-white' },
  valide:    { label: 'Validé',    cls: 'bg-green-600/85 text-white' },
  normal:    null,
}

function getDocConfig(doc: DocumentRow) {
  const mime = doc.file_type ?? ''
  const name = (doc.name ?? '').toLowerCase()
  if (mime === 'application/pdf' || name.endsWith('.pdf'))
    return { icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10' }
  if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xls|xlsx)$/.test(name))
    return { icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-500/10' }
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/.test(name))
    return { icon: ImageIcon, color: 'text-purple-500', bg: 'bg-purple-500/10' }
  if (mime.includes('zip') || name.endsWith('.zip'))
    return { icon: Archive, color: 'text-muted-foreground', bg: 'bg-elevated' }
  if (doc.category === 'Plan')
    return { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' }
  return { icon: FileText, color: 'text-primary', bg: 'bg-primary/10' }
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1048576).toFixed(1)} Mo`
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  value, label, icon: Icon, sub, accent = false,
}: {
  value: React.ReactNode; label: string; icon: React.ElementType; sub?: string | null; accent?: boolean
}) {
  return (
    <div className="bg-surface rounded-xl border border-border/40 dark:border-white/[0.08] px-4 py-4 flex items-center gap-3 min-h-[80px] shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        accent ? 'bg-orange-500/12 text-orange-500' : 'bg-primary/10 text-primary',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[20px] font-800 text-foreground leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{label}</p>
        {sub && (
          <p className={cn('text-[10px] mt-0.5 truncate', accent ? 'text-orange-500/80' : 'text-muted-foreground/55')}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Photo card (handles own img error) ───────────────────────────────────────

function PhotoCard({
  photo, status, onClick,
}: {
  photo: PhotoRow
  status: PhotoStatus
  onClick: () => void
}) {
  const badge = STATUS_BADGE[status]

  return (
    <div
      onClick={onClick}
      className="aspect-square rounded-xl overflow-hidden bg-elevated border border-border/30 dark:border-white/[0.08] relative group cursor-pointer"
    >
      <PhotoThumb
        src={photo.url}
        caption={photo.caption}
        alt={photo.caption ?? 'Photo chantier'}
        imgClassName="group-hover:scale-105 transition-transform duration-300"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl" />

      {/* Status badge */}
      {badge && (
        <div className="absolute top-1.5 left-1.5">
          <span className={cn('flex items-center gap-1 text-[9px] font-700 px-1.5 py-0.5 rounded-md', badge.cls)}>
            {badge.label === 'À valider' && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
            {badge.label}
          </span>
        </div>
      )}

      {/* Project + caption on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {photo.project?.name && (
          <p className="text-white text-[9px] font-600 truncate flex items-center gap-1">
            {photo.project.color && (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: photo.project.color }} />
            )}
            {stripDemo(photo.project.name)}
          </p>
        )}
        {photo.caption && (
          <p className="text-white/80 text-[9px] line-clamp-2">{stripDemo(photo.caption)}</p>
        )}
      </div>
    </div>
  )
}

// ── Photo preview side panel ──────────────────────────────────────────────────

function PhotoPreviewPanel({
  photo, status, onClose,
}: {
  photo: PhotoRow
  status: PhotoStatus
  onClose: () => void
}) {
  const badge = STATUS_BADGE[status]

  return (
    <SlidePanel onClose={onClose} title="Photo terrain" subtitle={stripDemo(photo.project?.name) ?? undefined} width="w-[520px]">
      <div className="flex flex-col gap-5">
        {/* Image */}
        <div className="w-full rounded-xl overflow-hidden border border-border/30" style={{ aspectRatio: '4/3' }}>
          <PhotoThumb
            src={photo.url}
            caption={photo.caption}
            alt={photo.caption ?? 'Photo chantier'}
            size="lg"
          />
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-3">
          {photo.caption && (
            <p className="text-[13px] font-600 text-foreground">{stripDemo(photo.caption)}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {badge && (
              <span className={cn('text-[10px] font-700 px-2 py-0.5 rounded-full', badge.cls)}>
                {badge.label}
              </span>
            )}
            {photo.theme && (
              <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-elevated border border-border/40 text-muted-foreground">
                {photo.theme}
              </span>
            )}
          </div>

          {photo.taken_at && (
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {formatRelative(photo.taken_at)}
              <span className="text-muted-foreground/40">·</span>
              {formatDateShort(photo.taken_at)}
            </p>
          )}
        </div>

        {/* CTA */}
        {photo.project_id && (
          <div className="border-t border-border/30 pt-4">
            <Link
              href={`/chantiers/${photo.project_id}`}
              onClick={onClose}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/40 bg-elevated/50 hover:bg-elevated hover:border-border/70 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {photo.project?.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: photo.project.color }} />
                )}
                <span className="text-sm font-600 text-foreground truncate">
                  {photo.project?.name ?? 'Voir le chantier'}
                </span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </Link>
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DocumentsClient({ orgId, documents, photos, projects, issues, today }: Props) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [filterProjectId, setFilterProjectId] = useState<string | null>(null)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRow | null>(null)
  const [showUploadDoc, setShowUploadDoc] = useState(false)
  const [showUploadPhoto, setShowUploadPhoto] = useState(false)

  useEffect(() => {
    if (!projectDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [projectDropdownOpen])

  // ── Computed maps ──────────────────────────────────────────────────────────

  const issueById = useMemo(() =>
    new Map(issues.map(i => [i.id, i.status])),
    [issues]
  )

  // Build project map from all sources
  const allProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string | null }>()
    for (const p of projects) map.set(p.id, p)
    for (const d of documents) {
      if (d.project_id && d.project?.name && !map.has(d.project_id)) {
        map.set(d.project_id, { id: d.project_id, name: d.project.name, color: d.project.color ?? null })
      }
    }
    for (const ph of photos) {
      if (ph.project_id && ph.project?.name && !map.has(ph.project_id)) {
        map.set(ph.project_id, { id: ph.project_id, name: ph.project.name, color: ph.project.color ?? null })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, documents, photos])

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const recentPhotos   = photos.filter(p => p.taken_at && p.taken_at >= sevenDaysAgo).length
    const pendingIssues  = issues.filter(i => !DONE_STATUSES.has(i.status)).length
    const reservePhotos  = photos.filter(p => OPEN_STATUSES.has(issueById.get(p.issue_id ?? '') ?? '')).length
    return { recentPhotos, pendingIssues, docsCount: documents.length, reservePhotos }
  }, [photos, issues, documents, issueById])

  // ── "À valider" alert items ───────────────────────────────────────────────

  const alertPhotos = useMemo(() =>
    photos.filter(p => {
      const s = getPhotoStatus(p, issueById)
      return s === 'reserve' || s === 'a_valider'
    }).slice(0, 6),
    [photos, issueById]
  )

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredPhotos = useMemo(() => {
    let list = photos
    if (filterProjectId) list = list.filter(p => p.project_id === filterProjectId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        (p.caption ?? '').toLowerCase().includes(q) ||
        (p.theme ?? '').toLowerCase().includes(q) ||
        (p.project?.name ?? '').toLowerCase().includes(q)
      )
    }
    if (activeFilter === 'to_validate') list = list.filter(p => getPhotoStatus(p, issueById) === 'a_valider')
    if (activeFilter === 'reserves')    list = list.filter(p => getPhotoStatus(p, issueById) === 'reserve')
    return list
  }, [photos, filterProjectId, search, activeFilter, issueById])

  const filteredDocs = useMemo(() => {
    let list = documents
    if (filterProjectId) list = list.filter(d => d.project_id === filterProjectId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(d =>
        (d.name ?? '').toLowerCase().includes(q) ||
        (d.category ?? '').toLowerCase().includes(q) ||
        (d.project?.name ?? '').toLowerCase().includes(q) ||
        (d.uploader?.full_name ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [documents, filterProjectId, search])

  const showPhotos = activeFilter !== 'documents'
  const showDocs   = activeFilter !== 'photos' && activeFilter !== 'to_validate' && activeFilter !== 'reserves'
  const showAlerts = activeFilter === 'all' && !search.trim()

  // Filter counts
  const counts: Record<ActiveFilter, number> = useMemo(() => ({
    all:         photos.length + documents.length,
    photos:      photos.length,
    documents:   documents.length,
    to_validate: photos.filter(p => getPhotoStatus(p, issueById) === 'a_valider').length,
    reserves:    photos.filter(p => getPhotoStatus(p, issueById) === 'reserve').length,
  }), [photos, documents, issueById])

  // Categories (for grouped doc view)
  const categories = useMemo(() =>
    [...new Set(filteredDocs.map(d => d.category ?? 'Autre'))],
    [filteredDocs]
  )

  const selectedPhotoStatus = selectedPhoto ? getPhotoStatus(selectedPhoto, issueById) : 'normal'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="px-6 lg:px-10 py-6 flex flex-col gap-6">

        {/* ── Upload actions ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => setShowUploadPhoto(true)} size="sm">
            <Camera className="h-4 w-4" />
            Ajouter une photo
          </Button>
          <Button onClick={() => setShowUploadDoc(true)} size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Ajouter un document
          </Button>
        </div>

        {/* ── KPI bar ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            icon={Camera}
            value={kpis.recentPhotos}
            label="Photos récentes"
            sub="7 derniers jours"
          />
          <KpiTile
            icon={AlertTriangle}
            value={kpis.pendingIssues}
            label="Validations en attente"
            accent={kpis.pendingIssues > 0}
            sub={kpis.pendingIssues > 0 ? 'Réserves à traiter' : 'Tout est traité'}
          />
          <KpiTile
            icon={FileText}
            value={kpis.docsCount}
            label="Documents actifs"
            sub={kpis.docsCount > 0 ? `${categories.length} catégorie${categories.length > 1 ? 's' : ''}` : null}
          />
          <KpiTile
            icon={AlertTriangle}
            value={kpis.reservePhotos}
            label="Réserves liées"
            accent={kpis.reservePhotos > 0}
            sub={kpis.reservePhotos > 0 ? 'Photos avec réserve ouverte' : 'Aucune réserve photo'}
          />
        </div>

        {/* ── À valider section ── */}
        {showAlerts && (
          alertPhotos.length > 0 ? (
            <section className="bg-surface rounded-2xl border border-border/40 dark:border-white/[0.08] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
              <div className="px-5 py-3 border-b border-border/25 flex items-center gap-2.5 bg-surface">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground flex-1">
                  Photos à traiter
                </h2>
                <span className="min-w-[20px] h-5 rounded-full bg-orange-500/12 text-orange-600 dark:text-orange-400 text-[10px] font-700 flex items-center justify-center px-1.5 leading-none border border-orange-500/20">
                  {alertPhotos.length}
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {alertPhotos.map(photo => {
                  const s = getPhotoStatus(photo, issueById)
                  const badge = STATUS_BADGE[s]
                  return (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className="aspect-square rounded-xl overflow-hidden bg-elevated border border-border/30 relative group"
                    >
                      <PhotoThumb
                        src={photo.url}
                        caption={photo.caption}
                        alt={photo.caption ?? 'photo'}
                        imgClassName="group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {badge && (
                        <div className="absolute bottom-1.5 inset-x-1.5">
                          <span className={cn('text-[9px] font-700 px-1.5 py-0.5 rounded-md flex items-center gap-1', badge.cls)}>
                            {badge.label === 'À valider' && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                            {badge.label}
                          </span>
                        </div>
                      )}
                      {photo.project?.name && (
                        <div className="absolute top-1.5 left-1.5 right-1.5">
                          <p className="text-white/90 text-[8.5px] font-600 truncate">{stripDemo(photo.project.name)}</p>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ) : (photos.length > 0 || documents.length > 0) ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/[0.06] border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <p className="text-[13px] font-600 text-green-700 dark:text-green-400">
                Tout est traité — aucune photo en attente de validation.
              </p>
            </div>
          ) : null
        )}

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-600 transition-colors whitespace-nowrap border',
                  activeFilter === f.value
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : (f.value === 'to_validate' || f.value === 'reserves') && counts[f.value] > 0
                      ? 'bg-orange-500/8 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/12'
                      : 'bg-transparent text-muted-foreground border-border/40 hover:text-foreground hover:bg-elevated/50',
                )}
              >
                {f.label}
                {counts[f.value] > 0 && (
                  <span className={cn(
                    'text-[10px] font-700 min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 leading-none',
                    activeFilter === f.value ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}>
                    {counts[f.value]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Project dropdown */}
          {allProjects.length > 1 && (
            <div className="relative" ref={projectDropdownRef}>
              <button
                onClick={() => setProjectDropdownOpen(o => !o)}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-600 border transition-colors whitespace-nowrap',
                  filterProjectId
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-transparent text-muted-foreground border-border/40 hover:text-foreground hover:bg-elevated/50',
                )}
              >
                {filterProjectId
                  ? (allProjects.find(p => p.id === filterProjectId)?.name ?? 'Chantier')
                  : 'Tous les chantiers'}
                <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', projectDropdownOpen && 'rotate-180')} />
              </button>
              {projectDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 min-w-[170px] max-w-[240px] bg-elevated border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
                  <button
                    onClick={() => { setFilterProjectId(null); setProjectDropdownOpen(false) }}
                    className={cn(
                      'w-full flex items-center px-3 py-2 text-[12px] text-left transition-colors',
                      !filterProjectId ? 'text-primary font-700 bg-primary/6' : 'text-foreground hover:bg-border/40',
                    )}
                  >
                    Tous les chantiers
                  </button>
                  {allProjects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setFilterProjectId(p.id); setProjectDropdownOpen(false) }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors',
                        filterProjectId === p.id ? 'text-primary font-700 bg-primary/6' : 'text-foreground hover:bg-border/40',
                      )}
                    >
                      {p.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/45 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl border border-border/40 bg-surface text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Effacer"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] leading-none text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* ── Photos section ── */}
        {showPhotos && (
          <section>
            <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground mb-3">
              Photos ({filteredPhotos.length})
            </h2>
            {filteredPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredPhotos.map(photo => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    status={getPhotoStatus(photo, issueById)}
                    onClick={() => setSelectedPhoto(photo)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 border border-dashed border-border/50 rounded-xl">
                <Camera className="h-7 w-7 text-muted-foreground/25" />
                <div className="text-center">
                  <p className="text-[13px] font-600 text-foreground mb-0.5">Aucune photo</p>
                  <p className="text-xs text-muted-foreground">
                    {search.trim() || filterProjectId
                      ? 'Aucune photo ne correspond à ce filtre.'
                      : 'Ajoutez des photos depuis le terrain.'}
                  </p>
                </div>
                {!search.trim() && !filterProjectId && (
                  <button
                    onClick={() => setShowUploadPhoto(true)}
                    className="text-sm font-600 text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Ajouter une photo →
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Documents section ── */}
        {showDocs && (
          <section>
            <h2 className="text-[11px] font-800 uppercase tracking-widest text-muted-foreground mb-3">
              Documents ({filteredDocs.length})
            </h2>
            {filteredDocs.length > 0 ? (
              // Group by category when no active search/project filter
              (!search.trim() && !filterProjectId && activeFilter === 'all') ? (
                <div className="flex flex-col gap-5">
                  {categories.map(cat => {
                    const catDocs = filteredDocs.filter(d => (d.category ?? 'Autre') === cat)
                    return (
                      <div key={cat}>
                        <h3 className="text-xs font-600 text-muted-foreground mb-2 flex items-center gap-1.5">
                          <FolderOpen className="h-3.5 w-3.5" />
                          {cat}
                          <span className="text-muted-foreground/50">({catDocs.length})</span>
                        </h3>
                        <div className="flex flex-col gap-1.5">
                          {catDocs.map(doc => <DocRow key={doc.id} doc={doc} />)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredDocs.map(doc => <DocRow key={doc.id} doc={doc} />)}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 border border-dashed border-border/50 rounded-xl">
                <FileText className="h-7 w-7 text-muted-foreground/25" />
                <div className="text-center">
                  <p className="text-[13px] font-600 text-foreground mb-0.5">Aucun document</p>
                  <p className="text-xs text-muted-foreground">
                    {search.trim() || filterProjectId
                      ? 'Aucun document ne correspond à ce filtre.'
                      : 'Ajoutez plans, contrats et factures.'}
                  </p>
                </div>
                {!search.trim() && !filterProjectId && (
                  <button
                    onClick={() => setShowUploadDoc(true)}
                    className="text-sm font-600 text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    Ajouter un document →
                  </button>
                )}
              </div>
            )}
          </section>
        )}

      </div>

      {/* ── Modals & panels ── */}

      {selectedPhoto && (
        <PhotoPreviewPanel
          photo={selectedPhoto}
          status={selectedPhotoStatus}
          onClose={() => setSelectedPhoto(null)}
        />
      )}

      {showUploadPhoto && (
        <UploadPhotoModal
          orgId={orgId}
          projects={projects}
          defaultProjectId={filterProjectId ?? undefined}
          onClose={() => setShowUploadPhoto(false)}
        />
      )}

      {showUploadDoc && (
        <UploadDocumentModal
          orgId={orgId}
          projects={projects}
          defaultProjectId={filterProjectId ?? undefined}
          onClose={() => setShowUploadDoc(false)}
        />
      )}
    </>
  )
}

// ── DocRow (extracted to avoid repetition) ────────────────────────────────────

function DocRow({ doc }: { doc: DocumentRow }) {
  const { icon: Icon, color, bg } = getDocConfig(doc)
  const sizeLabel = formatBytes(doc.file_size)

  const inner = (
    <>
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', bg)}>
        <Icon className={cn('h-4.5 w-4.5', color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-600 text-foreground truncate">{doc.name}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {doc.project?.name && (
            <span className="flex items-center gap-1 text-[11px] font-500" style={{ color: doc.project.color ?? undefined }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: doc.project.color ?? '#6b7280' }} />
              {doc.project.name}
            </span>
          )}
          {doc.category && doc.category !== 'Autre' && (
            <span className="text-[10px] text-muted-foreground bg-elevated border border-border/40 px-1.5 py-0.5 rounded-full">
              {doc.category}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/55">
            {formatDateShort(doc.created_at ?? '')}
            {doc.uploader?.full_name && ` · ${doc.uploader.full_name}`}
            {sizeLabel && ` · ${sizeLabel}`}
          </span>
        </div>
      </div>
      {doc.file_url ? (
        <span className="text-[11px] text-primary font-600 flex items-center gap-1 shrink-0">
          Ouvrir <ExternalLink className="h-3 w-3" />
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground bg-elevated border border-border/30 px-2 py-0.5 rounded-full shrink-0">
          Indisponible
        </span>
      )}
    </>
  )

  return doc.file_url ? (
    <a
      href={doc.file_url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-3 bg-surface border border-border/40 dark:border-white/[0.08] rounded-xl hover:bg-elevated hover:border-border/60 dark:hover:border-white/[0.14] transition-colors"
    >
      {inner}
    </a>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border/40 dark:border-white/[0.08] rounded-xl opacity-60">
      {inner}
    </div>
  )
}
