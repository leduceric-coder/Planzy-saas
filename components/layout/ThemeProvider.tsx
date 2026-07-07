'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void  // backward compat: cycles dark ↔ light
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  setTheme: () => {},
  toggleTheme: () => {},
})

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.add('light')
  } else if (theme === 'dark') {
    root.classList.remove('light')
  } else {
    // system: follow OS preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.remove('light')
    } else {
      root.classList.add('light')
    }
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // LOT 36 — Défaut = 'system' (suit l'OS tant qu'aucun choix explicite n'est
  // enregistré). État initial déterministe 'system' → identique SSR / 1er rendu
  // client (pas de mismatch d'hydratation). Le script anti-flash de layout.tsx a
  // déjà posé la bonne classe avant le paint ; la préférence stockée est lue au
  // montage et appliquée une seule fois (pas de flash).
  const [theme, setThemeState] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  // Read stored theme on mount, apply the resolved theme once.
  useEffect(() => {
    let initial: Theme = 'system'
    try {
      const stored = localStorage.getItem('planzy-theme') as Theme | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') initial = stored
    } catch {}
    setThemeState(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  // Apply + persist only after mount (jamais avec l'état par défaut transitoire) —
  // n'écrase donc pas une préférence existante et évite tout flash au montage.
  useEffect(() => {
    if (!mounted) return
    applyTheme(theme)
    try { localStorage.setItem('planzy-theme', theme) } catch {}
  }, [theme, mounted])

  // Listen to OS preference changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggleTheme = useCallback(() => setThemeState(t => t === 'dark' ? 'light' : 'dark'), [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
