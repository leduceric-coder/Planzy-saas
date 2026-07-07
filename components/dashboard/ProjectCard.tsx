import Link from 'next/link'
import { MapPin, Calendar } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn, projectStatusLabel, projectStatusColor } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const daysLeft = project.end_date
    ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000)
    : null
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft < 7

  return (
    <Link href={`/chantiers/${project.id}`} className="block group h-full">
      <div className={cn(
        'bg-surface rounded-2xl overflow-hidden flex flex-col h-full min-h-[180px]',
        'border border-border/30 dark:border-white/[0.07]',
        'shadow-sm hover:shadow-xl transition-all duration-200',
        'dark:shadow-black/20',
      )}>
        {/* Barre couleur en tête de carte */}
        <div className="h-[5px] w-full shrink-0" style={{ background: project.color }} />

        <div className="p-5 flex flex-col flex-1 gap-4">
          {/* Statut pill seul */}
          <span className={cn(
            'self-start text-[11px] font-700 px-2.5 py-1 rounded-full whitespace-nowrap',
            projectStatusColor(project.status),
          )}>
            {projectStatusLabel(project.status)}
          </span>

          {/* Nom + adresse */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'font-700 text-[17px] text-foreground leading-tight',
              'group-hover:text-primary transition-colors duration-150',
            )}>
              {project.name}
            </h3>
            {project.address ? (
              <p className="text-[12px] text-muted-foreground/70 flex items-center gap-1 mt-1.5 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.address}</span>
              </p>
            ) : (
              <p className="text-[12px] text-muted-foreground/40 mt-1.5">Sans adresse renseignée</p>
            )}
          </div>

          {/* Barre d'avancement — avec date intégrée */}
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-700 text-foreground">{project.progress ?? 0}%</span>
              {daysLeft !== null ? (
                <span className={cn(
                  'text-[12px] font-600 flex items-center gap-1',
                  isOverdue ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-muted-foreground',
                )}>
                  <Calendar className="h-3 w-3" />
                  {isOverdue
                    ? `${Math.abs(daysLeft)}j de retard`
                    : daysLeft === 0 ? "Aujourd'hui"
                    : `${daysLeft}j restants`}
                </span>
              ) : (
                <span className="text-[12px] text-muted-foreground/40">Pas de date</span>
              )}
            </div>
            <Progress value={project.progress ?? 0} className="h-2" />
          </div>

          {/* CTA footer */}
          <div className={cn(
            'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[13px] font-600',
            'bg-background/60 dark:bg-elevated/40 border border-border/40 dark:border-white/[0.06]',
            'text-muted-foreground group-hover:text-primary group-hover:border-primary/30',
            'transition-all duration-150',
          )}>
            Voir le chantier
            <span
              className="leading-none group-hover:translate-x-0.5 transition-transform duration-150 inline-block"
              aria-hidden="true"
            >
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
