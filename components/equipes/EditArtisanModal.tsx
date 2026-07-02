'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'
import { SlidePanel } from '@/components/ui/SlidePanel'

const PALETTE = [
  '#2563EB', '#16A34A', '#DC2626', '#D97706',
  '#7C3AED', '#0891B2', '#DB2777', '#65A30D',
]

const TRADES = [
  'Maçon', 'Électricien', 'Plombier', 'Charpentier', 'Menuisier',
  'Peintre', 'Carreleur', 'Couvreur', 'Plaquiste', 'Chauffagiste',
  'Serrurier', 'Vitrier', 'Paysagiste', 'Terrassier', 'Autre',
]

interface ArtisanData {
  id: string
  org_id: string
  full_name: string | null
  trade: string | null
  phone: string | null
  email: string | null
  color: string | null
}

interface Props {
  artisan: ArtisanData
  onClose: () => void
}

export function EditArtisanModal({ artisan, onClose }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState(artisan.full_name ?? '')
  const [color, setColor] = useState(artisan.color ?? PALETTE[0])

  const initialTrade = artisan.trade ?? ''
  const isKnownTrade = TRADES.includes(initialTrade)
  const [trade, setTrade] = useState(isKnownTrade ? initialTrade : 'Autre')
  const [customTrade, setCustomTrade] = useState(isKnownTrade ? '' : initialTrade)

  const [phone, setPhone] = useState(artisan.phone ?? '')
  const [email, setEmail] = useState(artisan.email ?? '')

  const effectiveTrade = trade === 'Autre' ? customTrade.trim() : trade

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Le nom est obligatoire'); return }
    if (!effectiveTrade) { setError('Le métier est obligatoire'); return }
    setLoading(true)
    setError(null)

    const { error: err } = await mutationClient()
      .from('artisans')
      .update({
        full_name: fullName.trim(),
        trade: effectiveTrade,
        phone: phone.trim() || null,
        email: email.trim() || null,
        color,
      })
      .eq('id', artisan.id)
      .eq('org_id', artisan.org_id)

    if (err) { setError(err.message); setLoading(false); return }
    toast('Artisan mis à jour')
    router.refresh()
    onClose()
  }

  return (
    <SlidePanel onClose={onClose} title="Modifier l'artisan">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Nom */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Nom <span className="text-destructive">*</span>
          </label>
          <Input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="h-10"
            autoFocus
          />
        </div>

        {/* Métier */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Métier <span className="text-destructive">*</span>
          </label>
          <select
            value={trade}
            onChange={e => setTrade(e.target.value)}
            className="flex w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="">— Sélectionner —</option>
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {trade === 'Autre' && (
            <Input
              placeholder="Préciser le métier"
              value={customTrade}
              onChange={e => setCustomTrade(e.target.value)}
              className="h-10"
            />
          )}
        </div>

        {/* Téléphone */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Téléphone <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <Input
            type="tel"
            placeholder="06 12 34 56 78"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">
            Email <span className="text-muted-foreground font-400">(optionnel)</span>
          </label>
          <Input
            type="email"
            placeholder="artisan@exemple.fr"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Couleur */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-600 text-foreground">Couleur</label>
          <div className="flex gap-2">
            {PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.2)' : undefined,
                  boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </SlidePanel>
  )
}
