'use client'

// ── Feux France — thème clair / sombre ───────────────────────────────────────
// Réutilise la classe `.light` et la clé localStorage « planzy-theme » du reste
// de l'application (le script anti-flash du layout racine s'applique déjà).

import { useCallback, useEffect, useState } from 'react'

const KEY = 'planzy-theme'

export type Theme = 'light' | 'dark'

function resolveInitial(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return document.documentElement.classList.contains('light') ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(resolveInitial())
  }, [])

  const apply = useCallback((next: Theme) => {
    setTheme(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* stockage indisponible — sans conséquence */
    }
    document.documentElement.classList.toggle('light', next === 'light')
  }, [])

  const toggle = useCallback(() => {
    apply(theme === 'light' ? 'dark' : 'light')
  }, [apply, theme])

  return { theme, toggle }
}
