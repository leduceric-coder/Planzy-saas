'use client'

// ── Feux France — recherche géographique (Base Adresse Nationale) ────────────
// Commune, code postal, département, adresse. Au clic : centre la carte sans
// supprimer les détections affichées.

import { useEffect, useRef, useState } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import type { GeocodeResult } from '@/app/api/geocode/route'

type Props = {
  onSelect: (r: GeocodeResult) => void
}

/** Zoom cible selon le type de résultat. */
function zoomFor(type: string): number {
  switch (type) {
    case 'housenumber':
    case 'street':
      return 14
    case 'locality':
    case 'municipality':
      return 11
    default:
      return 9
  }
}

export default function SearchBar({ onSelect }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const abortRef = useRef<AbortController | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as { results?: GeocodeResult[] }
        setResults(data.results ?? [])
        setOpen(true)
        setActive(-1)
      } catch {
        /* recherche annulée ou indisponible */
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const choose = (r: GeocodeResult) => {
    onSelect({ ...r, type: r.type })
    setQ(r.label)
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <label htmlFor="feux-search" className="sr-only">
        Rechercher une commune, un code postal, un département ou une adresse
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="feux-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Rechercher une commune, un département…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="feux-search-list"
          aria-autocomplete="list"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : q ? (
          <button
            type="button"
            onClick={() => {
              setQ('')
              setResults([])
              setOpen(false)
            }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-elevated hover:text-foreground"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && results.length > 0 && (
        <ul
          id="feux-search-list"
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose({ ...r, type: r.type })}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                  i === active ? 'bg-elevated' : ''
                } hover:bg-elevated`}
              >
                <span className="font-medium text-foreground">{r.label}</span>
                {r.context && (
                  <span className="text-xs text-muted-foreground">{r.context}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export { zoomFor }
