'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

type ToastVariant = 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function Toast({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const enter = setTimeout(() => setVisible(true), 10)
    const exit = setTimeout(() => setVisible(false), 2700)
    const remove = setTimeout(() => onRemove(item.id), 3100)
    return () => { clearTimeout(enter); clearTimeout(exit); clearTimeout(remove) }
  }, [item.id, onRemove])

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => onRemove(item.id), 300)
  }

  const isSuccess = item.variant !== 'error'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-500 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${
        isSuccess
          ? 'bg-surface border-border text-foreground'
          : 'bg-destructive/10 border-destructive/30 text-destructive'
      }`}
      style={{ minWidth: 220, maxWidth: 360 }}
    >
      {isSuccess
        ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-destructive shrink-0" />
      }
      <span className="flex-1 leading-snug">{item.message}</span>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-1">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(prev => [...prev, { id, message, variant }])
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast item={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
