import Link from 'next/link'
import { MapPin, Calendar } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn, formatDate, projectStatusLabel, projectStatusColor } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const daysLeft = project.end_date
    ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <Link href={`/chantiers/${project.id}`}>
      <div className="bg-surface border border-border rounded-xl overflow-hidden cursor-pointer hover:border-border/60 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
        {/* Image / Color bar */}
        <div
          className="h-24 relative"
          style={{ background: project.image_url ? undefined : `linear-gradient(135deg, ${project.color}22, ${project.color}44)` }}
        >
          {project.image_url && (
            <img src={project.image_url} alt={project.name} className="w-full h-full object-cover" />
          )}
          <div
            className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-600"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)' }}
          >
            {projectStatusLabel(project.status)}
          </div>
          {/* Color accent */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ background: project.color }}
          />
        </div>

        <div className="p-4 flex flex-col flex-1 gap-3">
          <div>
            <h3 className="font-600 text-foreground text-sm leading-tight">{project.name}</h3>
            {project.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {project.address}
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{project.progress}%</span>
              {daysLeft !== null && (
                <span className={cn('flex items-center gap-1', daysLeft < 0 && 'text-destructive', daysLeft < 7 && daysLeft >= 0 && 'text-yellow-500')}>
                  <Calendar className="h-3 w-3" />
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}j de retard` : `${daysLeft}j restants`}
                </span>
              )}
            </div>
            <Progress value={project.progress} className="h-1.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
