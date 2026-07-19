'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone, Mail, Pencil, Users, Building2, ListChecks, Plus, X, CalendarRange,
  Pause, Play, Archive, ShieldAlert, UserCheck, MailCheck, UserX, Lock,
  KeyRound, Gauge, Activity, Send, ShieldCheck, Clock,
} from 'lucide-react'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { ConfirmDialog, type ConfirmState } from '@/components/ui/ConfirmDialog'
import { InviteResourceModal } from './InviteResourceModal'
import { ROLE_LABEL, ROLE_DESCRIPTION, asRole } from '@/lib/permissions'
import { cn, getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { mutationClient } from '@/lib/supabase/mutate'
import { useToast } from '@/components/ui/toast-context'

// ── Shared types (imported by EquipesClient) ──────────────────────────────────

export type TaskWithProject = {
  id: string
  project_id: string
  title: string
  status: string
  start_date: string | null
  end_date: string | null
  assigned_to: string | null
  assigned_team: string | null
}

export type AccountStatus = 'active' | 'suspended' | 'archived'

export type EnrichedArtisan = {
  id: string
  org_id: string
  full_name: string | null
  trade: string | null
  color: string | null
  phone: string | null
  email: string | null
  status: 'free' | 'assigned' | 'conflict'
  accountStatus?: AccountStatus
  hasAccount?: boolean
  accountRole?: string | null
  accountEmail?: string | null
  hasPendingInvite?: boolean
  weekTasks: (TaskWithProject & { projectInfo: { id: string; name: string; color: string } | null })[]
  currentProjects: { id: string; name: string; color: string }[]
  artisanTeams: { id: string; name: string; color: string | null }[]
}

// ── Config ────────────────────────────────────────────────────────────────────

// Charge / disponibilité PLANNING (fenêtre 7 jours) — distincte du périmètre.
const STATUS_CONFIG = {
  free:     { label: 'Libre cette semaine',    cls: 'bg-muted/40 text-muted-foreground/70 border-border/30' },
  assigned: { label: 'Planifié cette semaine', cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  conflict: { label: 'Surcharge possible',     cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
}

const ACCOUNT_CONFIG: Record<AccountStatus, { label: string; cls: string }> = {
  active:    { label: 'Actif',    cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  suspended: { label: 'Suspendu', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  archived:  { label: 'Archivé',  cls: 'bg-muted/50 text-muted-foreground border-border/40' },
}

// Statut de tâche → libellé court (best-effort, tolère les valeurs inconnues).
const TASK_STATUS_LABEL: Record<string, string> = {
  todo: 'À faire', in_progress: 'En cours', blocked: 'Bloquée',
  review: 'En revue', done: 'Terminée', validated: 'Validée',
}

type ProjectRef = { id: string; name: string; color: string | null }
type ProjAssign = { id: string; project_id: string }
type TaskAssign = { id: string; task_id: string; project_id: string }

interface Props {
  artisan: EnrichedArtisan
  onClose: () => void
  onEdit: () => void
  orgId?: string
  canManage?: boolean
  /** Peut inviter / relancer / révoquer (owner/admin — aligné RLS + API). */
  canInvite?: boolean
  currentUserId?: string
  projects?: ProjectRef[]
  tasks?: TaskWithProject[]
  onChanged?: () => void
  onCountsChanged?: (artisanId: string, projects: number, tasks: number) => void
  pendingScope?: { id?: string; email?: string | null; role?: string | null; projectId: string | null; taskIds: string[] }
}

export function ArtisanSidePanel({ artisan, onClose, onEdit, orgId, canManage = false, canInvite = false, currentUserId, projects = [], tasks = [], onChanged, onCountsChanged, pendingScope }: Props) {
  const router = useRouter()
  const { toast: showToast } = useToast()
  const [, startTransition] = useTransition()
  const initials = getInitials(artisan.full_name)
  const workload = STATUS_CONFIG[artisan.status]

  // Statut optimiste : reflète immédiatement suspend/réactiver sans fermer le panneau.
  const [localStatus, setLocalStatus] = useState<AccountStatus>(artisan.accountStatus ?? 'active')
  useEffect(() => { setLocalStatus(artisan.accountStatus ?? 'active') }, [artisan.id, artisan.accountStatus])
  const account = ACCOUNT_CONFIG[localStatus]

  const [projAssigns, setProjAssigns] = useState<ProjAssign[]>([])
  const [taskAssigns, setTaskAssigns] = useState<TaskAssign[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [addProjectId, setAddProjectId] = useState('')
  const [addTaskProjectId, setAddTaskProjectId] = useState('')
  const [addTaskId, setAddTaskId] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  // ── Invitation (compte Kanvix) ──
  const [showInvite, setShowInvite] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)

  // Rafraîchit les données serveur parent sans bloquer l'UI (INP).
  const softRefresh = () => { if (onChanged) startTransition(() => onChanged()) }

  // Rattachements réels (RLS-scoped) rechargés à l'ouverture / après mutation.
  // silent=true : refetch de réconciliation (n'affiche pas l'état « Chargement… »,
  // garde les mises à jour optimistes visibles).
  const loadAssignments = (silent = false) => {
    if (!silent) setLoading(true)
    const supabase = createClient()
    Promise.all([
      supabase.from('artisan_project_assignments').select('id, project_id').eq('artisan_id', artisan.id).eq('is_active', true),
      supabase.from('artisan_task_assignments').select('id, task_id, project_id').eq('artisan_id', artisan.id).eq('is_active', true),
    ]).then(([p, t]) => {
      const proj = (p.data ?? []) as ProjAssign[]
      const task = (t.data ?? []) as TaskAssign[]
      setProjAssigns(proj)
      setTaskAssigns(task)
      setLoading(false)
      // Réconcilie la source de vérité parent (badges carte) avec la base.
      onCountsChanged?.(artisan.id, proj.length, task.length)
    })
  }
  useEffect(() => { loadAssignments() }, [artisan.id])

  const projName = (id: string) => projects.find(p => p.id === id)?.name ?? 'Chantier'
  const projColor = (id: string) => projects.find(p => p.id === id)?.color ?? '#6366f1'
  const taskOf = (id: string) => tasks.find(t => t.id === id)
  const taskTitle = (id: string) => taskOf(id)?.title ?? 'Tâche'
  const taskStatusLabel = (id: string) => {
    const s = taskOf(id)?.status
    return s ? (TASK_STATUS_LABEL[s] ?? s) : null
  }

  // Refetch local léger (rattachements) + refresh parent non bloquant.
  const refresh = () => { loadAssignments(true); softRefresh() }

  // ── Statut lifecycle (confirmation non bloquante) ──
  function askStatus(next: AccountStatus) {
    if (busy || !orgId) return
    const cfg: Record<AccountStatus, { title: string; description: string; confirmLabel: string; tone: 'danger' | 'warning' | 'default' }> = {
      suspended: {
        title: 'Confirmer la suspension',
        description: "L'artisan ne pourra plus accéder à Kanvix tant qu'il est suspendu. Son historique (photos, messages, tâches) est conservé.",
        confirmLabel: 'Suspendre', tone: 'warning',
      },
      archived: {
        title: "Confirmer l'archivage",
        description: "L'artisan sera retiré des listes actives et ne pourra plus accéder à Kanvix. Aucune donnée n'est supprimée.",
        confirmLabel: 'Archiver', tone: 'default',
      },
      active: {
        title: 'Réactiver cet artisan',
        description: "L'artisan retrouvera l'accès à Kanvix. Son historique est inchangé.",
        confirmLabel: 'Réactiver', tone: 'default',
      },
    }
    const c = cfg[next]
    setConfirm({ ...c, onConfirm: () => doSetStatus(next) })
  }
  async function doSetStatus(next: AccountStatus) {
    if (!orgId) return
    setBusy(true)
    const patch: Record<string, unknown> =
      next === 'archived' ? { status: 'archived', is_archived: true }
      : next === 'active' ? { status: 'active', is_archived: false }
      : { status: 'suspended' } // suspension ne touche pas is_archived
    const { error } = await mutationClient().from('artisans').update(patch).eq('id', artisan.id).eq('org_id', orgId)
    setBusy(false)
    setConfirm(null)
    if (error) { showToast(error.message, 'error'); return }
    setLocalStatus(next)
    showToast(next === 'active' ? 'Artisan réactivé' : next === 'suspended' ? 'Artisan suspendu' : 'Artisan archivé')
    softRefresh()
    // Panneau conservé pour suspend/réactiver (feedback visible) ; l'archivage
    // retire l'artisan de la liste active → on ferme.
    if (next === 'archived') onClose()
  }

  // ── Rattachement chantier (idempotent : upsert onConflict → pas de 409) ──
  async function addProject() {
    if (!addProjectId || !orgId || busy) return
    const pid = addProjectId
    setBusy(true)
    const { error } = await mutationClient().from('artisan_project_assignments')
      .upsert({ org_id: orgId, artisan_id: artisan.id, project_id: pid }, { onConflict: 'artisan_id,project_id', ignoreDuplicates: true })
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    // Optimiste : le badge « Sans chantier » disparaît immédiatement (fiche + carte).
    const next = projAssigns.some(p => p.project_id === pid) ? projAssigns : [...projAssigns, { id: `tmp-${pid}`, project_id: pid }]
    setProjAssigns(next)
    onCountsChanged?.(artisan.id, next.length, taskAssigns.length)
    setAddProjectId('')
    showToast('Chantier rattaché')
    refresh()
  }
  function askRemoveProject(a: ProjAssign) {
    if (busy) return
    const taskCount = taskAssigns.filter(t => t.project_id === a.project_id).length
    setConfirm({
      title: 'Retirer ce chantier',
      description: taskCount > 0
        ? `Les ${taskCount} tâche(s) rattachée(s) de ce chantier seront aussi retirées. Cela retire l'accès opérationnel, pas l'historique métier.`
        : "Cela retire l'accès opérationnel de l'artisan sur ce chantier, pas l'historique métier.",
      confirmLabel: 'Retirer', tone: 'danger',
      onConfirm: () => doRemoveProject(a),
    })
  }
  async function doRemoveProject(a: ProjAssign) {
    setBusy(true)
    // Retirer d'abord les tâches du chantier, puis le chantier (pas de tâche orpheline).
    await mutationClient().from('artisan_task_assignments').delete().eq('artisan_id', artisan.id).eq('project_id', a.project_id)
    const { error } = await mutationClient().from('artisan_project_assignments').delete().eq('id', a.id)
    setBusy(false)
    setConfirm(null)
    if (error) { showToast(error.message, 'error'); return }
    // Optimiste : retire le chantier et ses tâches (badges recalculés immédiatement).
    const nextProj = projAssigns.filter(p => p.id !== a.id)
    const nextTask = taskAssigns.filter(t => t.project_id !== a.project_id)
    setProjAssigns(nextProj)
    setTaskAssigns(nextTask)
    onCountsChanged?.(artisan.id, nextProj.length, nextTask.length)
    showToast('Chantier retiré')
    refresh()
  }

  // ── Rattachement tâche (idempotent) ──
  async function addTask() {
    if (!addTaskProjectId || !addTaskId || !orgId || busy) return
    const pid = addTaskProjectId, tid = addTaskId
    setBusy(true)
    // Garantir le rattachement chantier correspondant (upsert idempotent → pas de 409).
    await mutationClient().from('artisan_project_assignments')
      .upsert({ org_id: orgId, artisan_id: artisan.id, project_id: pid }, { onConflict: 'artisan_id,project_id', ignoreDuplicates: true })
    const { error } = await mutationClient().from('artisan_task_assignments')
      .upsert({ org_id: orgId, artisan_id: artisan.id, project_id: pid, task_id: tid }, { onConflict: 'artisan_id,task_id', ignoreDuplicates: true })
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    // Optimiste : « Sans tâche » (et « Sans chantier » si 1er rattachement) disparaissent.
    const nextProj = projAssigns.some(p => p.project_id === pid) ? projAssigns : [...projAssigns, { id: `tmp-${pid}`, project_id: pid }]
    const nextTask = taskAssigns.some(t => t.task_id === tid) ? taskAssigns : [...taskAssigns, { id: `tmp-${tid}`, task_id: tid, project_id: pid }]
    setProjAssigns(nextProj)
    setTaskAssigns(nextTask)
    onCountsChanged?.(artisan.id, nextProj.length, nextTask.length)
    setAddTaskId('')
    showToast('Tâche rattachée')
    refresh()
  }
  function askRemoveTask(a: TaskAssign) {
    if (busy) return
    setConfirm({
      title: 'Retirer cette tâche',
      description: "Cela retire l'accès opérationnel de l'artisan sur cette tâche, pas l'historique métier.",
      confirmLabel: 'Retirer', tone: 'danger',
      onConfirm: () => doRemoveTask(a),
    })
  }
  async function doRemoveTask(a: TaskAssign) {
    setBusy(true)
    const { error } = await mutationClient().from('artisan_task_assignments').delete().eq('id', a.id)
    setBusy(false)
    setConfirm(null)
    if (error) { showToast(error.message, 'error'); return }
    // Optimiste : « Sans tâche » revient si c'était la dernière.
    const nextTask = taskAssigns.filter(t => t.id !== a.id)
    setTaskAssigns(nextTask)
    onCountsChanged?.(artisan.id, projAssigns.length, nextTask.length)
    showToast('Tâche retirée')
    refresh()
  }

  const availableTasks = tasks.filter(t =>
    t.project_id === addTaskProjectId && !taskAssigns.some(a => a.task_id === t.id))
  const availableProjects = projects.filter(p => !projAssigns.some(a => a.project_id === p.id))
  const noProjects = !loading && projAssigns.length === 0
  const noTasks = !loading && taskAssigns.length === 0
  // État « À confirmer » : affecté via planning mais aucun rattachement explicite.
  // (défini ici ; unconfirmedDetected est calculé juste après)

  // Affectations détectées (planning) non encore rattachées explicitement :
  // tâches assigned_to l'artisan ou assigned_team d'une de ses équipes.
  const teamIds = new Set(artisan.artisanTeams.map(t => t.id))
  const detectedTasks = tasks.filter(t => t.assigned_to === artisan.id || (t.assigned_team ? teamIds.has(t.assigned_team) : false))
  const unconfirmedDetected = detectedTasks.filter(t => !taskAssigns.some(a => a.task_id === t.id))

  // Périmètre prévu à l'invitation (rattachements créés à l'acceptation).
  const hasPendingScope = !!artisan.hasPendingInvite && !!pendingScope?.projectId
  const pendingProjectName = pendingScope?.projectId ? projName(pendingScope.projectId) : null
  const pendingTaskTitles = (pendingScope?.taskIds ?? []).map(id => taskTitle(id))

  // Confirme les affectations détectées en rattachements explicites (idempotent).
  async function confirmDetected() {
    if (!orgId || busy || unconfirmedDetected.length === 0) return
    setBusy(true)
    for (const t of unconfirmedDetected) {
      await mutationClient().from('artisan_project_assignments')
        .upsert({ org_id: orgId, artisan_id: artisan.id, project_id: t.project_id }, { onConflict: 'artisan_id,project_id', ignoreDuplicates: true })
      await mutationClient().from('artisan_task_assignments')
        .upsert({ org_id: orgId, artisan_id: artisan.id, project_id: t.project_id, task_id: t.id }, { onConflict: 'artisan_id,task_id', ignoreDuplicates: true })
    }
    setBusy(false)
    showToast(`${unconfirmedDetected.length} rattachement${unconfirmedDetected.length > 1 ? 's' : ''} créé${unconfirmedDetected.length > 1 ? 's' : ''}`)
    refresh()
  }

  // ── Renvoyer l'email d'invitation (réutilise /api/invitations/send) ──
  async function resendInvite() {
    const invId = pendingScope?.id
    if (!invId || inviteBusy) return
    setInviteBusy(true)
    try {
      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: invId }),
      })
      const data = await res.json() as { ok?: boolean; message?: string }
      if (data.ok) showToast(`Email d'invitation renvoyé${artisan.accountEmail ? ` à ${artisan.accountEmail}` : ''}`)
      else showToast(data.message ?? "L'email n'a pas pu être renvoyé.", 'error')
    } catch {
      showToast('Impossible de joindre le serveur.', 'error')
    } finally {
      setInviteBusy(false)
    }
  }

  // ── Révoquer l'invitation en attente (status = revoked ; owner/admin via RLS) ──
  function askRevokeInvite() {
    const invId = pendingScope?.id
    if (!invId || inviteBusy) return
    setConfirm({
      title: "Révoquer l'invitation",
      description: "Le lien d'invitation deviendra invalide. Vous pourrez en émettre une nouvelle à tout moment.",
      confirmLabel: 'Révoquer', tone: 'danger',
      onConfirm: () => doRevokeInvite(invId),
    })
  }
  async function doRevokeInvite(invId: string) {
    setInviteBusy(true)
    const { error } = await mutationClient().from('invitations').update({ status: 'revoked' }).eq('id', invId)
    setInviteBusy(false)
    setConfirm(null)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Invitation révoquée')
    softRefresh()
  }

  // Compte lié / invitation
  const accountLine =
    artisan.hasAccount
      ? { icon: UserCheck, cls: 'text-green-600 dark:text-green-400', label: 'Compte Kanvix lié' }
      : artisan.hasPendingInvite
        ? { icon: MailCheck, cls: 'text-amber-600 dark:text-amber-400', label: 'Invitation en attente' }
        : { icon: UserX, cls: 'text-muted-foreground/70', label: 'Aucun compte lié' }
  const AccountIcon = accountLine.icon

  // ── Rôle & droits (lecture seule ; modification = LOT 42D) ──
  const roleKey = artisan.hasAccount && artisan.accountRole ? asRole(artisan.accountRole) : null
  const roleLabel = roleKey ? ROLE_LABEL[roleKey] : null
  const roleDesc = roleKey ? ROLE_DESCRIPTION[roleKey] : null

  // ── Périmètre autorisé (résumé) ──
  const scopeSummary =
    projAssigns.length > 0 || taskAssigns.length > 0
      ? `Périmètre : ${projAssigns.length} chantier${projAssigns.length > 1 ? 's' : ''} · ${taskAssigns.length} tâche${taskAssigns.length > 1 ? 's' : ''}`
      : hasPendingScope
        ? `Invitation en attente — chantier prévu${(pendingScope?.taskIds?.length ?? 0) > 0 ? ' + tâches' : ''}`
        : unconfirmedDetected.length > 0
          ? 'Affecté via le planning — à confirmer'
          : 'Aucun périmètre défini'

  // ── Taux d'occupation (semaine) ──
  const weekTaskCount = artisan.weekTasks.length
  const weekProjectCount = artisan.currentProjects.length

  return (
    <>
    <SlidePanel onClose={onClose} title={artisan.full_name ?? 'Artisan'} subtitle={artisan.trade ?? 'Métier non renseigné'}>
      <div className="flex flex-col gap-6">

        {/* Avatar + statuts */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-700 shrink-0" style={{ background: artisan.color ?? '#6366f1' }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-700 text-[16px] text-foreground leading-tight">{artisan.full_name ?? 'Artisan'}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{artisan.trade ?? 'Métier non renseigné'}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={cn('inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border', account.cls)}>{account.label}</span>
              {/* Badge de charge masqué en état « À confirmer » pour ne pas le contredire. */}
              {!(noProjects && noTasks && unconfirmedDetected.length > 0) && (
                <span className={cn('inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border', workload.cls)}>{workload.label}</span>
              )}
              {noProjects && unconfirmedDetected.length === 0 && !hasPendingScope && <span className="inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">Sans chantier</span>}
              {noTasks && unconfirmedDetected.length === 0 && !hasPendingScope && <span className="inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">Sans tâche</span>}
              {noProjects && noTasks && unconfirmedDetected.length > 0 && !hasPendingScope && <span className="inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">À confirmer</span>}
              {hasPendingScope && <span className="inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">Invitation en attente</span>}
            </div>
          </div>
        </div>

        {!canManage && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated/60 border border-border/40 text-[12px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Consultation seule — la gestion est réservée aux responsables.
          </div>
        )}

        {/* Coordonnées (toujours affichées, « Non renseigné » si vide) */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Identité</h3>
          <div className="flex flex-col gap-1.5">
            <ContactRow icon={Mail} value={artisan.email} href={artisan.email ? `mailto:${artisan.email}` : undefined} />
            <ContactRow icon={Phone} value={artisan.phone} href={artisan.phone ? `tel:${artisan.phone}` : undefined} />
          </div>
        </div>

        {/* Compte Kanvix */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Compte Kanvix</h3>
          <div className="flex items-center gap-2.5 text-sm">
            <div className="w-7 h-7 rounded-lg bg-elevated border border-border/40 flex items-center justify-center shrink-0"><AccountIcon className={cn('h-3.5 w-3.5', accountLine.cls)} /></div>
            <div className="min-w-0">
              <span className={cn('font-500 block', accountLine.cls)}>{accountLine.label}</span>
              {artisan.accountEmail && <span className="text-[11px] text-muted-foreground truncate block">{artisan.accountEmail}</span>}
            </div>
          </div>
          {/* Actions compte — inviter / relancer / révoquer (owner/admin ; aligné RLS). */}
          {canInvite && !artisan.hasAccount && (
            <div className="flex items-center gap-2 mt-0.5">
              {artisan.hasPendingInvite ? (
                <>
                  <button
                    onClick={resendInvite}
                    disabled={inviteBusy || !pendingScope?.id}
                    title={!pendingScope?.id ? 'Invitation introuvable' : "Renvoyer l'email d'invitation"}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border/50 text-[11.5px] font-600 text-foreground hover:bg-elevated disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-3 w-3" />Renvoyer
                  </button>
                  <button
                    onClick={askRevokeInvite}
                    disabled={inviteBusy || !pendingScope?.id}
                    title="Révoquer l'invitation"
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border/50 text-[11.5px] font-600 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    <X className="h-3 w-3" />Révoquer
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowInvite(true)}
                  disabled={inviteBusy}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-primary text-white text-[11.5px] font-600 hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-3 w-3" />Inviter sur Kanvix
                </button>
              )}
            </div>
          )}
        </div>

        {/* Rôle & droits (lecture seule ; modification = LOT 42D) */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <KeyRound className="h-3 w-3" /> Rôle &amp; droits
          </h3>
          {roleLabel ? (
            <div className="flex items-start gap-2.5 text-sm">
              <div className="w-7 h-7 rounded-lg bg-elevated border border-border/40 flex items-center justify-center shrink-0"><ShieldCheck className="h-3.5 w-3.5 text-primary" /></div>
              <div className="min-w-0">
                <span className="font-600 text-foreground block">{roleLabel}</span>
                <span className="text-[11.5px] text-muted-foreground">{roleDesc}</span>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground/60 italic">Aucun compte lié — aucun rôle applicatif.</p>
          )}
          {canManage && (
            <button disabled title="À venir — LOT 42D" className="self-start inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-border/50 text-[11.5px] font-600 text-muted-foreground/60 cursor-not-allowed">
              <Pencil className="h-3 w-3" />Modifier les droits · à venir · 42D
            </button>
          )}
        </div>

        {/* Périmètre autorisé (résumé) */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3" /> Périmètre autorisé
          </h3>
          <p className={cn('text-[12.5px] font-500', scopeSummary.startsWith('Aucun') ? 'text-muted-foreground/55 italic' : 'text-foreground/80')}>
            {scopeSummary}
          </p>
        </div>

        {/* Périmètre prévu à l'invitation (distinct des rattachements actifs) */}
        {hasPendingScope && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/20">
            <h3 className="text-[10px] font-800 uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <MailCheck className="h-3 w-3" /> Périmètre prévu à l&apos;invitation
            </h3>
            <div className="flex items-center gap-2 text-[12.5px] text-foreground/85">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-500">{pendingProjectName ?? 'Chantier prévu'}</span>
            </div>
            {pendingTaskTitles.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {pendingTaskTitles.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <ListChecks className="h-3 w-3 shrink-0" /><span className="truncate">{t}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10.5px] text-muted-foreground/70">Les rattachements seront créés à l&apos;acceptation de l&apos;invitation.</p>
          </div>
        )}

        {/* Chantiers rattachés */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Chantiers rattachés
          </h3>
          {loading ? (
            <p className="text-[12px] text-muted-foreground/50 italic">Chargement…</p>
          ) : projAssigns.length === 0 ? (
            <p className="text-[12px] text-amber-600 dark:text-amber-400 italic">Aucun chantier rattaché</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {projAssigns.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated/50 border border-border/30">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: projColor(a.project_id) }} />
                  <span className="flex-1 min-w-0 truncate text-[12.5px] font-500 text-foreground">{projName(a.project_id)}</span>
                  {canManage && (
                    <button onClick={() => askRemoveProject(a)} disabled={busy} title="Retirer" className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canManage && availableProjects.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <select value={addProjectId} onChange={e => setAddProjectId(e.target.value)} className="flex-1 h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Rattacher un chantier…</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={addProject} disabled={!addProjectId || busy} className="h-9 px-3 rounded-lg bg-primary text-white text-[12.5px] font-600 hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Ajouter</button>
            </div>
          )}
        </div>

        {/* Tâches rattachées */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <ListChecks className="h-3 w-3" /> Tâches rattachées
          </h3>
          {loading ? (
            <p className="text-[12px] text-muted-foreground/50 italic">Chargement…</p>
          ) : taskAssigns.length === 0 ? (
            <p className="text-[12px] text-amber-600 dark:text-amber-400 italic">Aucune tâche rattachée</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {taskAssigns.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated/50 border border-border/30">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-0.5 self-start" style={{ background: projColor(a.project_id) }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-500 text-foreground truncate">{taskTitle(a.task_id)}</span>
                    <span className="block text-[10.5px] text-muted-foreground truncate">
                      {projName(a.project_id)}{taskStatusLabel(a.task_id) ? ` · ${taskStatusLabel(a.task_id)}` : ''}
                    </span>
                  </span>
                  {canManage && (
                    <button onClick={() => askRemoveTask(a)} disabled={busy} title="Retirer" className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors self-start"><X className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canManage && (
            <div className="flex flex-col gap-1.5 mt-1">
              <select value={addTaskProjectId} onChange={e => { setAddTaskProjectId(e.target.value); setAddTaskId('') }} className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Chantier de la tâche…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {addTaskProjectId && (
                <div className="flex items-center gap-2">
                  <select value={addTaskId} onChange={e => setAddTaskId(e.target.value)} className="flex-1 h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">{availableTasks.length ? 'Tâche du chantier…' : 'Aucune tâche disponible'}</option>
                    {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <button onClick={addTask} disabled={!addTaskId || busy} className="h-9 px-3 rounded-lg bg-primary text-white text-[12.5px] font-600 hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Ajouter</button>
                </div>
              )}
              <p className="text-[10.5px] text-muted-foreground/60">Une tâche est toujours rattachée via son chantier.</p>
            </div>
          )}
        </div>

        {/* Affectations détectées (planning) non encore rattachées */}
        {!loading && unconfirmedDetected.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/20">
            <h3 className="text-[10px] font-800 uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" /> Affectations détectées
            </h3>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Cet artisan a des affectations issues du planning, mais aucun rattachement explicite chantier/tâche.
              Confirmez-les en rattachements pour les futures autorisations.
            </p>
            <div className="flex flex-col gap-1">
              {unconfirmedDetected.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center gap-2 text-[12px] text-foreground/80">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: projColor(t.project_id) }} />
                  <span className="truncate">{t.title}</span>
                  <span className="text-[10.5px] text-muted-foreground shrink-0">· {projName(t.project_id)}</span>
                </div>
              ))}
              {unconfirmedDetected.length > 5 && (
                <span className="text-[10.5px] text-muted-foreground/70">+{unconfirmedDetected.length - 5} autre(s)</span>
              )}
            </div>
            {canManage && (
              <button
                onClick={confirmDetected}
                disabled={busy}
                className="mt-1 h-9 px-3 rounded-lg bg-blue-600 text-white text-[12.5px] font-600 hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Créer les rattachements depuis les affectations
              </button>
            )}
          </div>
        )}

        {/* Équipes */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Équipe</h3>
          {artisan.artisanTeams.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {artisan.artisanTeams.map(team => (
                <span key={team.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/40 bg-elevated text-[12px] font-500 text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: team.color ?? '#6366f1' }} />{team.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/45 italic"><Users className="h-3 w-3" />Indépendant</div>
          )}
        </div>

        {/* Taux d'occupation (semaine) */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Gauge className="h-3 w-3" /> Taux d&apos;occupation
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border border-border/40 bg-elevated/40 px-3 py-2 text-center">
              <p className="text-[18px] font-800 text-foreground leading-none tabular-nums">{weekTaskCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">tâche{weekTaskCount > 1 ? 's' : ''} cette semaine</p>
            </div>
            <div className="flex-1 rounded-xl border border-border/40 bg-elevated/40 px-3 py-2 text-center">
              <p className="text-[18px] font-800 text-foreground leading-none tabular-nums">{weekProjectCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">chantier{weekProjectCount > 1 ? 's' : ''}</p>
            </div>
            <div className="flex-1">
              <span className={cn('inline-flex items-center justify-center w-full text-[10.5px] font-700 px-2 py-2 rounded-xl border', workload.cls)}>{workload.label}</span>
            </div>
          </div>
          {artisan.status === 'conflict' && (
            <p className="text-[11px] text-orange-600 dark:text-orange-400 flex items-center gap-1.5"><ShieldAlert className="h-3 w-3 shrink-0" />Plusieurs tâches simultanées — surcharge possible.</p>
          )}
        </div>

        {/* Planning */}
        <button
          onClick={() => router.push(`/planning?view=resources&artisan=${artisan.id}`)}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-border/40 bg-elevated/50 hover:bg-elevated transition-colors text-sm font-600 text-foreground"
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />Voir le planning
        </button>

        {/* Activité récente (empty state — données dédiées à un lot ultérieur) */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> Activité récente
          </h3>
          <div className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-center">
            <Clock className="h-4 w-4 text-muted-foreground/40 mx-auto mb-1" />
            <p className="text-[11.5px] text-muted-foreground/60">L&apos;activité récente sera affichée ici.</p>
          </div>
        </div>

        {/* Actions gestion (rôles internes uniquement) */}
        {canManage && (
          <div className="pt-2 border-t border-border/30 flex flex-col gap-2">
            <button onClick={onEdit} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-border/40 bg-elevated/50 hover:bg-elevated transition-colors text-sm font-600 text-foreground">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />Modifier les informations
            </button>
            <div className="flex items-center gap-2">
              {localStatus === 'active' ? (
                <button onClick={() => askStatus('suspended')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-500/40 text-amber-600 dark:text-amber-400 text-sm font-600 hover:bg-amber-500/10 disabled:opacity-50 transition-colors">
                  <Pause className="h-3.5 w-3.5" />Suspendre
                </button>
              ) : (
                <button onClick={() => askStatus('active')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-green-500/40 text-green-600 dark:text-green-400 text-sm font-600 hover:bg-green-500/10 disabled:opacity-50 transition-colors">
                  <Play className="h-3.5 w-3.5" />Réactiver
                </button>
              )}
              {localStatus !== 'archived' && (
                <button onClick={() => askStatus('archived')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/50 text-muted-foreground text-sm font-600 hover:bg-elevated disabled:opacity-50 transition-colors">
                  <Archive className="h-3.5 w-3.5" />Archiver
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3 shrink-0" />
              Suspendre ou archiver bloque l'accès à Kanvix. Aucune donnée (photos, messages, tâches, historique) n'est supprimée.
            </p>
          </div>
        )}

      </div>
    </SlidePanel>
    <ConfirmDialog state={confirm} loading={busy || inviteBusy} onCancel={() => setConfirm(null)} />
    {showInvite && orgId && currentUserId && (
      <InviteResourceModal
        artisan={{ id: artisan.id, full_name: artisan.full_name, email: artisan.email, trade: artisan.trade }}
        orgId={orgId}
        currentUserId={currentUserId}
        projects={projects}
        tasks={tasks}
        onClose={() => setShowInvite(false)}
        onSent={() => { softRefresh() }}
      />
    )}
    </>
  )
}

// Ligne de coordonnée : toujours rendue ; « Non renseigné » en muted si vide.
function ContactRow({ icon: Icon, value, href }: { icon: React.ElementType; value: string | null; href?: string }) {
  const inner = (
    <>
      <div className="w-7 h-7 rounded-lg bg-elevated border border-border/40 flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
      {value
        ? <span className="font-500 text-foreground/80">{value}</span>
        : <span className="font-500 text-muted-foreground/50 italic">Non renseigné</span>}
    </>
  )
  return href
    ? <a href={href} className="flex items-center gap-2.5 text-sm hover:text-primary transition-colors">{inner}</a>
    : <div className="flex items-center gap-2.5 text-sm">{inner}</div>
}
