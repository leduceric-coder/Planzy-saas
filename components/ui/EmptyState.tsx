import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// LOT 28 — État vide mutualisé (icône + titre + description + action optionnelle).
// Remplace les motifs recopiés dans ChantiersClient, RapportsClient, Dashboard et
// les onglets de la fiche chantier. Trois tailles de rythme vertical.

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /** Rythme vertical : sm (inline dans une carte), md (défaut), lg (page entière). */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const PAD = { sm: 'py-8 gap-2', md: 'py-10 gap-2.5', lg: 'py-20 gap-4' }
const ICON = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-10 w-10' }

export function EmptyState({ icon: Icon, title, description, action, size = 'md', className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-5', PAD[size], className)}>
      <Icon className={cn('text-muted-foreground/25', ICON[size])} />
      <p className="text-sm font-700 text-foreground">{title}</p>
      {description && (
        <p className="text-[12px] text-muted-foreground/60 max-w-xs leading-snug">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
