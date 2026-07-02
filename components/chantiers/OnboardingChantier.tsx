'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { useToast } from '@/components/ui/toast-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Building2, ArrowRight, ArrowLeft, Check, Plus, Trash2,
  Users, AlertTriangle, ClipboardList, ChevronRight, Hammer,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = ['#2563EB', '#16A34A', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#65A30D']

const ARTISAN_COLORS = ['#2563EB', '#16A34A', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#92400E', '#0F766E']

const CHANTIER_TYPES = [
  { id: 'maison',     label: 'Maison individuelle' },
  { id: 'renovation', label: 'Rénovation' },
  { id: 'appartement',label: 'Appartement' },
  { id: 'tertiaire',  label: 'Locaux / Tertiaire' },
  { id: 'autre',      label: 'Autre' },
]

const TASK_TEMPLATES: Record<string, string[]> = {
  maison: [
    'Préparation du terrain',
    'Fondations / Gros œuvre',
    'Charpente / Couverture',
    'Menuiseries extérieures',
    'Plomberie / Électricité',
    'Isolation / Plâtrerie',
    'Carrelage / Revêtements',
    'Finitions / Peinture',
  ],
  renovation: [
    'Diagnostic / Relevé',
    'Démolition',
    'Gros œuvre / Structure',
    'Plomberie / Électricité',
    'Isolation / Plâtrerie',
    'Revêtements / Carrelage',
    'Menuiseries intérieures',
    'Finitions / Peinture',
  ],
  appartement: [
    'Démolition / Dépose',
    'Plomberie / Sanitaires',
    'Électricité',
    'Isolation / Plâtrerie',
    'Revêtements / Carrelage',
    'Menuiseries intérieures',
    'Finitions / Peinture',
  ],
  tertiaire: [
    'Études / Plans',
    'Démolition / Désamiantage',
    'Cloisons / Faux-plafonds',
    'Électricité / Réseau',
    'CVC / Plomberie',
    'Revêtements de sol',
    'Finitions',
    'Nettoyage / Réception',
  ],
  autre: [
    'Préparation',
    'Travaux phase 1',
    'Travaux phase 2',
    'Finitions',
    'Réception',
  ],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'choice' | 'nouveau' | 'encours'

interface Infos {
  name: string
  address: string
  city: string
  startDate: string
  endDate: string
  color: string
  chantierType: string
  progress: number
}

interface QuickTask {
  _id: string
  title: string
  status: 'todo' | 'in_progress' | 'done' | 'blocked'
  endDate: string
}

interface QuickArtisan {
  _id: string
  isNew: boolean
  realId?: string
  full_name: string
  trade: string
  phone: string
  email: string
  color: string
}

interface QuickIssue {
  _id: string
  title: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

interface ExistingTeam {
  id: string
  name: string
  color: string | null
  type: string | null
  members: { artisan_id: string; artisan: { id: string; full_name: string | null; trade: string | null; color: string | null } | null }[]
}

interface Props {
  orgId: string
  userId: string
  existingArtisans: { id: string; full_name: string; trade: string; color: string }[]
  existingTeams?: ExistingTeam[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingChantier({ orgId, userId, existingArtisans, existingTeams = [] }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [mode, setMode] = useState<Mode>('choice')
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ── Shared state ──
  const [infos, setInfos] = useState<Infos>({
    name: '', address: '', city: '', startDate: '', endDate: '',
    color: PALETTE[0], chantierType: 'renovation', progress: 0,
  })
  const [tasks, setTasks] = useState<QuickTask[]>([])
  const [artisans, setArtisans] = useState<QuickArtisan[]>([])
  const [issues, setIssues] = useState<QuickIssue[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  const totalSteps = mode === 'nouveau' ? 4 : 5

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true)
    setGlobalError(null)
    const db = mutationClient()

    try {
      const fullAddress = [infos.address.trim(), infos.city.trim()].filter(Boolean).join(', ') || null
      const progressValue = mode === 'encours' ? Math.min(100, Math.max(0, infos.progress)) : 0

      // 1. Create project
      const { data: project, error: projErr } = await db
        .from('projects')
        .insert({
          org_id: orgId,
          name: infos.name.trim(),
          address: fullAddress,
          start_date: infos.startDate || null,
          end_date: infos.endDate || null,
          status: 'active',
          color: infos.color,
          progress: progressValue,
          created_by: userId,
        })
        .select('id')
        .single()

      if (projErr) throw new Error(projErr.message)
      const projectId = project.id

      // 2. Create new artisans, build id map
      const artisanIdMap: Record<string, string> = {}
      for (const a of artisans) {
        if (a.isNew) {
          const { data: newA, error: aErr } = await db
            .from('artisans')
            .insert({
              org_id: orgId,
              full_name: (a.full_name ?? '').trim() || null,
              trade: (a.trade ?? '').trim() || 'Artisan',
              phone: (a.phone ?? '').trim() || null,
              email: (a.email ?? '').trim() || null,
              color: a.color,
              is_archived: false,
            })
            .select('id')
            .single()
          if (aErr) throw new Error(aErr.message)
          artisanIdMap[a._id] = newA.id
        } else if (a.realId) {
          artisanIdMap[a._id] = a.realId
        }
      }

      // 3. Create tasks
      const today = new Date().toISOString().split('T')[0]
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]
        const isComplete = t.status === 'done'
        await db.from('tasks').insert({
          project_id: projectId,
          org_id: orgId,
          title: t.title.trim(),
          status: t.status,
          priority: 'medium',
          end_date: t.endDate || null,
          start_date: infos.startDate || null,
          position: i,
          completed_at: isComplete ? today : null,
          created_by: userId,
        })
      }

      // 3b. Associate selected team with project
      if (selectedTeamId) {
        await db.from('teams').update({ project_id: projectId }).eq('id', selectedTeamId)
      }

      // 4. Create issues
      for (const issue of issues) {
        await db.from('issues').insert({
          project_id: projectId,
          org_id: orgId,
          title: issue.title.trim(),
          description: issue.description.trim() || null,
          priority: issue.priority,
          status: 'open',
          reported_by: userId,
        })
      }

      // 5. Activity log
      await db.from('activity_logs').insert({
        org_id: orgId,
        project_id: projectId,
        user_id: userId,
        action: 'created',
        entity_type: 'project',
        entity_id: projectId,
        metadata: {},
      })

      toast('Chantier créé avec succès !')
      router.push(`/chantiers/${projectId}`)
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setSubmitting(false)
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  const goNext = () => setStep(s => Math.min(s + 1, totalSteps))
  const goPrev = () => {
    if (step === 1) { setMode('choice'); setStep(1) }
    else setStep(s => s - 1)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (mode === 'choice') {
    return <ScreenChoice onChoose={(m) => { setMode(m); setStep(1) }} />
  }

  const stepLabel = mode === 'nouveau'
    ? ['Informations', 'Tâches', 'Équipe', 'Récapitulatif'][step - 1]
    : ['Informations', 'État actuel', 'Équipe', 'Réserves', 'Récapitulatif'][step - 1]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 lg:px-10 pt-8 pb-5 border-b border-border/30 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-4 mb-5">
          <button
            onClick={goPrev}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? 'Changer de parcours' : 'Retour'}
          </button>
          <span className="text-xs text-muted-foreground/60 font-500">
            {mode === 'nouveau' ? 'Nouveau chantier' : 'Chantier en cours'}
          </span>
        </div>
        <StepProgress current={step} total={totalSteps} label={stepLabel} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        <div className="max-w-2xl mx-auto">
          {mode === 'nouveau' && step === 1 && (
            <StepInfosNouveau infos={infos} onChange={setInfos} onNext={goNext} />
          )}
          {mode === 'nouveau' && step === 2 && (
            <StepTaches tasks={tasks} onChange={setTasks} infos={infos} onNext={goNext} />
          )}
          {mode === 'nouveau' && step === 3 && (
            <StepEquipe
              artisans={artisans}
              onChange={setArtisans}
              existingArtisans={existingArtisans}
              existingTeams={existingTeams}
              onNext={goNext}
              selectedTeamId={selectedTeamId}
              onTeamChange={setSelectedTeamId}
            />
          )}
          {mode === 'nouveau' && step === 4 && (
            <StepRecap
              mode={mode}
              infos={infos}
              tasks={tasks}
              artisans={artisans}
              issues={[]}
              onSubmit={handleSubmit}
              submitting={submitting}
              globalError={globalError}
            />
          )}

          {mode === 'encours' && step === 1 && (
            <StepInfosEncours infos={infos} onChange={setInfos} onNext={goNext} />
          )}
          {mode === 'encours' && step === 2 && (
            <StepEtatChantier tasks={tasks} onChange={setTasks} infos={infos} onNext={goNext} />
          )}
          {mode === 'encours' && step === 3 && (
            <StepEquipe
              artisans={artisans}
              onChange={setArtisans}
              existingArtisans={existingArtisans}
              existingTeams={existingTeams}
              onNext={goNext}
              selectedTeamId={selectedTeamId}
              onTeamChange={setSelectedTeamId}
            />
          )}
          {mode === 'encours' && step === 4 && (
            <StepReserves issues={issues} onChange={setIssues} onNext={goNext} />
          )}
          {mode === 'encours' && step === 5 && (
            <StepRecap
              mode={mode}
              infos={infos}
              tasks={tasks}
              artisans={artisans}
              issues={issues}
              onSubmit={handleSubmit}
              submitting={submitting}
              globalError={globalError}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Screen Choice ────────────────────────────────────────────────────────────

function ScreenChoice({ onChoose }: { onChoose: (mode: 'nouveau' | 'encours') => void }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 gap-8">
        <div className="text-center">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Créer un chantier</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
            Choisissez comment vous souhaitez démarrer.
          </p>
        </div>

        <div className="w-full max-w-md flex flex-col gap-4">
          <ChoiceCard
            icon={<Plus className="h-5 w-5" />}
            title="Nouveau chantier"
            description="Démarrez from scratch — planifiez les tâches et constituez l'équipe."
            cta="Commencer"
            onClick={() => onChoose('nouveau')}
            accent="primary"
          />
          <ChoiceCard
            icon={<Hammer className="h-5 w-5" />}
            title="Chantier déjà en cours"
            description="Importez l'état actuel — tâches en cours, équipe présente, réserves ouvertes."
            cta="Rentrer un chantier existant"
            onClick={() => onChoose('encours')}
            accent="orange"
          />
        </div>
      </div>
    </div>
  )
}

function ChoiceCard({
  icon, title, description, cta, onClick, accent,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  onClick: () => void
  accent: 'primary' | 'orange'
}) {
  const accentClass = accent === 'primary'
    ? 'bg-primary/10 text-primary'
    : 'bg-orange-500/10 text-orange-500'
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface border border-border/40 dark:border-white/[0.07] rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', accentClass)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-700 text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          <p className="text-xs text-primary font-600 mt-3 flex items-center gap-1 group-hover:gap-2 transition-all">
            {cta}
            <ChevronRight className="h-3.5 w-3.5" />
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── Step Progress ────────────────────────────────────────────────────────────

function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-700 text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{current} / {total}</span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── Step 1A: Infos Nouveau ───────────────────────────────────────────────────

function StepInfosNouveau({
  infos, onChange, onNext,
}: {
  infos: Infos
  onChange: (i: Infos) => void
  onNext: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Infos>) => onChange({ ...infos, ...patch })

  const handleNext = () => {
    if (!infos.name.trim()) { setError('Le nom est obligatoire'); return }
    if (infos.startDate && infos.endDate && infos.endDate < infos.startDate) {
      setError('La date de fin ne peut pas être avant la date de début')
      return
    }
    setError(null)
    onNext()
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Informations du chantier"
        subtitle="Quelques informations de base pour créer votre chantier."
      />

      <Field label="Nom du chantier" required>
        <Input
          placeholder="Ex : Rénovation appartement Rue de la Paix"
          value={infos.name}
          onChange={e => set({ name: e.target.value })}
          className="h-11"
          autoFocus
        />
      </Field>

      <Field label="Type de chantier">
        <div className="flex flex-wrap gap-2">
          {CHANTIER_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ chantierType: t.id })}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-sm font-500 border transition-colors',
                infos.chantierType === t.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Adresse">
          <Input placeholder="12 rue de la Paix" value={infos.address}
            onChange={e => set({ address: e.target.value })} className="h-11" />
        </Field>
        <Field label="Ville">
          <Input placeholder="Paris" value={infos.city}
            onChange={e => set({ city: e.target.value })} className="h-11" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de début">
          <Input type="date" value={infos.startDate}
            onChange={e => set({ startDate: e.target.value })} className="h-11" />
        </Field>
        <Field label="Date de fin prévisionnelle">
          <Input type="date" value={infos.endDate}
            onChange={e => set({ endDate: e.target.value })} className="h-11" />
        </Field>
      </div>

      <Field label="Couleur du chantier">
        <ColorPicker value={infos.color} onChange={c => set({ color: c })} />
      </Field>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <StepActions onNext={handleNext} nextLabel="Étape suivante : Tâches" />
    </div>
  )
}

// ─── Step 1B: Infos En cours ──────────────────────────────────────────────────

function StepInfosEncours({
  infos, onChange, onNext,
}: {
  infos: Infos
  onChange: (i: Infos) => void
  onNext: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Infos>) => onChange({ ...infos, ...patch })

  const handleNext = () => {
    if (!infos.name.trim()) { setError('Le nom est obligatoire'); return }
    if (infos.startDate && infos.endDate && infos.endDate < infos.startDate) {
      setError('La date de fin ne peut pas être avant la date de début')
      return
    }
    setError(null)
    onNext()
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Informations du chantier"
        subtitle="Renseignez les infos de base, puis indiquez où en est le chantier."
      />

      <Field label="Nom du chantier" required>
        <Input
          placeholder="Ex : Extension maison Dupont"
          value={infos.name}
          onChange={e => set({ name: e.target.value })}
          className="h-11"
          autoFocus
        />
      </Field>

      <Field label="Type de chantier">
        <div className="flex flex-wrap gap-2">
          {CHANTIER_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ chantierType: t.id })}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-sm font-500 border transition-colors',
                infos.chantierType === t.id
                  ? 'bg-primary text-white border-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Adresse">
          <Input placeholder="12 rue de la Paix" value={infos.address}
            onChange={e => set({ address: e.target.value })} className="h-11" />
        </Field>
        <Field label="Ville">
          <Input placeholder="Paris" value={infos.city}
            onChange={e => set({ city: e.target.value })} className="h-11" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Date de démarrage">
          <Input type="date" value={infos.startDate}
            onChange={e => set({ startDate: e.target.value })} className="h-11" />
        </Field>
        <Field label="Date de fin prévisionnelle">
          <Input type="date" value={infos.endDate}
            onChange={e => set({ endDate: e.target.value })} className="h-11" />
        </Field>
      </div>

      <Field label="Avancement global estimé" hint={`${infos.progress}%`}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={infos.progress}
            onChange={e => set({ progress: Number(e.target.value) })}
            className="flex-1 accent-primary h-2"
          />
          <div className="w-12 h-9 rounded-lg border border-border/50 bg-background flex items-center justify-center">
            <span className="text-sm font-700 text-foreground tabular-nums">{infos.progress}%</span>
          </div>
        </div>
        <div className="h-2 bg-muted/40 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${infos.progress}%` }}
          />
        </div>
      </Field>

      <Field label="Couleur du chantier">
        <ColorPicker value={infos.color} onChange={c => set({ color: c })} />
      </Field>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <StepActions onNext={handleNext} nextLabel="Étape suivante : État actuel" />
    </div>
  )
}

// ─── Step 2A: Tâches (nouveau) ────────────────────────────────────────────────

function StepTaches({
  tasks, onChange, infos, onNext,
}: {
  tasks: QuickTask[]
  onChange: (t: QuickTask[]) => void
  infos: Infos
  onNext: () => void
}) {
  const templates = TASK_TEMPLATES[infos.chantierType] ?? TASK_TEMPLATES.autre
  const [loadedTemplate, setLoadedTemplate] = useState(false)

  const loadTemplate = () => {
    const suggested: QuickTask[] = templates.map((title, i) => ({
      _id: `t_${i}`, title, status: 'todo', endDate: '',
    }))
    onChange(suggested)
    setLoadedTemplate(true)
  }

  const addTask = () => {
    onChange([...tasks, { _id: `t_${Date.now()}`, title: '', status: 'todo', endDate: '' }])
  }

  const removeTask = (id: string) => onChange(tasks.filter(t => t._id !== id))

  const updateTask = (id: string, patch: Partial<QuickTask>) =>
    onChange(tasks.map(t => t._id === id ? { ...t, ...patch } : t))

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Les grandes phases du chantier"
        subtitle="Ajoutez les principales étapes. Vous pourrez les détailler plus tard."
      />

      {tasks.length === 0 && !loadedTemplate && (
        <div className="bg-surface border border-border/30 rounded-2xl p-5 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Commencez avec un modèle adapté à votre type de chantier, ou ajoutez vos propres phases.
          </p>
          <Button type="button" variant="outline" onClick={loadTemplate} className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Utiliser le modèle "{CHANTIER_TYPES.find(c => c.id === infos.chantierType)?.label}"
          </Button>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-col gap-2">
          {tasks.map((task, i) => (
            <div key={task._id} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground/50 w-5 text-right shrink-0">{i + 1}</span>
              <Input
                placeholder="Ex : Gros œuvre"
                value={task.title}
                onChange={e => updateTask(task._id, { title: e.target.value })}
                className="h-10 flex-1"
              />
              <button
                type="button"
                onClick={() => removeTask(task._id)}
                className="p-2 text-muted-foreground/40 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addTask}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-600 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Ajouter une phase
      </button>

      <StepActions
        onNext={onNext}
        nextLabel="Étape suivante : Équipe"
        skipLabel={tasks.length === 0 ? 'Passer cette étape' : undefined}
        onSkip={tasks.length === 0 ? onNext : undefined}
      />
    </div>
  )
}

// ─── Step 2B: État chantier (en cours) — mini kanban ─────────────────────────

const KANBAN_COLS: { status: QuickTask['status']; label: string; color: string; dot: string }[] = [
  { status: 'todo',        label: 'À faire',      color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
  { status: 'in_progress', label: 'En cours',     color: 'text-blue-500',         dot: 'bg-blue-400' },
  { status: 'blocked',     label: 'Bloqué',       color: 'text-orange-500',       dot: 'bg-orange-400' },
  { status: 'done',        label: 'Terminé',      color: 'text-green-500',        dot: 'bg-green-400' },
]

function StepEtatChantier({
  tasks, onChange, infos, onNext,
}: {
  tasks: QuickTask[]
  onChange: (t: QuickTask[]) => void
  infos: Infos
  onNext: () => void
}) {
  const templates = TASK_TEMPLATES[infos.chantierType] ?? TASK_TEMPLATES.autre
  const [loadedTemplate, setLoadedTemplate] = useState(tasks.length > 0)

  const loadTemplate = () => {
    const suggested: QuickTask[] = templates.map((title, i) => ({
      _id: `t_${i}`, title, status: 'todo', endDate: '',
    }))
    onChange(suggested)
    setLoadedTemplate(true)
  }

  const addTask = (status: QuickTask['status']) => {
    onChange([...tasks, { _id: `t_${Date.now()}`, title: '', status, endDate: '' }])
  }

  const removeTask = (id: string) => onChange(tasks.filter(t => t._id !== id))

  const updateTask = (id: string, patch: Partial<QuickTask>) =>
    onChange(tasks.map(t => t._id === id ? { ...t, ...patch } : t))

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="État actuel des travaux"
        subtitle="Répartissez les phases selon leur avancement. Vous pourrez ajuster ensuite."
      />

      {!loadedTemplate && tasks.length === 0 && (
        <div className="bg-surface border border-border/30 rounded-2xl p-5 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Commencez avec le modèle "{CHANTIER_TYPES.find(c => c.id === infos.chantierType)?.label}", puis ajustez l'état de chaque phase.
          </p>
          <Button type="button" variant="outline" onClick={loadTemplate} className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Charger le modèle
          </Button>
        </div>
      )}

      {(loadedTemplate || tasks.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {KANBAN_COLS.map(col => (
            <KanbanInputCol
              key={col.status}
              col={col}
              tasks={tasks.filter(t => t.status === col.status)}
              onAdd={() => addTask(col.status)}
              onRemove={removeTask}
              onUpdate={updateTask}
            />
          ))}
        </div>
      )}

      <StepActions onNext={onNext} nextLabel="Étape suivante : Équipe" />
    </div>
  )
}

function KanbanInputCol({
  col, tasks, onAdd, onRemove, onUpdate,
}: {
  col: typeof KANBAN_COLS[number]
  tasks: QuickTask[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<QuickTask>) => void
}) {
  return (
    <div className="bg-surface/60 border border-border/20 dark:border-white/[0.05] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20 dark:border-white/[0.05]">
        <span className={cn('w-2 h-2 rounded-full shrink-0', col.dot)} />
        <span className={cn('text-xs font-700', col.color)}>{col.label}</span>
        <span className="ml-auto text-xs text-muted-foreground/50">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 p-2 min-h-[80px]">
        {tasks.map(t => (
          <div key={t._id} className="flex items-center gap-1">
            <Input
              placeholder="Phase…"
              value={t.title}
              onChange={e => onUpdate(t._id, { title: e.target.value })}
              className="h-8 text-xs flex-1"
            />
            <button
              type="button"
              onClick={() => onRemove(t._id)}
              className="p-1 text-muted-foreground/30 hover:text-red-500 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-primary transition-colors mt-0.5 px-1"
        >
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Équipe ───────────────────────────────────────────────────────────

type EquipeMode = 'none' | 'team' | 'artisans'

const TEAM_TYPE_LABEL: Record<string, string> = {
  chantier: 'Chantier', metier: 'Métier', entreprise: 'Entreprise', libre: 'Libre',
}

function StepEquipe({
  artisans, onChange, existingArtisans, existingTeams, onNext,
  selectedTeamId, onTeamChange,
}: {
  artisans: QuickArtisan[]
  onChange: (a: QuickArtisan[]) => void
  existingArtisans: { id: string; full_name: string; trade: string; color: string }[]
  existingTeams: ExistingTeam[]
  onNext: () => void
  selectedTeamId: string
  onTeamChange: (id: string) => void
}) {
  const [mode, setMode] = useState<EquipeMode>('artisans')
  const [showExisting, setShowExisting] = useState(false)

  const addNew = () => {
    const used = artisans.map(a => a.color)
    const nextColor = ARTISAN_COLORS.find(c => !used.includes(c)) ?? ARTISAN_COLORS[0]
    onChange([...artisans, {
      _id: `a_${Date.now()}`, isNew: true,
      full_name: '', trade: '', phone: '', email: '', color: nextColor,
    }])
  }

  const addExisting = (ea: { id: string; full_name: string; trade: string; color: string }) => {
    if (artisans.some(a => a.realId === ea.id)) return
    onChange([...artisans, {
      _id: `a_ex_${ea.id}`, isNew: false, realId: ea.id,
      full_name: ea.full_name, trade: ea.trade, phone: '', email: '', color: ea.color,
    }])
    setShowExisting(false)
  }

  const addTeamMembers = (teamId: string) => {
    const team = existingTeams.find(t => t.id === teamId)
    if (!team) return
    const newArtisans: QuickArtisan[] = []
    const used = artisans.map(a => a.color)
    let colorIdx = 0
    for (const m of team.members) {
      if (!m.artisan) continue
      if (artisans.some(a => a.realId === m.artisan!.id)) continue
      const nextColor = ARTISAN_COLORS.find(c => !used.includes(c) && !newArtisans.some(n => n.color === c))
        ?? ARTISAN_COLORS[colorIdx % ARTISAN_COLORS.length]
      colorIdx++
      newArtisans.push({
        _id: `a_ex_${m.artisan.id}`, isNew: false, realId: m.artisan.id,
        full_name: m.artisan.full_name ?? '',
        trade: m.artisan.trade ?? '',
        phone: '', email: '',
        color: m.artisan.color ?? nextColor,
      })
    }
    onChange([...artisans, ...newArtisans])
    setMode('artisans')
  }

  const remove = (id: string) => onChange(artisans.filter(a => a._id !== id))
  const update = (id: string, patch: Partial<QuickArtisan>) =>
    onChange(artisans.map(a => a._id === id ? { ...a, ...patch } : a))
  const availableExisting = existingArtisans.filter(ea => !artisans.some(a => a.realId === ea.id))

  const btnBase = 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-600 rounded-lg transition-colors'
  const btnActive = 'bg-primary text-white'
  const btnInactive = 'text-muted-foreground hover:text-foreground hover:bg-elevated/60'

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="L'équipe sur le chantier"
        subtitle="Choisissez comment constituer l'équipe. Vous pourrez la modifier plus tard."
      />

      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-elevated rounded-xl border border-border">
        <button type="button" onClick={() => setMode('none')} className={`${btnBase} ${mode === 'none' ? btnActive : btnInactive}`}>
          Passer
        </button>
        {existingTeams.length > 0 && (
          <button type="button" onClick={() => setMode('team')} className={`${btnBase} ${mode === 'team' ? btnActive : btnInactive}`}>
            <Users className="h-3.5 w-3.5" />
            Équipe
          </button>
        )}
        <button type="button" onClick={() => setMode('artisans')} className={`${btnBase} ${mode === 'artisans' ? btnActive : btnInactive}`}>
          Artisans
        </button>
      </div>

      {/* Team mode */}
      {mode === 'team' && existingTeams.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Sélectionnez une équipe existante. Ses membres seront ajoutés à la liste des artisans du chantier.
          </p>
          <div className="flex flex-col gap-2">
            {existingTeams.map(team => (
              <button
                key={team.id}
                type="button"
                onClick={() => onTeamChange(team.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  selectedTeamId === team.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/60 bg-surface'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: (team.color ?? '#94a3b8') + '22', border: `2px solid ${team.color ?? '#94a3b8'}` }}
                >
                  <Users className="h-4 w-4" style={{ color: team.color ?? '#94a3b8' }} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {team.type ? TEAM_TYPE_LABEL[team.type] ?? team.type : 'Libre'}
                    {' · '}
                    {team.members.length} membre{team.members.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {selectedTeamId === team.id && (
                  <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {selectedTeamId && (
            <button
              type="button"
              onClick={() => addTeamMembers(selectedTeamId)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Ajouter les membres de cette équipe
            </button>
          )}
        </div>
      )}

      {/* Artisans mode */}
      {mode === 'artisans' && (
        <>
          {artisans.length > 0 && (
            <div className="flex flex-col gap-3">
              {artisans.map(a => (
                <div key={a._id} className="bg-surface border border-border/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700 shrink-0"
                      style={{ background: a.color }}
                    >
                      {(a.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    {a.isNew ? (
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Prénom Nom"
                          value={a.full_name}
                          onChange={e => update(a._id, { full_name: e.target.value })}
                          className="h-9 text-sm"
                        />
                        <Input
                          placeholder="Corps de métier"
                          value={a.trade}
                          onChange={e => update(a._id, { trade: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-sm font-600 text-foreground">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.trade || 'Artisan'}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(a._id)}
                      className="p-1.5 text-muted-foreground/40 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {a.isNew && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/20">
                      <Input
                        placeholder="Téléphone (optionnel)"
                        value={a.phone}
                        onChange={e => update(a._id, { phone: e.target.value })}
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder="Email (optionnel)"
                        value={a.email}
                        onChange={e => update(a._id, { email: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addNew}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nouvel artisan
            </button>
            {availableExisting.length > 0 && (
              <button
                type="button"
                onClick={() => setShowExisting(s => !s)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-500 transition-colors"
              >
                <Users className="h-4 w-4" />
                Depuis la liste existante
              </button>
            )}
          </div>

          {showExisting && availableExisting.length > 0 && (
            <div className="bg-surface border border-border/30 rounded-xl overflow-hidden">
              {availableExisting.map(ea => (
                <button
                  key={ea.id}
                  type="button"
                  onClick={() => addExisting(ea)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-elevated transition-colors text-left border-b border-border/10 last:border-0"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-700 shrink-0"
                    style={{ background: ea.color }}
                  >
                    {(ea.full_name ?? 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-600 text-foreground">{ea.full_name}</p>
                    <p className="text-xs text-muted-foreground">{ea.trade || 'Artisan'}</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary ml-auto" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* None mode */}
      {mode === 'none' && (
        <div className="bg-elevated/50 border border-border/30 rounded-xl px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune équipe assignée. Vous pourrez en ajouter depuis la fiche chantier.
          </p>
        </div>
      )}

      <StepActions
        onNext={onNext}
        nextLabel="Étape suivante : Réserves"
        skipLabel={mode === 'none' || artisans.length === 0 ? 'Passer cette étape' : undefined}
        onSkip={mode === 'none' || artisans.length === 0 ? onNext : undefined}
      />
    </div>
  )
}

// ─── Step 4B: Réserves (en cours only) ───────────────────────────────────────

const ISSUE_PRIORITIES: { value: QuickIssue['priority']; label: string; color: string }[] = [
  { value: 'low',      label: 'Mineure',   color: 'text-muted-foreground border-border/60' },
  { value: 'medium',   label: 'Moyenne',   color: 'text-orange-400 border-orange-400/40' },
  { value: 'high',     label: 'Haute',     color: 'text-orange-600 border-orange-500/50' },
  { value: 'critical', label: 'Critique',  color: 'text-red-500 border-red-500/50' },
]

function StepReserves({
  issues, onChange, onNext,
}: {
  issues: QuickIssue[]
  onChange: (i: QuickIssue[]) => void
  onNext: () => void
}) {
  const addIssue = () => {
    onChange([...issues, {
      _id: `i_${Date.now()}`, title: '', priority: 'medium', description: '',
    }])
  }

  const remove = (id: string) => onChange(issues.filter(i => i._id !== id))

  const update = (id: string, patch: Partial<QuickIssue>) =>
    onChange(issues.map(i => i._id === id ? { ...i, ...patch } : i))

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Réserves en cours"
        subtitle="Signalez les points de non-conformité ou problèmes connus. Optionnel."
      />

      {issues.length > 0 && (
        <div className="flex flex-col gap-3">
          {issues.map(issue => (
            <div key={issue._id} className="bg-surface border border-border/30 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-2.5" />
                <Input
                  placeholder="Ex : Fissure au mur porteur, carrelage mal posé…"
                  value={issue.title}
                  onChange={e => update(issue._id, { title: e.target.value })}
                  className="h-10 flex-1"
                />
                <button
                  type="button"
                  onClick={() => remove(issue._id)}
                  className="p-1.5 text-muted-foreground/40 hover:text-red-500 transition-colors mt-0.5"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ISSUE_PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update(issue._id, { priority: p.value })}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-600 border transition-colors',
                      issue.priority === p.value
                        ? `${p.color} bg-current/5`
                        : 'text-muted-foreground/50 border-border/30',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addIssue}
        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-600 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Ajouter une réserve
      </button>

      <StepActions
        onNext={onNext}
        nextLabel="Étape suivante : Récapitulatif"
        skipLabel={issues.length === 0 ? 'Passer cette étape' : undefined}
        onSkip={issues.length === 0 ? onNext : undefined}
      />
    </div>
  )
}

// ─── Step Final: Récap ────────────────────────────────────────────────────────

function StepRecap({
  mode, infos, tasks, artisans, issues, onSubmit, submitting, globalError,
}: {
  mode: 'nouveau' | 'encours'
  infos: Infos
  tasks: QuickTask[]
  artisans: QuickArtisan[]
  issues: QuickIssue[]
  onSubmit: () => void
  submitting: boolean
  globalError: string | null
}) {
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const activeTasks = tasks.filter(t => t.status === 'in_progress').length
  const blockedTasks = tasks.filter(t => t.status === 'blocked').length
  const newArtisans = artisans.filter(a => a.isNew).length
  const existingArtisans = artisans.filter(a => !a.isNew).length

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Tout est prêt"
        subtitle="Vérifiez les informations avant de créer le chantier."
      />

      <div className="flex flex-col gap-3">
        {/* Project header */}
        <div className="bg-surface border border-border/30 rounded-2xl overflow-hidden">
          <div className="h-1.5" style={{ background: infos.color }} />
          <div className="px-5 py-4">
            <p className="text-lg font-extrabold text-foreground tracking-tight">{infos.name || '—'}</p>
            {(infos.address || infos.city) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[infos.address, infos.city].filter(Boolean).join(', ')}
              </p>
            )}
            {(infos.startDate || infos.endDate) && (
              <p className="text-xs text-muted-foreground/60 mt-1.5">
                {infos.startDate && `Début : ${new Date(infos.startDate).toLocaleDateString('fr-FR')}`}
                {infos.startDate && infos.endDate && ' · '}
                {infos.endDate && `Fin : ${new Date(infos.endDate).toLocaleDateString('fr-FR')}`}
              </p>
            )}
            {mode === 'encours' && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${infos.progress}%` }} />
                </div>
                <span className="text-xs font-700 text-primary tabular-nums">{infos.progress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <RecapStatCard
            value={tasks.length}
            label={tasks.length === 1 ? 'phase' : 'phases'}
            sub={activeTasks > 0 ? `${activeTasks} en cours` : doneTasks > 0 ? `${doneTasks} terminée${doneTasks > 1 ? 's' : ''}` : ''}
            color="blue"
          />
          <RecapStatCard
            value={artisans.length}
            label={artisans.length === 1 ? 'artisan' : 'artisans'}
            sub={newArtisans > 0 && existingArtisans > 0
              ? `${newArtisans} nouveau${newArtisans > 1 ? 'x' : ''}`
              : newArtisans > 0 ? `${newArtisans} à créer` : existingArtisans > 0 ? 'existants' : ''}
            color="green"
          />
          {mode === 'encours' ? (
            <RecapStatCard
              value={issues.length}
              label={issues.length === 1 ? 'réserve' : 'réserves'}
              sub={blockedTasks > 0 ? `${blockedTasks} bloquée${blockedTasks > 1 ? 's' : ''}` : ''}
              color={issues.length > 0 ? 'orange' : 'blue'}
            />
          ) : (
            <RecapStatCard
              value={0}
              label="réserves"
              sub="aucune pour l'instant"
              color="blue"
            />
          )}
        </div>
      </div>

      {globalError && <ErrorMsg>{globalError}</ErrorMsg>}

      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="button"
          size="lg"
          disabled={submitting}
          onClick={onSubmit}
          className="w-full gap-2"
        >
          {submitting ? (
            <>Création en cours…</>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Créer le chantier
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function RecapStatCard({
  value, label, sub, color,
}: {
  value: number
  label: string
  sub: string
  color: 'blue' | 'green' | 'orange'
}) {
  const cls = {
    blue:   'bg-primary/10 text-primary',
    green:  'bg-green-500/10 text-green-500',
    orange: 'bg-orange-500/10 text-orange-500',
  }[color]
  return (
    <div className={cn('rounded-xl px-4 py-3.5 text-center', cls)}>
      <p className="text-2xl font-extrabold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] font-600 mt-1">{label}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1 pb-2">
      <h2 className="text-xl font-extrabold text-foreground tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
    </div>
  )
}

function Field({
  label, required, hint, children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-600 text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
        {hint && <span className="text-xs text-muted-foreground/60">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
      {children}
    </div>
  )
}

function StepActions({
  onNext, nextLabel, skipLabel, onSkip,
}: {
  onNext: () => void
  nextLabel: string
  skipLabel?: string
  onSkip?: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-border/20">
      <Button type="button" onClick={onNext} className="flex-1 gap-2">
        {nextLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {skipLabel && onSkip && (
        <Button type="button" variant="ghost" size="sm" onClick={onSkip}
          className="text-muted-foreground text-xs shrink-0">
          {skipLabel}
        </Button>
      )}
    </div>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PALETTE.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-8 h-8 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{
            background: c,
            transform: value === c ? 'scale(1.2)' : undefined,
            boxShadow: value === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
          }}
          aria-label={c}
        />
      ))}
    </div>
  )
}
