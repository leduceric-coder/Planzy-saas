'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: React.ReactNode
  delay?: number
  className?: string
}

export function Tooltip({ content, children, delay = 150, className }: TooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const show = useCallback(() => {
    timer.current = setTimeout(() => {
      const el = wrapRef.current
      if (!el || !content) return
      const r = el.getBoundingClientRect()
      setPos({ top: r.top + r.height / 2, left: r.right + 8 })
    }, delay)
  }, [delay, content])

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setPos(null)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!content) return <div className={cn('w-full', className)}>{children}</div>

  return (
    <div
      ref={wrapRef}
      className={cn('w-full', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && mounted && createPortal(
        <span
          className="fixed pointer-events-none z-[10000] animate-tooltip-in whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[12px] font-500 bg-surface border border-border/60 text-foreground shadow-lg -translate-y-1/2"
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
        </span>,
        document.body,
      )}
    </div>
  )
}
