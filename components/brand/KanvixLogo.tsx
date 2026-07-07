'use client'
import { useState, useEffect } from 'react'

/**
 * Kanvix brand components — assets optimisés (fond transparent, crop serré).
 *
 * Sources dans /brand/optimized/ :
 *   kanvix-wordmark-light.png  1308×320  — encre navy+bleu, fond transparent
 *   kanvix-wordmark-dark.png   1292×316  — lettres blanches, fond transparent
 *   kanvix-icon-blue.png        975×969  — icône bleue, fond transparent
 *
 * KanvixLogo  — wordmark horizontal, UNE SEULE image rendue à la fois
 * KanvixMark  — icône carrée bleue
 */

// Ratio naturel des wordmarks (≈ 4.09:1)
const WM_RATIO = 320 / 1308

interface LogoProps {
  /** Largeur px ; hauteur calculée automatiquement (ratio 1308:320) */
  width?: number
  /**
   * variant="auto"  (défaut) : suit le thème de l'app (classe .light sur <html> = light, sinon dark)
   * variant="light" : force l'asset couleur (navy+bleu)
   * variant="dark"  : force l'asset blanc (texte blanc, fond transparent)
   */
  variant?: 'auto' | 'light' | 'dark'
  /** @deprecated Utiliser variant="dark" à la place */
  white?: boolean
  className?: string
}

export function KanvixLogo({ width = 130, white = false, variant = 'auto', className }: LogoProps) {
  const height = Math.round(width * WM_RATIO)

  // App dark mode convention: no .light class on <html> = dark mode (default)
  // .light class present = light mode
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const check = () => !document.documentElement.classList.contains('light')
    setIsDark(check())
    const obs = new MutationObserver(() => setIsDark(check()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const showDark = white || variant === 'dark' || (variant !== 'light' && isDark)
  const src = showDark
    ? '/brand/optimized/kanvix-wordmark-dark.png'
    : '/brand/optimized/kanvix-wordmark-light.png'

  return (
    <img
      src={src}
      alt="Kanvix"
      width={width}
      height={height}
      suppressHydrationWarning
      style={{ display: 'block', width, height, flexShrink: 0 }}
      className={className}
    />
  )
}

interface MarkProps {
  size?: number
  className?: string
}

/**
 * Icône compacte — kanvix-icon-blue.png (fond transparent, carré ~1:1)
 * Fonctionne sur tous les fonds (le bleu est dans le PNG).
 */
export function KanvixMark({ size = 32, className }: MarkProps) {
  return (
    <img
      src="/brand/optimized/kanvix-icon-blue.png"
      alt="Kanvix"
      width={size}
      height={size}
      style={{ display: 'block', width: size, height: size, flexShrink: 0 }}
      className={className}
    />
  )
}
