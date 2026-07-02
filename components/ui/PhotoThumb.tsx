'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveDemoImageSrc } from '@/lib/demo-images'

interface Props {
  src: string | null | undefined
  alt?: string
  caption?: string | null
  imgClassName?: string
  size?: 'sm' | 'lg'
}

export function PhotoThumb({ src, alt = 'Photo chantier', caption, imgClassName, size = 'sm' }: Props) {
  const [error, setError] = useState(false)
  const resolvedSrc = error ? null : resolveDemoImageSrc(src, caption)

  if (resolvedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedSrc}
        alt={alt}
        className={cn('w-full h-full object-cover', imgClassName)}
        loading="lazy"
        onError={() => setError(true)}
      />
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
      <Camera className={cn(
        'text-slate-400 dark:text-slate-500',
        size === 'lg' ? 'h-8 w-8' : 'h-5 w-5',
      )} />
      <span className={cn(
        'font-500 text-slate-400 dark:text-slate-500',
        size === 'lg' ? 'text-xs' : 'text-[9px]',
      )}>
        Photo terrain
      </span>
    </div>
  )
}
