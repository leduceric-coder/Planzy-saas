'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { mutationClient } from '@/lib/supabase/mutate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-context'

const PALETTE = [
  '#2563EB', '#16A34A', '#DC2626', '#D97706',
  '#7C3AED', '#0891B2', '#DB2777', '#65A30D',
]

const TRADES = [
  'Maçon', 'Électricien', 'Plombier', 'Charpentier', 'Menuisier',
  'Peintre', 'Carreleur', 'Couvreur', 'Plaquiste', 'Chauffagiste',
  'Serrurier', 'Vitrier', 'Paysagiste', 'Terrassier', 'Autre',
]

export function NouvelArtisanForm({ orgId }: { orgId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [trade, setTrade] = useState('')
  const [customTrade, setCustomTrade] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [color, setColor] = useState(PALETTE[0])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const resolvedTrade = trade === 'Autre' ? customTrade.trim() : trade
    if (!fullName.trim()) { setError('Le nom est obligatoire'); return }
    if (!resolvedTrade) { setError('Le métier est obligatoire'); return }
    setLoading(true)
    setError(null)

    const { error: err } = await mutationClient().from('artisans').insert({
      org_id: orgId,
      full_name: fullName.trim(),
      trade: resolvedTrade,
      phone: phone.trim() || null,
      email: email.trim() || null,
      color,
    })

    if (err) { setError(err.message); setLoading(false); return }
    toast('Artisan ajouté avec succès')
    router.push('/equipes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Nom */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-foreground">
          Nom complet <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="Ex : Jean Dupont"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          className="h-11"
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
          required
          className="flex w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <option value="">— Sélectionner un métier —</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {trade === 'Autre' && (
          <Input
            placeholder="Précisez le métier"
            value={customTrade}
            onChange={e => setCustomTrade(e.target.value)}
            className="h-10 mt-1"
          />
        )}
      </div>

      {/* Téléphone + Email */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Téléphone <span className="text-muted-foreground font-400">(optionnel)</span></label>
          <Input
            type="tel"
            placeholder="06 12 34 56 78"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Email <span className="text-muted-foreground font-400">(optionnel)</span></label>
          <Input
            type="email"
            placeholder="jean@entreprise.fr"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* Couleur */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-600 text-foreground">Couleur identifiant</label>
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

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={loading} className="flex-1">
          {loading ? 'Ajout…' : 'Ajouter l\'artisan'}
        </Button>
        <Link href="/equipes">
          <Button type="button" variant="outline" size="lg">
            Annuler
          </Button>
        </Link>
      </div>
    </form>
  )
}
