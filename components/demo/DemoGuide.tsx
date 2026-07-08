'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronLeft, ChevronRight, Play, RotateCcw,
  LayoutDashboard, Building2, ClipboardList, Calendar, Users, FileText, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const COACH_KEY = 'planzy-demo-coach-shown'
// LOT 38 — masquage persistant du bouton flottant « Visite guidée ».
const GUIDE_DISMISS_KEY = 'kanvix-guide-dismissed'

interface Step {
  route: string
  icon: React.ReactNode
  label: string
  title: string
  text: string
  nextLabel: string
  demoTarget?: string
  highlightClass?: 'demo-target-highlight' | 'demo-target-highlight-warning'
  action?: 'open-messages'
}

const STEPS: Step[] = [
  {
    route: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
    label: 'Dashboard',
    title: 'Vue globale du jour',
    text: "Kanvix commence par ce qui compte aujourd'hui : les urgences, le planning, les messages et les validations terrain.",
    nextLabel: 'Aller aux chantiers',
    demoTarget: 'dashboard-today-focus',
    highlightClass: 'demo-target-highlight',
  },
  {
    route: '/chantiers',
    icon: <Building2 className="h-4 w-4" />,
    label: 'Chantiers',
    title: 'Repérer les chantiers à risque',
    text: "Chaque chantier a sa carte. Repérez les risques, réserves et retards en un coup d'œil. La section ci-dessous liste les chantiers qui nécessitent une intervention.",
    nextLabel: 'Choisir un chantier',
    demoTarget: 'chantiers-a-surveiller',
    highlightClass: 'demo-target-highlight-warning',
  },
  {
    route: '/chantiers',
    icon: <ClipboardList className="h-4 w-4" />,
    label: 'Fiche chantier',
    title: 'Comprendre un chantier en détail',
    text: "Cliquez sur une carte chantier pour accéder à sa fiche. Tâches, réserves, équipe, documents et échanges sont regroupés en un seul endroit.",
    nextLabel: 'Voir le planning',
  },
  {
    route: '/planning',
    icon: <Calendar className="h-4 w-4" />,
    label: 'Planning',
    title: 'Visualiser les retards et conflits',
    text: "Le planning permet de repérer les retards, blocages et chevauchements. Cliquez sur le bouton \"Alertes planning\" (en haut à droite du Gantt) pour analyser les conflits en détail.",
    nextLabel: 'Voir la messagerie',
    demoTarget: 'planning-alerts-button',
    highlightClass: 'demo-target-highlight-warning',
  },
  {
    route: '/',
    icon: <MessageSquare className="h-4 w-4" />,
    label: 'Messagerie',
    title: 'Communiquer sans perdre le contexte',
    text: "La messagerie s'ouvre en panneau latéral, directement dans l'interface. Échangez par chantier sans quitter votre contexte de travail.",
    nextLabel: 'Ouvrir la messagerie',
    demoTarget: 'sidebar-messages-button',
    highlightClass: 'demo-target-highlight',
    action: 'open-messages' as const,
  },
  {
    route: '/equipes',
    icon: <Users className="h-4 w-4" />,
    label: 'Équipes',
    title: 'Savoir qui intervient et où',
    text: "On sait qui est affecté, qui est disponible, et où il y a un conflit. Cette vue évite les oublis d'affectation et les doubles réservations.",
    nextLabel: 'Voir les documents',
  },
  {
    route: '/documents',
    icon: <FileText className="h-4 w-4" />,
    label: 'Preuves & rapports',
    title: 'Centraliser les preuves et sortir une synthèse',
    text: "Les photos, documents et validations sont centralisés par chantier. La page Rapports & alertes prépare une synthèse claire des points à surveiller.",
    nextLabel: 'Terminer la visite',
  },
]

type DragPos = { top: number; left: number } | null

interface DemoGuideProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onOpenMessages?: () => void
}

export function DemoGuide({ isOpen, onOpen, onClose, onOpenMessages }: DemoGuideProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [showCoach, setShowCoach] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Drag
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<DragPos>(null)
  const [dragging, setDragging] = useState(false)
  const dragOrigin = useRef<{ mouseX: number; mouseY: number; cardLeft: number; cardTop: number } | null>(null)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      if (!sessionStorage.getItem(COACH_KEY)) setShowCoach(true)
      if (localStorage.getItem(GUIDE_DISMISS_KEY) === 'true') setDismissed(true)
    }
  }, [])

  const dismissGuide = useCallback(() => {
    setDismissed(true)
    setShowCoach(false)
    if (typeof window !== 'undefined') localStorage.setItem(GUIDE_DISMISS_KEY, 'true')
  }, [])

  // Apply / remove highlight on step or open state change
  useEffect(() => {
    const removeAll = () => {
      document.querySelectorAll('[data-demo-target]').forEach(el => {
        el.classList.remove('demo-target-highlight', 'demo-target-highlight-warning')
      })
    }

    if (!isOpen) { removeAll(); return }

    removeAll()
    const current = STEPS[step]
    if (!current.demoTarget || !current.highlightClass) return

    // Delay: let route change + render complete
    const tid = setTimeout(() => {
      const target = document.querySelector(`[data-demo-target="${current.demoTarget}"]`)
      if (target) {
        target.classList.add(current.highlightClass!)
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 700)
    return () => clearTimeout(tid)
  }, [isOpen, step])

  // Drag: track mouse while dragging
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      if (!dragOrigin.current || !cardRef.current) return
      const dx = e.clientX - dragOrigin.current.mouseX
      const dy = e.clientY - dragOrigin.current.mouseY
      const w = cardRef.current.offsetWidth
      const h = cardRef.current.offsetHeight
      setPos({
        left: Math.max(8, Math.min(dragOrigin.current.cardLeft + dx, window.innerWidth  - w - 8)),
        top:  Math.max(8, Math.min(dragOrigin.current.cardTop  + dy, window.innerHeight - h - 8)),
      })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [dragging])

  const current    = STEPS[step]
  const isLast     = step === STEPS.length - 1
  const totalSteps = STEPS.length

  const handleLaunch = useCallback(() => {
    setStep(0)
    setPos(null)
    router.push(STEPS[0].route)
    onOpen()
    setShowCoach(false)
    if (typeof window !== 'undefined') sessionStorage.setItem(COACH_KEY, 'true')
  }, [router, onOpen])

  const handleNext = useCallback(() => {
    if (isLast) { onClose(); return }
    const cur = STEPS[step]
    if (cur.action === 'open-messages') onOpenMessages?.()
    const next = STEPS[step + 1]
    if (next.route) router.push(next.route)
    setStep(s => s + 1)
  }, [isLast, step, router, onClose, onOpenMessages])

  const handlePrev = useCallback(() => {
    if (step === 0) return
    const prev = STEPS[step - 1]
    if (prev.route) router.push(prev.route)
    setStep(s => s - 1)
  }, [step, router])

  const handleSkip = useCallback(() => { onClose() }, [onClose])

  const dismissCoach = useCallback(() => {
    setShowCoach(false)
    if (typeof window !== 'undefined') sessionStorage.setItem(COACH_KEY, 'true')
  }, [])

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Disable drag on mobile / narrow viewport
    if (window.innerWidth < 640) return
    // Don't drag when clicking action buttons
    if ((e.target as HTMLElement).closest('button')) return
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    dragOrigin.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      cardLeft: rect.left,
      cardTop:  rect.top,
    }
    setDragging(true)
    e.preventDefault()
  }, [])

  // Keyboard: Escape → close
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleSkip() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleSkip])

  if (!mounted) return null

  // ── Closed: floating trigger + optional coachmark ──────────────────────
  if (!isOpen) {
    // LOT 38 — masqué durablement si l'utilisateur a fermé le bouton.
    if (dismissed) return null
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 40 }}>
        {/* Coachmark bubble */}
        {showCoach && (
          <div className="absolute bottom-full right-0 mb-2.5 w-[210px] bg-primary text-white text-[12px] font-500 px-3.5 py-2.5 rounded-xl shadow-lg leading-snug">
            <button
              onClick={dismissCoach}
              aria-label="Fermer"
              className="absolute top-1.5 right-1.5 p-0.5 rounded text-white/60 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
            <span className="pr-4 block">Nouveau : découvrez Kanvix en 2 minutes</span>
            {/* Tail */}
            <span
              aria-hidden
              className="absolute -bottom-1.5 right-6 w-3 h-3 bg-primary rotate-45 rounded-sm block"
            />
          </div>
        )}

        {/* Launch button + petite croix de fermeture (masquage persistant) */}
        <div className="relative">
          <button
            onClick={handleLaunch}
            aria-label="Lancer la visite guidée"
            className={cn(
              'flex items-center gap-2 px-4 py-2.5',
              'bg-primary text-white text-[12px] font-600',
              'rounded-full shadow-md',
              'hover:bg-primary/90 hover:shadow-lg',
              'transition-all duration-200',
              'demo-launch-pulse',
            )}
          >
            <Play className="h-3.5 w-3.5 fill-white" />
            Visite guidée (2 min)
          </button>
          <button
            onClick={dismissGuide}
            aria-label="Masquer la visite guidée"
            title="Masquer"
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 shadow flex items-center justify-center transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  // ── Open: guide card ───────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.top, left: pos.left, zIndex: 50, width: 380, maxWidth: 'calc(100vw - 24px)' }
    : { position: 'fixed', bottom: 24,   right: 24,      zIndex: 50, width: 380, maxWidth: 'calc(100vw - 24px)' }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Visite guidée — étape ${step + 1} sur ${totalSteps}`}
      style={cardStyle}
      className="bg-surface border border-border/60 rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
    >
      {/* Header — drag zone */}
      <div
        onMouseDown={handleHeaderMouseDown}
        className={cn(
          'flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-background/40',
          'select-none sm:cursor-grab',
          dragging && 'sm:cursor-grabbing',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-700 uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            {step + 1} / {totalSteps}
          </span>
          <span className="text-[11px] font-500 text-muted-foreground">{current.label}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {pos && (
            <button
              onClick={() => setPos(null)}
              aria-label="Réinitialiser la position"
              title="Réinitialiser la position"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleSkip}
            aria-label="Fermer le guide"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1 rounded-full transition-all duration-300',
              i === step   ? 'w-6 bg-primary'
              : i < step   ? 'w-3 bg-primary/35'
                           : 'w-3 bg-border',
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-muted-foreground shrink-0">{current.icon}</span>
          <h3 className="text-[14px] font-700 text-foreground leading-tight">{current.title}</h3>
        </div>
        <p className="text-[13px] text-muted-foreground leading-relaxed">{current.text}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 pb-4 pt-1 gap-3">
        <button
          onClick={handleSkip}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Passer
        </button>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={handlePrev}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5',
                'text-[12px] font-500 text-muted-foreground',
                'border border-border/50 hover:border-border',
                'rounded-lg transition-colors hover:text-foreground',
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Préc.
            </button>
          )}
          <button
            onClick={handleNext}
            className={cn(
              'flex items-center gap-1 px-4 py-1.5',
              'text-[12px] font-600 text-white',
              'bg-primary hover:bg-primary/90',
              'rounded-lg transition-colors shadow-sm',
            )}
          >
            {isLast ? 'Terminer la visite' : current.nextLabel}
            {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
