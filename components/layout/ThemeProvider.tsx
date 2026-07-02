'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void  // backward compat: cycles dark ↔ light
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
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
  const [theme, setThemeState] = useState<Theme>('dark')

  // Read stored theme on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('planzy-theme') as Theme | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored)
      }
    } catch {}
  }, [])

  // Apply theme and persist whenever it changes
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('planzy-theme', theme) } catch {}
  }, [theme])

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
