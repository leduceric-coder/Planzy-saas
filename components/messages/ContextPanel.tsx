'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, FileText, Image, CheckSquare, Clock, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { cn, formatDate, taskStatusColor, taskStatusLabel } from '@/lib/utils'
import type { Task, IssueStatus } from '@/lib/types'
import { PhotoThumb } from '@/components/ui/PhotoThumb'

function stripDemo(s: string | null | undefined): string {
  if (!s) return ''
  return s.startsWith('[DEMO] ') ? s.slice(7) : s
}

type ContextTask = Pick<Task, 'id' | 'title' | 'status' | 'end_date' | 'priority'>
type ContextDoc = { id: string; name: string; file_type: string | null; created_at: string }
type ContextPhoto = { id: string; url: string; thumbnail_url: string | null; caption: string | null; created_at: string }
type ContextIssue = { id: string; title: string; status: IssueStatus; priority: string; created_at: string }

interface Props {
  project: { id: string; name: string; color: string } | null
  tasks: ContextTask[]
  documents: ContextDoc[]
  photos: ContextPhoto[]
  issues: ContextIssue[]
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  if (count === 0) return null
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-700 uppercase tracking-wider text-muted-foreground hover:bg-elevated transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        {icon}
        {title}
        <span className="ml-auto bg-elevated border border-border rounded-full px-1.5 py-0.5 text-[10px] font-700">{count}</span>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export function ContextPanel({ project, tasks, documents, photos, issues }: Props) {
  const [visible, setVisible] = useState(true)
  const today = new Date()

  const projectTasks = tasks.filter(t => !['done', 'validated', 'archived'].includes(t.status))
  const lateTasks = projectTasks.filter(t => t.end_date && new Date(t.end_date) < today)
  const activeTasks = projectTasks.filter(t => !lateTasks.find(l => l.id === t.id))
  const openIssues = issues.filter(i => ['open', 'assigned', 'in_progress'].includes(i.status))

  if (!project) {
    return (
      <div className="hidden lg:flex w-72 shrink-0 border-l border-border bg-surface flex-col items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-4">Sélectionnez un fil lié à un chantier pour voir le contexte</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'hidden lg:flex flex-col border-l border-border bg-surface transition-all duration-200',
      visible ? 'w-72 shrink-0' : 'w-10 shrink-0'
    )}>
      {/* Toggle + header */}
      <div className={cn('shrink-0 flex items-center border-b border-border', visible ? 'px-4 py-3 gap-3' : 'flex-col py-3 gap-2')}>
        <button
          onClick={() => setVisible(v => !v)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={visible ? 'Masquer le contexte' : 'Afficher le contexte'}
        >
          {visible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
        {visible && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded shrink-0" style={{ background: project.color }} />
            <span className="text-sm font-700 text-foreground truncate">{project.name}</span>
          </div>
        )}
      </div>

      {visible && (
        <div className="flex-1 overflow-y-auto">

          {/* Late tasks */}
          {lateTasks.length > 0 && (
            <Section
              title="Retards"
              icon={<AlertTriangle className="h-3 w-3 text-red-500" />}
              count={lateTasks.length}
            >
              <div className="flex flex-col gap-1 px-4">
                {lateTasks.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-start gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">{t.title}</p>
                      <p className="text-[10px] text-red-500">{formatDate(t.end_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Active tasks */}
          <Section
            title="Tâches en cours"
            icon={<CheckSquare className="h-3 w-3" />}
            count={activeTasks.length}
          >
            <div className="flex flex-col gap-1 px-4">
              {activeTasks.slice(0, 6).map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-600 shrink-0', taskStatusColor(t.status))}>
                    {taskStatusLabel(t.status)}
                  </span>
                  <p className="text-xs text-foreground truncate flex-1">{t.title}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Open issues */}
          {openIssues.length > 0 && (
            <Section
              title="Réserves"
              icon={<AlertTriangle className="h-3 w-3 text-orange-500" />}
              count={openIssues.length}
            >
              <div className="flex flex-col gap-1 px-4">
                {openIssues.slice(0, 4).map(i => (
                  <div key={i.id} className="flex items-start gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-foreground truncate">{i.title}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent documents */}
          {documents.length > 0 && (
            <Section
              title="Documents"
              icon={<FileText className="h-3 w-3" />}
              count={documents.length}
            >
              <div className="flex flex-col gap-1 px-4">
                {documents.slice(0, 4).map(d => (
                  <div key={d.id} className="flex items-center gap-2 py-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground truncate">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(d.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Recent photos */}
          {photos.length > 0 && (
            <Section
              title="Photos"
              icon={<Image className="h-3 w-3" />}
              count={photos.length}
            >
              <div className="grid grid-cols-3 gap-1.5 px-4">
                {photos.slice(0, 6).map(p => (
                  <div
                    key={p.id}
                    className="aspect-square rounded-lg overflow-hidden bg-elevated border border-border"
                  >
                    <PhotoThumb
                      src={p.thumbnail_url ?? p.url}
                      caption={p.caption}
                      alt={stripDemo(p.caption) || 'Photo chantier'}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {activeTasks.length === 0 && lateTasks.length === 0 && openIssues.length === 0 && documents.length === 0 && photos.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-muted-foreground text-center px-4">Aucun élément de contexte pour ce chantier</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
