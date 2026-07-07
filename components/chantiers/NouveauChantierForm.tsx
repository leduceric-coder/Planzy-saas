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

export function NouveauChantierForm({ orgId }: { orgId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PALETTE[0])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom du chantier est obligatoire'); return }
    if (startDate && endDate && endDate < startDate) {
      setError('La date de fin ne peut pas être antérieure à la date de début')
      return
    }
    setLoading(true)
    setError(null)

    const fullAddress = [address.trim(), city.trim()].filter(Boolean).join(', ') || null

    const { data, error: err } = await mutationClient()
      .from('projects')
      .insert({
        org_id: orgId,
        name: name.trim(),
        address: fullAddress,
        start_date: startDate || null,
        end_date: endDate || null,
        description: description.trim() || null,
        status: 'active',
        color,
        progress: 0,
      })
      .select('id')
      .single()

    if (err) { setError(err.message); setLoading(false); return }
    toast('Chantier créé avec succès')
    router.push(`/chantiers/${data!.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Nom */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-foreground">
          Nom du chantier <span className="text-destructive">*</span>
        </label>
        <Input
          placeholder="Ex : Rénovation appartement Rue de la Paix"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="h-11"
          autoFocus
        />
      </div>

      {/* Adresse + Ville */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Adresse</label>
          <Input
            placeholder="12 rue de la Paix"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Ville</label>
          <Input
            placeholder="Paris"
            value={city}
            onChange={e => setCity(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Date de début</label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-600 text-foreground">Date de fin prévisionnelle</label>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-600 text-foreground">Description <span className="text-muted-foreground font-400">(optionnel)</span></label>
        <textarea
          placeholder="Détails du chantier, contexte, contraintes particulières…"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
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

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={loading} className="flex-1">
          {loading ? 'Création…' : 'Créer le chantier'}
        </Button>
        <Link href="/chantiers">
          <Button type="button" variant="outline" size="lg">
            Annuler
          </Button>
        </Link>
      </div>
    </form>
  )
}
