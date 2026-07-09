'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone, Mail, Pencil, Users, Building2, ListChecks, Plus, X, CalendarRange,
  Pause, Play, Archive, ShieldAlert, UserCheck, MailCheck, UserX, Lock,
} from 'lucide-react'
import { SlidePanel } from '@/components/ui/SlidePanel'
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
  hasPendingInvite?: boolean
  weekTasks: (TaskWithProject & { projectInfo: { id: string; name: string; color: string } | null })[]
  currentProjects: { id: string; name: string; color: string }[]
  artisanTeams: { id: string; name: string; color: string | null }[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  free:     { label: 'Disponible',    cls: 'bg-muted/40 text-muted-foreground/70 border-border/30' },
  assigned: { label: 'Affecté',       cls: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  conflict: { label: 'Multi-affecté', cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
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
  projects?: ProjectRef[]
  tasks?: TaskWithProject[]
  onChanged?: () => void
}

export function ArtisanSidePanel({ artisan, onClose, onEdit, orgId, canManage = false, projects = [], tasks = [], onChanged }: Props) {
  const router = useRouter()
  const { toast: showToast } = useToast()
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

  // Rattachements réels (RLS-scoped) rechargés à l'ouverture / après mutation.
  const loadAssignments = () => {
    setLoading(true)
    const supabase = createClient()
    Promise.all([
      supabase.from('artisan_project_assignments').select('id, project_id').eq('artisan_id', artisan.id).eq('is_active', true),
      supabase.from('artisan_task_assignments').select('id, task_id, project_id').eq('artisan_id', artisan.id).eq('is_active', true),
    ]).then(([p, t]) => {
      setProjAssigns((p.data ?? []) as ProjAssign[])
      setTaskAssigns((t.data ?? []) as TaskAssign[])
      setLoading(false)
    })
  }
  useEffect(loadAssignments, [artisan.id])

  const projName = (id: string) => projects.find(p => p.id === id)?.name ?? 'Chantier'
  const projColor = (id: string) => projects.find(p => p.id === id)?.color ?? '#6366f1'
  const taskOf = (id: string) => tasks.find(t => t.id === id)
  const taskTitle = (id: string) => taskOf(id)?.title ?? 'Tâche'
  const taskStatusLabel = (id: string) => {
    const s = taskOf(id)?.status
    return s ? (TASK_STATUS_LABEL[s] ?? s) : null
  }

  const refresh = () => { loadAssignments(); onChanged?.() }

  // ── Statut lifecycle ──
  async function setStatus(next: AccountStatus) {
    if (busy || !orgId) return
    if (next !== 'active' && !confirm(
      next === 'suspended'
        ? "Suspendre cet artisan ? Il ne pourra plus accéder à Kanvix tant qu'il est suspendu. Aucune donnée (photos, messages, tâches, historique) n'est supprimée."
        : "Archiver cet artisan ? Il sera retiré des listes actives et ne pourra plus accéder à Kanvix. Aucune donnée n'est supprimée.",
    )) return
    setBusy(true)
    const patch: Record<string, unknown> =
      next === 'archived' ? { status: 'archived', is_archived: true }
      : next === 'active' ? { status: 'active', is_archived: false }
      : { status: 'suspended' } // suspension ne touche pas is_archived
    const { error } = await mutationClient().from('artisans').update(patch).eq('id', artisan.id).eq('org_id', orgId)
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    setLocalStatus(next)
    showToast(next === 'active' ? 'Artisan réactivé' : next === 'suspended' ? 'Artisan suspendu' : 'Artisan archivé')
    onChanged?.()
    // On garde le panneau ouvert pour suspend/réactiver (feedback visible).
    // L'archivage retire l'artisan de la liste active → on ferme.
    if (next === 'archived') onClose()
  }

  // ── Rattachement chantier ──
  async function addProject() {
    if (!addProjectId || !orgId || busy) return
    setBusy(true)
    const { error } = await mutationClient().from('artisan_project_assignments')
      .insert({ org_id: orgId, artisan_id: artisan.id, project_id: addProjectId })
    setBusy(false)
    if (error && !String(error.message).toLowerCase().includes('duplicate')) { showToast(error.message, 'error'); return }
    setAddProjectId('')
    showToast('Chantier rattaché')
    refresh()
  }
  async function removeProject(a: ProjAssign) {
    if (busy) return
    const taskCount = taskAssigns.filter(t => t.project_id === a.project_id).length
    if (!confirm(
      taskCount > 0
        ? `Retirer ce chantier ? Les ${taskCount} tâche(s) rattachée(s) de ce chantier seront aussi retirées. Cela retire l'accès opérationnel, pas l'historique métier.`
        : "Retirer ce chantier ? Cela retire l'accès opérationnel, pas l'historique métier.",
    )) return
    setBusy(true)
    // Retirer d'abord les tâches du chantier, puis le chantier (pas de tâche orpheline).
    await mutationClient().from('artisan_task_assignments').delete().eq('artisan_id', artisan.id).eq('project_id', a.project_id)
    const { error } = await mutationClient().from('artisan_project_assignments').delete().eq('id', a.id)
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Chantier retiré')
    refresh()
  }

  // ── Rattachement tâche ──
  async function addTask() {
    if (!addTaskProjectId || !addTaskId || !orgId || busy) return
    setBusy(true)
    // Garantir le rattachement chantier correspondant (doublon ignoré).
    await mutationClient().from('artisan_project_assignments')
      .insert({ org_id: orgId, artisan_id: artisan.id, project_id: addTaskProjectId })
    const { error } = await mutationClient().from('artisan_task_assignments')
      .insert({ org_id: orgId, artisan_id: artisan.id, project_id: addTaskProjectId, task_id: addTaskId })
    setBusy(false)
    if (error && !String(error.message).toLowerCase().includes('duplicate')) { showToast(error.message, 'error'); return }
    setAddTaskId('')
    showToast('Tâche rattachée')
    refresh()
  }
  async function removeTask(a: TaskAssign) {
    if (busy) return
    setBusy(true)
    const { error } = await mutationClient().from('artisan_task_assignments').delete().eq('id', a.id)
    setBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Tâche retirée')
    refresh()
  }

  const availableTasks = tasks.filter(t =>
    t.project_id === addTaskProjectId && !taskAssigns.some(a => a.task_id === t.id))
  const availableProjects = projects.filter(p => !projAssigns.some(a => a.project_id === p.id))
  const noProjects = !loading && projAssigns.length === 0
  const noTasks = !loading && taskAssigns.length === 0

  // Compte lié / invitation
  const accountLine =
    artisan.hasAccount
      ? { icon: UserCheck, cls: 'text-green-600 dark:text-green-400', label: 'Compte Kanvix lié' }
      : artisan.hasPendingInvite
        ? { icon: MailCheck, cls: 'text-amber-600 dark:text-amber-400', label: 'Invitation en attente' }
        : { icon: UserX, cls: 'text-muted-foreground/70', label: 'Aucun compte lié' }
  const AccountIcon = accountLine.icon

  return (
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
              <span className={cn('inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border', workload.cls)}>{workload.label}</span>
              {noProjects && <span className="inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">Sans chantier</span>}
              {noTasks && <span className="inline-flex items-center text-[10px] font-700 px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">Sans tâche</span>}
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
          <h3 className="text-[10px] font-800 uppercase tracking-widest text-muted-foreground">Coordonnées</h3>
          <div className="flex flex-col gap-1.5">
            <ContactRow icon={Mail} value={artisan.email} href={artisan.email ? `mailto:${artisan.email}` : undefined} />
            <ContactRow icon={Phone} value={artisan.phone} href={artisan.phone ? `tel:${artisan.phone}` : undefined} />
            <div className="flex items-center gap-2.5 text-sm">
              <div className="w-7 h-7 rounded-lg bg-elevated border border-border/40 flex items-center justify-center shrink-0"><AccountIcon className={cn('h-3.5 w-3.5', accountLine.cls)} /></div>
              <span className={cn('font-500', accountLine.cls)}>{accountLine.label}</span>
            </div>
          </div>
        </div>

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
                    <button onClick={() => removeProject(a)} disabled={busy} title="Retirer" className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><X className="h-3.5 w-3.5" /></button>
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
                    <button onClick={() => removeTask(a)} disabled={busy} title="Retirer" className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors self-start"><X className="h-3.5 w-3.5" /></button>
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

        {/* Planning */}
        <button
          onClick={() => router.push(`/planning?view=resources&artisan=${artisan.id}`)}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-border/40 bg-elevated/50 hover:bg-elevated transition-colors text-sm font-600 text-foreground"
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />Voir le planning
        </button>

        {/* Actions gestion (rôles internes uniquement) */}
        {canManage && (
          <div className="pt-2 border-t border-border/30 flex flex-col gap-2">
            <button onClick={onEdit} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-border/40 bg-elevated/50 hover:bg-elevated transition-colors text-sm font-600 text-foreground">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />Modifier les informations
            </button>
            <div className="flex items-center gap-2">
              {localStatus === 'active' ? (
                <button onClick={() => setStatus('suspended')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-500/40 text-amber-600 dark:text-amber-400 text-sm font-600 hover:bg-amber-500/10 disabled:opacity-50 transition-colors">
                  <Pause className="h-3.5 w-3.5" />Suspendre
                </button>
              ) : (
                <button onClick={() => setStatus('active')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-green-500/40 text-green-600 dark:text-green-400 text-sm font-600 hover:bg-green-500/10 disabled:opacity-50 transition-colors">
                  <Play className="h-3.5 w-3.5" />Réactiver
                </button>
              )}
              {localStatus !== 'archived' && (
                <button onClick={() => setStatus('archived')} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/50 text-muted-foreground text-sm font-600 hover:bg-elevated disabled:opacity-50 transition-colors">
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
