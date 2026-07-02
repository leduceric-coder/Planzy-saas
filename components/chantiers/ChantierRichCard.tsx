'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MapPin, Calendar, AlertTriangle, Flag, Clock,
  AlertOctagon, CheckSquare, ChevronRight, Building2,
} from 'lucide-react'
import { cn, projectStatusLabel, projectStatusColor, getInitials } from '@/lib/utils'
import { getDemoCover } from '@/lib/demo-images'
import type { EnrichedProject } from './ChantiersClient'

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981',
  '#3b82f6', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444',
]

const COVER_BADGE_COLOR: Record<string, string> = {
  active:    'bg-blue-600/95 text-white border border-white/30',
  paused:    'bg-amber-500/95 text-white border border-white/30',
  completed: 'bg-green-600/95 text-white border border-white/30',
  archived:  'bg-slate-600/90 text-white border border-white/30',
}

interface Props {
  project: EnrichedProject
  today: string
}

export function ChantierRichCard({ project, today }: Props) {
  const [imgError, setImgError] = useState(false)
  const { stats } = project

  const demoCover = !project.image_url ? getDemoCover(project.name) : null
  const coverSrc = !imgError ? (project.image_url ?? demoCover) : demoCover

  const daysLeft = project.end_date
    ? Math.ceil((new Date(project.end_date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    : null
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7

  const progress   = project.progress ?? 0
  const taskRatio  = stats.totalTasks > 0 ? `${stats.doneTasks}/${stats.totalTasks}` : null
  const showRisk   = stats.isAtRisk && project.status === 'active'
  const alertCount = stats.criticalIssues + stats.blockedTasks + stats.lateTasks

  return (
    <Link
      href={`/chantiers/${project.id}`}
      className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
    >
      <article className={cn(
        'dashboard-tile bg-surface rounded-2xl overflow-hidden flex flex-col h-full',
        'border transition-[box-shadow,border-color] duration-200',
        showRisk
          ? 'border-orange-500/30 dark:border-orange-500/20 group-hover:border-orange-500/50 dark:group-hover:border-orange-500/35'
          : 'border-border/50 dark:border-white/[0.10] group-hover:border-border/80 dark:group-hover:border-white/[0.18]',
        'shadow-[0_2px_10px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]',
      )}>

        {/* ── Cover photo or color fallback ── */}
        <div className="relative h-[90px] shrink-0 overflow-hidden">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={project.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-1"
              style={{ background: `linear-gradient(135deg, ${project.color}14, ${project.color}30)` }}
            >
              <Building2
                className="h-6 w-6"
                style={{ color: project.color, opacity: 0.25 }}
              />
              <span
                className="text-[10px] font-500 tracking-wide"
                style={{ color: project.color, opacity: 0.4 }}
              >
                Aucune photo
              </span>
            </div>
          )}

          {/* Color accent strip */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: project.color }} />

          {/* Status pill */}
          <span className={cn(
            'absolute top-2 left-2.5 text-[10px] font-700 px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm',
            COVER_BADGE_COLOR[project.status] ?? 'bg-slate-600/90 text-white border border-white/30',
          )}>
            {projectStatusLabel(project.status)}
          </span>

          {/* Risk badge */}
          {showRisk && (
            <span className="absolute top-2 right-2.5 flex items-center gap-1 text-[9.5px] font-700 px-2 py-0.5 rounded-full bg-orange-600/95 text-white border border-white/30 shadow-md backdrop-blur-sm">
              <AlertTriangle className="h-2.5 w-2.5" />
              Risque
            </span>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col gap-3 px-4 pt-3.5 pb-3 flex-1">

          {/* Name + address */}
          <div className="min-w-0">
            <h3 className="font-700 text-[15px] text-foreground leading-tight truncate group-hover:text-primary transition-colors duration-150">
              {project.name}
            </h3>
            {project.address ? (
              <p className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground/65 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{project.address}</span>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/30 mt-0.5 italic">Adresse non renseignée</p>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-700 text-foreground">{progress}%</span>
              {taskRatio && (
                <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground/55">
                  <CheckSquare className="h-2.5 w-2.5" />
                  {taskRatio} tâche{stats.totalTasks > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: project.color }}
              />
            </div>
          </div>

          {/* Alert pills */}
          {(alertCount > 0 || stats.openIssues > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {stats.criticalIssues > 0 && (
                <span className="flex items-center gap-1 text-[9.5px] font-700 px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  <Flag className="h-2.5 w-2.5" />
                  {stats.criticalIssues} critique{stats.criticalIssues > 1 ? 's' : ''}
                </span>
              )}
              {stats.blockedTasks > 0 && (
                <span className="flex items-center gap-1 text-[9.5px] font-700 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  <AlertOctagon className="h-2.5 w-2.5" />
                  {stats.blockedTasks} bloqué{stats.blockedTasks > 1 ? 'es' : 'e'}
                </span>
              )}
              {stats.lateTasks > 0 && (
                <span className="flex items-center gap-1 text-[9.5px] font-700 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <Clock className="h-2.5 w-2.5" />
                  {stats.lateTasks} retard{stats.lateTasks > 1 ? 's' : ''}
                </span>
              )}
              {stats.openIssues > 0 && stats.criticalIssues === 0 && (
                <span className="flex items-center gap-1 text-[9.5px] font-600 px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                  {stats.openIssues} réserve{stats.openIssues > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Footer: date + team */}
          <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-border/15">
            {daysLeft !== null ? (
              <span className={cn(
                'flex items-center gap-1 text-[11px] font-600',
                isOverdue ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-muted-foreground/65',
              )}>
                <Calendar className="h-3 w-3" />
                {isOverdue
                  ? `${Math.abs(daysLeft)}j de retard`
                  : daysLeft === 0 ? "Aujourd'hui"
                  : `${daysLeft}j restants`}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/30">Pas de date</span>
            )}

            {stats.artisans.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {stats.artisans.slice(0, 3).map((a, i) => (
                    <div
                      key={a.id}
                      className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-white text-[8px] font-700 shrink-0"
                      style={{
                        background: a.color || AVATAR_COLORS[i % AVATAR_COLORS.length],
                        zIndex: 3 - i,
                      }}
                      title={a.full_name}
                    >
                      {getInitials(a.full_name)}
                    </div>
                  ))}
                </div>
                {stats.artisans.length > 3 && (
                  <span className="text-[10px] text-muted-foreground/55 font-600">
                    +{stats.artisans.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CTA — visible au repos, accentué au hover ── */}
        <div className={cn(
          'shrink-0 flex items-center justify-between px-4 py-3',
          'border-t border-border/20',
          'group-hover:bg-primary/[0.04] transition-colors duration-150',
        )}>
          <span className="text-[12.5px] font-600 text-foreground/60 group-hover:text-primary transition-colors duration-150">
            Ouvrir le chantier
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-150" />
        </div>

      </article>
    </Link>
  )
}
