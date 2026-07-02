'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Building2, User, Mail, Phone, Shield, Calendar, Sun, Moon, Monitor } from 'lucide-react'
import { mutationClient } from '@/lib/supabase/mutate'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/toast-context'
import { useTheme, type Theme } from '@/components/layout/ThemeProvider'
import { cn, formatDate } from '@/lib/utils'

interface Props {
  profile: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    phone: string | null
    role: string | null
    org_id: string | null
    created_at: string | null
  } | null
  org: {
    id: string
    name: string
    slug: string
    plan: string | null
  } | null
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Lecteur',
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Gratuit',
  pro: 'Pro',
  team: 'Équipe',
  enterprise: 'Entreprise',
}

export function SettingsClient({ profile, org }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  if (!profile) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-sm">Impossible de charger votre profil.</p>
      </div>
    )
  }

  const initials = (profile.full_name ?? profile.email ?? '?')
    .trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setError('Le nom complet est requis'); return }
    setSaving(true)
    setError(null)

    const { error: err } = await mutationClient()
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id)

    setSaving(false)
    if (err) { setError(err.message); return }
    toast('Profil mis à jour')
    router.refresh()
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 2 Mo')
      return
    }

    setUploadingAvatar(true)
    setError(null)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${profile.id}/${Date.now()}.${ext}`

    const supabase = createClient()
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError(`Erreur upload : ${uploadErr.message}`)
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: updateErr } = await mutationClient()
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    setUploadingAvatar(false)
    if (updateErr) { setError(updateErr.message); return }

    setAvatarUrl(publicUrl)
    toast('Avatar mis à jour')
    router.refresh()
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8 py-6">
      {/* Profile section */}
      <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-6">
        <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
          Mon profil
        </h2>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <Avatar className="h-16 w-16">
              {avatarUrl && <AvatarImage src={avatarUrl} />}
              <AvatarFallback className="text-lg font-700">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar
                ? <span className="text-white text-[10px] font-600">...</span>
                : <Camera className="h-4 w-4 text-white" />
              }
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div>
            <p className="text-sm font-600 text-foreground">{profile.full_name ?? profile.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cliquez sur l'avatar pour le modifier · JPG, PNG, WebP · 2 Mo max
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Full name */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-600 text-foreground">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Nom complet <span className="text-destructive">*</span>
            </label>
            <Input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Votre nom complet"
              className="max-w-sm"
            />
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-600 text-foreground">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Téléphone
            </label>
            <Input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+33 6 00 00 00 00"
              type="tel"
              className="max-w-sm"
            />
          </div>

          {/* Email — read-only */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-600 text-foreground">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </label>
            <div className="flex items-center gap-2 max-w-sm">
              <Input value={profile.email} disabled className="bg-elevated cursor-not-allowed" />
            </div>
            <p className="text-xs text-muted-foreground">L'email n'est pas modifiable pour l'instant.</p>
          </div>

          {/* Role + member since — read-only */}
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-600 text-muted-foreground uppercase tracking-wider">
                <Shield className="h-3 w-3" />
                Rôle
              </label>
              <p className="text-sm font-500 text-foreground px-3 py-2 bg-elevated border border-border rounded-lg">
                {ROLE_LABEL[profile.role ?? ''] ?? profile.role ?? '—'}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-600 text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3 w-3" />
                Membre depuis
              </label>
              <p className="text-sm font-500 text-foreground px-3 py-2 bg-elevated border border-border rounded-lg">
                {profile.created_at ? formatDate(profile.created_at) : '—'}
              </p>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 max-w-sm">
              {error}
            </div>
          )}

          <div className="pt-1">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </Button>
          </div>
        </form>
      </section>

      {/* Organisation section */}
      <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
        <h2 className="text-sm font-700 uppercase tracking-wider text-muted-foreground">
          Organisation
        </h2>

        {org ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-600 text-foreground">{org.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{org.slug}</p>
              </div>
              <span className="ml-auto text-xs font-600 px-2.5 py-1 rounded-lg bg-primary/10 text-primary">
                {PLAN_LABEL[org.plan ?? ''] ?? org.plan ?? 'Gratuit'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground border-t border-border pt-4">
              <div>
                <span className="font-600 text-foreground block mb-0.5">Votre rôle</span>
                {ROLE_LABEL[profile.role ?? ''] ?? profile.role ?? '—'}
              </div>
              <div>
                <span className="font-600 text-foreground block mb-0.5">Identifiant</span>
                {org.slug}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune organisation associée.</p>
        )}
      </section>

      {/* Apparence */}
      <section className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-700 text-foreground">Apparence</h2>
        </div>
        <div className="flex gap-3">
          {([
            { value: 'light'  as Theme, label: 'Clair',   Icon: Sun     },
            { value: 'dark'   as Theme, label: 'Sombre',  Icon: Moon    },
            { value: 'system' as Theme, label: 'Système', Icon: Monitor },
          ] as const).map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-2 py-3.5 rounded-xl border text-sm font-600 transition-all',
                theme === value
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground bg-background hover:border-primary/40',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {theme === 'system' ? 'Suit automatiquement les préférences de votre système.' : theme === 'light' ? 'Thème clair appliqué.' : 'Thème sombre appliqué.'}
        </p>
      </section>
    </div>
  )
}
