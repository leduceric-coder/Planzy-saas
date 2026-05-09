'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, CheckSquare, MessageSquare, Image, FileText, Package, AlertTriangle, BarChart3, Activity } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TaskPanel } from '@/components/tasks/TaskPanel'
import { cn, formatDate, taskStatusColor, taskStatusLabel, issueStatusLabel, projectStatusLabel } from '@/lib/utils'
import type { Project, Task, Issue, Photo, Document, Message, Material, Delivery, Report, ActivityLog } from '@/lib/types'

interface Props {
  project: Project
  tasks: (Task & { assignee?: any; team?: any })[]
  issues: (Issue & { artisan?: any })[]
  photos: (Photo & { taken_by_profile?: any })[]
  documents: Document[]
  messages: (Message & { sender?: any })[]
  materials: Material[]
  deliveries: Delivery[]
  reports: Report[]
  logs: (ActivityLog & { profile?: any })[]
}

export function ChantierDetail({ project, tasks, issues, photos, documents, messages, materials, deliveries, reports, logs }: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    done: tasks.filter(t => t.status === 'done' || t.status === 'validated').length,
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className={cn('flex flex-col flex-1 overflow-hidden transition-all', selectedTask && 'mr-[460px]')}>
        {/* Header */}
        <div className="shrink-0 h-[72px] px-10 border-b border-border bg-surface flex items-center gap-6">
          <Link href="/chantiers" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-600">
            <ArrowLeft className="h-4 w-4" />
            Chantiers
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="font-700 text-lg text-foreground flex-1">{project.name}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{project.address}</span>
            <Badge variant="default">{projectStatusLabel(project.status)}</Badge>
          </div>
        </div>

        {/* Summary bar */}
        <div className="shrink-0 px-10 py-4 border-b border-border flex items-center gap-8">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">Avancement global</span>
              <span className="font-700 text-foreground">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>
          <div className="flex gap-6 text-sm shrink-0">
            {project.start_date && (
              <div>
                <p className="text-xs text-muted-foreground">Début</p>
                <p className="font-500 text-foreground">{formatDate(project.start_date)}</p>
              </div>
            )}
            {project.end_date && (
              <div>
                <p className="text-xs text-muted-foreground">Fin prévue</p>
                <p className="font-500 text-foreground">{formatDate(project.end_date)}</p>
              </div>
            )}
            <div className="flex gap-3">
              <StatPill label="En cours" value={tasksByStatus.in_progress} color="primary" />
              <StatPill label="Bloquées" value={tasksByStatus.blocked} color="destructive" />
              <StatPill label="Terminées" value={tasksByStatus.done} color="green" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks" className="flex flex-col flex-1 overflow-hidden">
          <div className="shrink-0 px-10 py-3 border-b border-border">
            <TabsList className="h-9">
              <TabsTrigger value="tasks" className="text-xs gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />Tâches ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="messages" className="text-xs gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />Messages ({messages.length})
              </TabsTrigger>
              <TabsTrigger value="issues" className="text-xs gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />Réserves ({issues.length})
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs gap-1.5">
                <Image className="h-3.5 w-3.5" />Photos ({photos.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />Documents ({documents.length})
              </TabsTrigger>
              <TabsTrigger value="materials" className="text-xs gap-1.5">
                <Package className="h-3.5 w-3.5" />Matériaux ({materials.length})
              </TabsTrigger>
              <TabsTrigger value="reports" className="text-xs gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />Rapports ({reports.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-10 py-6">
            {/* TASKS */}
            <TabsContent value="tasks" className="mt-0">
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                {tasks.length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Aucune tâche sur ce chantier
                  </div>
                )}
                <div className="divide-y divide-border">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-elevated transition-colors group"
                      onClick={() => setSelectedTask(task === selectedTask ? null : task)}
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', {
                        'bg-muted-foreground': task.status === 'todo',
                        'bg-primary': task.status === 'in_progress',
                        'bg-destructive': task.status === 'blocked',
                        'bg-yellow-500': task.status === 'review',
                        'bg-green-500': task.status === 'done' || task.status === 'validated',
                      })} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-500 text-foreground">{task.title}</span>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-600 shrink-0', taskStatusColor(task.status))}>
                        {taskStatusLabel(task.status)}
                      </span>
                      {task.assignee && (
                        <div
                          className="w-6 h-6 rounded shrink-0 text-[10px] font-700 text-white flex items-center justify-center"
                          style={{ background: task.assignee.color }}
                          title={task.assignee.full_name}
                        >
                          {task.assignee.full_name?.[0] ?? '?'}
                        </div>
                      )}
                      {task.end_date && (
                        <span className={cn('text-xs shrink-0', new Date(task.end_date) < new Date() && task.status !== 'done' && task.status !== 'validated' ? 'text-destructive font-500' : 'text-muted-foreground')}>
                          {formatDate(task.end_date)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* MESSAGES */}
            <TabsContent value="messages" className="mt-0">
              <div className="flex flex-col gap-3">
                {messages.map(msg => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary text-xs font-700 flex items-center justify-center shrink-0">
                      {msg.sender?.full_name?.[0] ?? '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-600 text-foreground">{msg.sender?.full_name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
                        {msg.type !== 'text' && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-600">
                            {msg.type}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Aucun message sur ce chantier</div>}
              </div>
            </TabsContent>

            {/* ISSUES */}
            <TabsContent value="issues" className="mt-0">
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="divide-y divide-border">
                  {issues.map(issue => (
                    <div key={issue.id} className="flex items-center gap-3 px-5 py-4">
                      <AlertTriangle className={cn('h-4 w-4 shrink-0', issue.priority === 'critical' || issue.priority === 'high' ? 'text-destructive' : 'text-yellow-500')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-500 text-foreground">{issue.title}</p>
                        {issue.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{issue.description}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-600 shrink-0">
                        {issueStatusLabel(issue.status)}
                      </span>
                      {issue.artisan && <span className="text-xs text-muted-foreground shrink-0">{issue.artisan.full_name}</span>}
                    </div>
                  ))}
                  {issues.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Aucune réserve</div>}
                </div>
              </div>
            </TabsContent>

            {/* PHOTOS */}
            <TabsContent value="photos" className="mt-0">
              <div className="grid grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-elevated border border-border relative group cursor-pointer">
                    <img src={photo.url} alt={photo.caption ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                        {photo.caption}
                      </div>
                    )}
                    {photo.theme && (
                      <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {photo.theme}
                      </div>
                    )}
                  </div>
                ))}
                {photos.length === 0 && <div className="col-span-4 py-8 text-center text-sm text-muted-foreground">Aucune photo</div>}
              </div>
            </TabsContent>

            {/* DOCUMENTS */}
            <TabsContent value="documents" className="mt-0">
              <div className="flex flex-col gap-2">
                {documents.map(doc => (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:border-border/60 hover:bg-elevated transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600 text-foreground truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.category} · {formatDate(doc.created_at)}</p>
                    </div>
                  </a>
                ))}
                {documents.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Aucun document</div>}
              </div>
            </TabsContent>

            {/* MATERIALS */}
            <TabsContent value="materials" className="mt-0">
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="divide-y divide-border">
                  {materials.map(mat => (
                    <div key={mat.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-500 text-foreground">{mat.name}</p>
                        <p className="text-xs text-muted-foreground">{mat.quantity} {mat.unit}</p>
                      </div>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-600 shrink-0', {
                        'bg-muted text-muted-foreground': mat.status === 'pending',
                        'bg-primary/15 text-primary': mat.status === 'ordered',
                        'bg-green-500/15 text-green-500': mat.status === 'delivered',
                        'bg-destructive/15 text-destructive': mat.status === 'delayed',
                      })}>
                        {mat.status === 'pending' ? 'En attente' : mat.status === 'ordered' ? 'Commandé' : mat.status === 'delivered' ? 'Livré' : mat.status === 'delayed' ? 'Retard' : mat.status}
                      </span>
                      {mat.expected_delivery && (
                        <span className="text-xs text-muted-foreground shrink-0">{formatDate(mat.expected_delivery)}</span>
                      )}
                    </div>
                  ))}
                  {materials.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Aucun matériau suivi</div>}
                </div>
              </div>
            </TabsContent>

            {/* REPORTS */}
            <TabsContent value="reports" className="mt-0">
              <div className="flex flex-col gap-3">
                {reports.map(report => (
                  <div key={report.id} className="bg-surface border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-700 text-foreground">{report.title}</h3>
                      <span className="text-xs text-muted-foreground">{formatDate(report.created_at)}</span>
                    </div>
                    <Badge variant="secondary">{report.type === 'weekly' ? 'Hebdomadaire' : report.type}</Badge>
                  </div>
                ))}
                {reports.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Aucun rapport généré</div>}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Task sidewindow */}
      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600', {
      'bg-primary/15 text-primary': color === 'primary',
      'bg-destructive/15 text-destructive': color === 'destructive',
      'bg-green-500/15 text-green-500': color === 'green',
    })}>
      <span className="text-base font-700">{value}</span>
      <span>{label}</span>
    </div>
  )
}
