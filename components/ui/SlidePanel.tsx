'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlidePanelProps {
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: string
  backdropZ?: string
  panelZ?: string
}

export function SlidePanel({
  onClose,
  title,
  subtitle,
  children,
  width = 'w-[460px]',
  backdropZ = 'z-[199]',
  panelZ = 'z-[200]',
}: SlidePanelProps) {
  return (
    <>
      <div
        className={cn('fixed inset-0 bg-black/30 backdrop-blur-[2px]', backdropZ)}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 flex flex-col bg-surface border-l border-border shadow-2xl task-panel-enter',
          width, panelZ,
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
          <div>
            <h2 className="font-700 text-foreground">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-elevated transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </>
  )
}
