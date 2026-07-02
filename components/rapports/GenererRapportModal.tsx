'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, getISOWeek } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  orgId: string
  userId: string
  projects: { id: string; name: string; color: string }[]
  onClose: () => void
}

const PERIODS = [
  { value: 'this_week', label: 'Cette semaine' },
  { value: 'last_week', label: 'Semaine dernière' },
  { value: 'this_month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: 'custom', label: 'Période personnalisée' },
]

function getPeriodMeta(period: string, customFrom: string, customTo: string) {
  const now = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  if (period === 'this_week') {
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return { from: fmt(start), to: fmt(end), label: `Semaine du ${format(start, 'd MMMM yyyy', { locale: fr })}`, type: 'weekly', weekNumber: getISOWeek(start) }
  }
  if (period === 'last_week') {
    const last = subWeeks(now, 1)
    const start = startOfWeek(last, { weekStartsOn: 1 })
    const end = endOfWeek(last, { weekStartsOn: 1 })
    return { from: fmt(start), to: fmt(end), label: `Semaine du ${format(start, 'd MMMM yyyy', { locale: fr })}`, type: 'weekly', weekNumber: getISOWeek(start) }
  }
  if (period === 'this_month') {
    const start = startOfMonth(now)
    const end = endOfMonth(now)
    return { from: fmt(start), to: fmt(end), label: format(now, 'MMMM yyyy', { locale: fr }), type: 'monthly', weekNumber: null }
  }
  if (period === 'last_month') {
    const last = subMonths(now, 1)
    const start = startOfMonth(last)
    const end = endOfMonth(last)
    return { from: fmt(start), to: fmt(end), label: format(last, 'MMMM yyyy', { locale: fr }), type: 'monthly', weekNumber: null }
  }
  return { from: customFrom, to: customTo, label: `${customFrom} au ${customTo}`, type: 'custom', weekNumber: null }
}

export function GenererRapportModal({ orgId, userId, projects, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [period, setPeriod] = useState('this_week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [includePhotos, setIncludePhotos] = useState(true)
  const [includeIssues, setIncludeIssues] = useState(true)
  const [includeMessages, setIncludeMessages] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) { setError('Sélectionnez un chantier'); return }
    if (period === 'custom') {
      if (!customFrom || !customTo) { setError('Saisissez les deux dates'); return }
      if (customTo < customFrom) { setError('La date de fin doit être après la date de début'); return }
    }
    setLoading(true)
    setError(null)

    const { from, to, label, type, weekNumber } = getPeriodMeta(period, customFrom, customTo)
    const project = projects.find(p => p.id === projectId)
    const title = `Rapport ${project?.name ?? 'chantier'} — ${label}`

    const { data, error: err } = await mutationClient()
      .from('reports')
      .insert({
        org_id: orgId,
        project_id: projectId,
        title,
        type,
        generated_by: userId,
        week_number: weekNumber,
        content: {
          period_start: from,
          period_end: to,
          period_label: label,
          include_photos: includePhotos,
          include_issues: includeIssues,
          include_messages: includeMessages,
        },
      })
      .select('id')
      .single()

    if (err) { setError(err.message); setLoading(false); return }
    toast('Rapport créé')
    router.push(`/rapports/${data.id}`)
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Générer un rapport">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>

        {/* Project */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Chantier <span className="text-destructive">*</span>
          </label>
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun chantier actif disponible.</p>
          ) : (
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {/* Period */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">Période</label>
          <div className="flex flex-col gap-2">
            {PERIODS.map(p => (
              <label key={p.value} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="period"
                  value={p.value}
                  checked={period === p.value}
                  onChange={() => setPeriod(p.value)}
                  className="accent-primary"
                />
                <span className="text-sm text-foreground">{p.label}</span>
              </label>
            ))}
          </div>
          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-600 text-foreground">Début</label>
                <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-600 text-foreground">Fin</label>
                <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9" />
              </div>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">Contenu à inclure</label>
          {([
            { key: 'photos', label: 'Photos du chantier', value: includePhotos, set: setIncludePhotos },
            { key: 'issues', label: 'Réserves', value: includeIssues, set: setIncludeIssues },
            { key: 'messages', label: 'Messages récents', value: includeMessages, set: setIncludeMessages },
          ] as const).map(opt => (
            <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={opt.value}
                onChange={e => opt.set(e.target.checked)}
                className="rounded accent-primary"
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading || projects.length === 0} className="flex-1">
            {loading ? 'Génération…' : 'Générer le rapport'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </SlidePanel>
  )
}
