'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { KanvixMark, KanvixLogo } from '@/components/brand/KanvixLogo'
import {
  Zap, UserCog, FolderOpen, AlertTriangle, Clock,
  WifiOff, HardHat, Wrench, ClipboardList, Home, BarChart3,
  Layers, Play, ArrowRight, CheckCircle, Flag,
  ChevronDown, Camera,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Palette ─────────────────────────────────────────────────────────────────
const P = {
  blue:       '#2563EB',
  blueDark:   '#1D4ED8',
  blueLight:  '#EFF6FF',
  blueBorder: '#93C5FD',
  slate900:   '#0F172A',
  slate700:   '#334155',
  slate500:   '#64748B',
  slate400:   '#94A3B8',
  slate200:   '#E2E8F0',
  slate100:   '#F1F5F9',
  slate50:    '#F8FAFC',
  white:      '#ffffff',
  amber:      '#F59E0B',
  red:        '#EF4444',
  green:      '#22C55E',
  teal:       '#0891B2',
  purple:     '#7C3AED',
  emerald:    '#059669',
  orange:     '#F97316',
}

// ── Cadre navigateur minimaliste ─────────────────────────────────────────────
function BrowserFrame({ children, url = 'kanvix.app' }: { children: ReactNode; url?: string }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', border: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ height: 36, background: '#EDEDED', display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderBottom: '1px solid #D8D8D8' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E', display: 'inline-block' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840', display: 'inline-block' }} />
        <div style={{ flex: 1, height: 20, background: '#fff', borderRadius: 5, margin: '0 12px', display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759', opacity: 0.8 }} />
          <span style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{url}</span>
        </div>
      </div>
      {children}
    </div>
  )
}

// ── Point de liste feature ────────────────────────────────────────────────────
function FeatureBullet({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 7 }} />
      <span style={{ fontSize: 14, color: P.slate700, lineHeight: 1.5 }}>{label}</span>
    </div>
  )
}

// ── Screenshot avec ombre ─────────────────────────────────────────────────────
function ScreenShot({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: `1px solid ${P.slate200}` }}>
      <img src={src} alt={alt} width={width} height={height} style={{ display: 'block', width: '100%', height: 'auto' }} />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: P.slate50, color: P.slate900 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className={cn('fixed top-0 inset-x-0 z-50 transition-all duration-200')}
        style={scrolled
          ? { background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${P.slate200}`, boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }
          : { background: 'transparent' }
        }
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/landing">
            <KanvixLogo width={120} />
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {[['#fonctionnalites','Fonctionnalités'],['#terrain','Terrain'],['#demo','Démo']].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 14, color: P.slate500, fontWeight: 500 }} className="hover:text-slate-900 transition-colors">{label}</a>
            ))}
            <Link href="/login" style={{ fontSize: 14, color: P.slate500, fontWeight: 500 }} className="hover:text-slate-900 transition-colors">Se connecter</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="hidden sm:flex items-center px-4 py-2 rounded-xl text-sm transition-all hover:bg-white"
              style={{ background: 'transparent', border: `1.5px solid ${P.slate200}`, color: P.slate700, fontWeight: 600 }}
            >
              Créer un compte
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm transition-all hover:opacity-90"
              style={{ background: P.blue, fontWeight: 600, boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              Voir la démo
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ paddingTop: 112, paddingBottom: 80 }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(145deg, #EFF6FF 0%, #F8FAFC 55%, #F8FAFC 100%)' }} />
        <div aria-hidden className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 65%)' }} />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Texte */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-7" style={{ background: P.blueLight, border: `1px solid ${P.blueBorder}`, color: P.blue, fontWeight: 600 }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: P.blue }} />
                Solution de pilotage de chantier BTP
              </div>

              <h1 style={{ fontSize: 'clamp(34px, 4.5vw, 54px)', fontWeight: 800, color: P.slate900, lineHeight: 1.08, letterSpacing: -1, marginBottom: 24 }}>
                Fini les retards<br />
                <span style={{ color: P.blue }}>qu'on voit trop tard.</span>
              </h1>

              <p style={{ fontSize: 18, color: P.slate500, lineHeight: 1.65, marginBottom: 36, maxWidth: 480 }}>
                Kanvix centralise le planning, les équipes, la messagerie terrain et les réserves dans une interface claire. Pensé pour le conducteur de travaux, pas pour les administratifs.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl text-white transition-all hover:opacity-92 hover:scale-[1.02]"
                  style={{ background: P.blue, fontWeight: 700, fontSize: 15, boxShadow: '0 6px 20px rgba(37,99,235,0.35)' }}
                >
                  <Play className="h-4 w-4 fill-white" />
                  Voir la démo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#fonctionnalites"
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl transition-all hover:border-blue-300 hover:bg-white"
                  style={{ background: P.white, border: `1.5px solid ${P.slate200}`, color: P.slate700, fontWeight: 600, fontSize: 15 }}
                >
                  Fonctionnalités
                  <ChevronDown className="h-4 w-4" style={{ color: P.slate400 }} />
                </a>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-8" style={{ borderTop: `1px solid ${P.slate200}` }}>
                {['Données DEMO préchargées', 'Visite guidée incluse', 'Sans carte bancaire'].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0" style={{ color: P.green }} />
                    <span style={{ fontSize: 13, color: P.slate500, fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshot produit */}
            <div className="relative">
              {/* Desktop — 3D tilt + cadre navigateur */}
              <div className="hidden lg:block" style={{ transform: 'perspective(1200px) rotateY(-6deg) rotateX(2deg)', transformOrigin: '60% center', filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.16))' }}>
                <BrowserFrame url="kanvix.app/dashboard">
                  <img
                    src="/screenshots/dashboard-overview.png"
                    alt="Dashboard Kanvix — tableau de bord"
                    width={1400}
                    height={663}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                  />
                </BrowserFrame>
              </div>

              {/* Badge retard */}
              <div className="hidden lg:flex" style={{ position: 'absolute', bottom: -18, left: 20, background: P.white, borderRadius: 12, padding: '8px 14px', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', border: `1px solid ${P.slate200}`, alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: '#FEF3C7', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertTriangle style={{ width: 15, height: 15, color: '#D97706' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: P.slate900, lineHeight: 1.2 }}>Retard détecté</div>
                  <div style={{ fontSize: 11, color: P.slate500 }}>Montage charpente · J+3</div>
                </div>
              </div>

              {/* Badge alertes */}
              <div className="hidden lg:flex" style={{ position: 'absolute', top: 36, right: -16, background: P.blue, borderRadius: 12, padding: '8px 14px', boxShadow: '0 8px 24px rgba(37,99,235,0.35)', alignItems: 'center', gap: 7 }}>
                <CheckCircle style={{ width: 13, height: 13, color: '#fff' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>8 alertes planning</span>
              </div>

              {/* Mobile — flat */}
              <div className="lg:hidden rounded-xl overflow-hidden" style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.1)', border: `1px solid ${P.slate200}` }}>
                <img src="/screenshots/dashboard-overview.png" alt="Dashboard Kanvix" width={1400} height={663} style={{ display: 'block', width: '100%', height: 'auto' }} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <div style={{ background: P.white, borderTop: `1px solid ${P.slate200}`, borderBottom: `1px solid ${P.slate200}` }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            {[
              { stat: '5 min',      label: 'pour détecter un retard ou une réserve critique',       icon: Clock,  color: P.blue   },
              { stat: 'Tout en un', label: 'chantiers, planning, photos, messages — une seule vue',  icon: Layers, color: P.purple },
              { stat: '2 min',      label: 'pour parcourir la démo guidée complète',                 icon: Play,   color: P.green  },
            ].map(({ stat, label, icon: Icon, color }) => (
              <div key={stat} className="flex items-center gap-4 px-8 py-7">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}14` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: P.slate900, letterSpacing: -0.5, lineHeight: 1 }}>{stat}</div>
                  <div style={{ fontSize: 12.5, color: P.slate500, marginTop: 3, lineHeight: 1.4 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Problème ────────────────────────────────────────────────────────── */}
      <section style={{ background: P.slate50, padding: '96px 24px' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16" style={{ maxWidth: 560, margin: '0 auto 64px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: P.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Le problème</p>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: P.slate900, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 16 }}>
              Trop d'Excel, trop de WhatsApp,<br />trop d'oublis.
            </h2>
            <p style={{ fontSize: 17, color: P.slate500, lineHeight: 1.6 }}>
              Les informations circulent vite sur un chantier. Mais elles se perdent encore plus vite — entre les mails, les groupes WhatsApp et les tableaux Excel.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                Icon: Layers,
                title: 'Informations dispersées',
                text: "Plans dans les mails, photos dans WhatsApp, tâches dans Excel. Personne n'a jamais la même version.",
                iconColor: P.red, iconBg: '#FEF2F2',
                quote: '"Tu as le dernier plan ? Je retrouve plus la bonne version."',
              },
              {
                Icon: Clock,
                title: 'Retards détectés trop tard',
                text: "Un blocage qui traîne 3 jours coûte une semaine de chantier. Sans visibilité, les problèmes s'accumulent en silence.",
                iconColor: P.amber, iconBg: '#FFFBEB',
                quote: '"On a appris le retard sur la charpente quand les maçons étaient déjà là."',
              },
              {
                Icon: WifiOff,
                title: 'Coordination terrain difficile',
                text: "Artisans non prévenus, affectations oubliées, deux équipes sur le même créneau. La coordination se fait en courant.",
                iconColor: '#8B5CF6', iconBg: '#F5F3FF',
                quote: '"L\'électricien est venu pour rien, la dalle n\'était pas encore coulée."',
              },
            ].map(({ Icon, title, text, iconColor, iconBg, quote }) => (
              <div key={title} className="rounded-2xl overflow-hidden transition-shadow hover:shadow-lg" style={{ border: `1px solid ${P.slate200}`, background: P.white }}>
                <div style={{ padding: '24px 24px 20px' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: iconBg }}>
                    <Icon className="h-5 w-5" style={{ color: iconColor }} />
                  </div>
                  <h3 style={{ fontWeight: 700, color: P.slate900, fontSize: 15, marginBottom: 8 }}>{title}</h3>
                  <p style={{ fontSize: 13.5, color: P.slate500, lineHeight: 1.6 }}>{text}</p>
                </div>
                <div style={{ margin: '0 24px 24px', padding: '12px 14px', background: P.slate50, borderRadius: 10, borderLeft: `3px solid ${iconColor}` }}>
                  <p style={{ fontSize: 12.5, color: P.slate700, fontStyle: 'italic', lineHeight: 1.5 }}>{quote}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités avec captures produit réelles ───────────────────── */}
      <section id="fonctionnalites" style={{ background: P.white }}>

        {/* 1 — Planning Gantt */}
        <div style={{ padding: '88px 24px', borderBottom: `1px solid ${P.slate100}` }}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: P.teal, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 14 }}>Planning Gantt</p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: P.slate900, lineHeight: 1.12, letterSpacing: -0.5, marginBottom: 18 }}>
                Anticipez les retards<br />avant qu'ils coûtent.
              </h2>
              <p style={{ fontSize: 16, color: P.slate500, lineHeight: 1.7, marginBottom: 28 }}>
                Vue Gantt multi-chantiers avec détection automatique des conflits. Chaque tâche bloquée ou en retard déclenche une alerte. Vous savez en 30 secondes ce qui menace votre planning.
              </p>
              <div className="flex flex-col gap-3">
                <FeatureBullet label="8 alertes planning détectées et listées automatiquement" color={P.amber} />
                <FeatureBullet label="Vue globale ou par artisan, semaine / mois" color={P.teal} />
                <FeatureBullet label="Tâches bloquées et retards mis en évidence sur le Gantt" color={P.red} />
              </div>
            </div>
            <ScreenShot src="/screenshots/planning-alertes.png" alt="Planning global Kanvix — Gantt alertes" width={1400} height={718} />
          </div>
        </div>

        {/* 2 — Fiche chantier */}
        <div style={{ padding: '88px 24px', borderBottom: `1px solid ${P.slate100}`, background: P.slate50 }}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <div className="order-2 lg:order-1">
              <ScreenShot src="/screenshots/fiche-chantier.png" alt="Fiche chantier Kanvix — vue d'ensemble" width={1400} height={777} />
            </div>
            <div className="order-1 lg:order-2">
              <p style={{ fontSize: 11, fontWeight: 700, color: P.purple, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 14 }}>Fiche chantier</p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: P.slate900, lineHeight: 1.12, letterSpacing: -0.5, marginBottom: 18 }}>
                Tout sur un chantier,<br />en un seul endroit.
              </h2>
              <p style={{ fontSize: 16, color: P.slate500, lineHeight: 1.7, marginBottom: 28 }}>
                Planning, équipes, réserves, documents et messagerie — tous accessibles depuis un seul écran. Avancement en temps réel, tâches prioritaires mises en avant, rien ne passe entre les mailles.
              </p>
              <div className="flex flex-col gap-3">
                <FeatureBullet label="KPIs temps réel : tâches ouvertes, retards, réserves, prochaine échéance" color={P.purple} />
                <FeatureBullet label='"À traiter maintenant" — les urgences toujours visibles en premier' color={P.red} />
                <FeatureBullet label="Onglets Planning, Équipes, Photos & docs, Messagerie, Réserves" color={P.blue} />
              </div>
            </div>
          </div>
        </div>

        {/* 3 — Messagerie contextuelle */}
        <div style={{ padding: '88px 24px', borderBottom: `1px solid ${P.slate100}` }}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 14 }}>Messagerie terrain</p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: P.slate900, lineHeight: 1.12, letterSpacing: -0.5, marginBottom: 18 }}>
                Plus de WhatsApp.<br />Une messagerie qui<br />sait de quoi vous parlez.
              </h2>
              <p style={{ fontSize: 16, color: P.slate500, lineHeight: 1.7, marginBottom: 28 }}>
                Chaque échange est rattaché au chantier concerné. Tâche terminée, livraison absente, décision prise — le type du message est explicite. Rien ne se perd, tout est retrouvable.
              </p>
              <div className="flex flex-col gap-3">
                <FeatureBullet label="Messagerie contextuelle par chantier — pas un groupe WhatsApp de plus" color="#D97706" />
                <FeatureBullet label="Types structurés : TÂCHE TERMINÉE, DÉCISION, LIVRAISON ABSENTE, CONSIGNE" color={P.blue} />
                <FeatureBullet label="Panneau latéral — restez dans votre contexte de travail" color={P.emerald} />
              </div>
            </div>
            {/* Messagerie est portrait → on la contraint en largeur */}
            <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
              <ScreenShot src="/screenshots/messagerie.png" alt="Messagerie contextuelle Kanvix" width={767} height={911} />
            </div>
          </div>
        </div>

        {/* 4 — Équipes & terrain */}
        <div style={{ padding: '88px 24px', background: P.slate50 }}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
            <div className="order-2 lg:order-1">
              <ScreenShot src="/screenshots/equipes.png" alt="Équipes & terrain Kanvix — disponibilités artisans" width={1400} height={605} />
            </div>
            <div className="order-1 lg:order-2">
              <p style={{ fontSize: 11, fontWeight: 700, color: P.blue, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 14 }}>Équipes & terrain</p>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: P.slate900, lineHeight: 1.12, letterSpacing: -0.5, marginBottom: 18 }}>
                Qui est disponible,<br />qui est en conflit.
              </h2>
              <p style={{ fontSize: 16, color: P.slate500, lineHeight: 1.7, marginBottom: 28 }}>
                Disponibilités et affectations de vos artisans en temps réel. Les conflits sont détectés automatiquement. Plus d'équipe qui se retrouve sur le même créneau sans le savoir.
              </p>
              <div className="flex flex-col gap-3">
                <FeatureBullet label="Disponibilités en temps réel pour chaque artisan" color={P.green} />
                <FeatureBullet label="Conflits d'affectation détectés et remontés automatiquement" color={P.red} />
                <FeatureBullet label="Tâche bloquée sans intervenant — signalement immédiat" color={P.amber} />
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── Preuves terrain ─────────────────────────────────────────────────── */}
      <section id="terrain" style={{ background: '#0B1120', padding: '96px 24px' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 14 }}>Documents & photos</p>
              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, color: P.white, lineHeight: 1.12, letterSpacing: -0.5, marginBottom: 20 }}>
                Les preuves terrain,<br />centralisées.
              </h2>
              <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.7, marginBottom: 36 }}>
                Photos, réserves et documents classés par chantier. Fissures, malfaçons, livraisons — tout est daté et accessible en un clic pour les réunions ou les recours.
              </p>

              <div className="flex flex-col gap-5">
                {[
                  { icon: Camera,     label: 'Photos terrain datées et classées',       sub: 'Accessibles par chantier en un clic' },
                  { icon: Flag,       label: 'Réserves photographiées et tracées',      sub: 'Ouverture, suivi, résolution — tout est historisé' },
                  { icon: FolderOpen, label: 'Documents centralisés par chantier',      sub: 'Plans, CCTP, PV — plus de pièces jointes dans les mails' },
                ].map(({ icon: Icon, label, sub }) => (
                  <div key={label} className="flex items-start gap-4">
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 17, height: 17, color: '#60A5FA' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: P.white, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, color: '#475569' }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <img
                src="/screenshots/documents-photos.png"
                alt="Documents & photos terrain Kanvix — réserves et preuves chantier"
                width={1400}
                height={741}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>

          </div>
        </div>
      </section>

      {/* ── Démo guidée 2 min ───────────────────────────────────────────────── */}
      <section id="demo" style={{ background: P.slate900, padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-7" style={{ background: 'rgba(37,99,235,0.2)', border: '1px solid rgba(37,99,235,0.3)', color: '#93C5FD', fontWeight: 600 }}>
                <Play className="h-3 w-3" style={{ fill: '#93C5FD' }} />
                Démo interactive disponible
              </div>

              <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800, color: P.white, lineHeight: 1.12, letterSpacing: -0.5, marginBottom: 20 }}>
                Découvrez Kanvix<br />
                <span style={{ color: '#93C5FD' }}>en 2 minutes chrono.</span>
              </h2>

              <p style={{ fontSize: 16, color: '#94A3B8', lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
                Un jeu de données réaliste vous attend : chantiers à risque, planning avec alertes, messagerie terrain, photos de réserves. Rien à configurer, connexion immédiate.
              </p>

              <div className="flex flex-col gap-3 mb-10">
                {[
                  { num: '1', label: 'Tableau de bord',  sub: 'Urgences et alertes du jour'       },
                  { num: '2', label: 'Fiche chantier',   sub: 'Villa Les Pins — tout en détail'   },
                  { num: '3', label: 'Planning Gantt',   sub: 'Retards et alertes multi-chantiers'},
                  { num: '4', label: 'Messagerie',       sub: 'Échanges terrain contextuels'      },
                  { num: '5', label: 'Équipes',          sub: 'Affectations et disponibilités'    },
                ].map(({ num, label, sub }) => (
                  <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#60A5FA', fontFamily: 'monospace' }}>{num}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: P.white }}>{label}</span>
                    <span style={{ fontSize: 12, color: '#475569' }}>— {sub}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: P.blue, fontWeight: 700, fontSize: 15, boxShadow: '0 8px 28px rgba(37,99,235,0.4)' }}
              >
                <Play className="h-4 w-4 fill-white" />
                Accéder à la démo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="hidden lg:flex flex-col gap-5">
              <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <img
                  src="/screenshots/visite-guidee.png"
                  alt="Visite guidée Kanvix — panneau d'alertes en temps réel"
                  width={627}
                  height={497}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Zap style={{ width: 16, height: 16, color: '#FBBF24', flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55 }}>
                  Une fois connecté, le bouton{' '}
                  <span style={{ color: P.white, fontWeight: 600 }}>"Visite guidée (2 min)"</span>{' '}
                  en bas à droite lance le parcours en 7 étapes.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Public cible ────────────────────────────────────────────────────── */}
      <section id="public" style={{ background: P.white, padding: '96px 24px' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16" style={{ maxWidth: 500, margin: '0 auto 56px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: P.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Pour qui</p>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, color: P.slate900, lineHeight: 1.15, letterSpacing: -0.5, marginBottom: 16 }}>
              Pensé pour les pros du BTP
            </h2>
            <p style={{ fontSize: 17, color: P.slate500, lineHeight: 1.6 }}>
              Simple à prendre en main le premier jour, puissant le reste du temps.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { Icon: Wrench,        label: 'Artisans',               sub: 'Suivez vos chantiers en cours, signalez vos avancées.', color: P.orange  },
              { Icon: HardHat,       label: 'Petites entreprises BTP', sub: "Gérez vos équipes terrain et vos sous-traitants.",       color: P.blue    },
              { Icon: ClipboardList, label: 'Conducteurs de travaux', sub: 'Anticipez les retards et coordonnez sans courir.',       color: P.teal    },
              { Icon: UserCog,       label: "Maîtres d'œuvre",        sub: 'Pilotez plusieurs chantiers depuis une seule vue.',      color: P.purple  },
              { Icon: Home,          label: 'Constructeurs',          sub: 'Du terrassement à la livraison, tout est tracé.',       color: P.emerald },
              { Icon: BarChart3,     label: 'Promoteurs',             sub: 'Gardez un œil sur vos programmes en cours.',            color: '#DC2626' },
            ].map(({ Icon, label, sub, color }) => (
              <div key={label} className="rounded-2xl p-5 transition-all hover:shadow-md hover:-translate-y-0.5" style={{ border: `1px solid ${P.slate200}`, background: P.slate50 }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}14` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 style={{ fontWeight: 700, color: P.slate900, fontSize: 14, marginBottom: 5 }}>{label}</h3>
                <p style={{ fontSize: 12.5, color: P.slate500, lineHeight: 1.55 }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────────────── */}
      <section style={{ background: P.blue, padding: '96px 24px', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', top: -60, right: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: P.white, letterSpacing: -0.6, lineHeight: 1.1, marginBottom: 20 }}>
            Prêt à voir vos chantiers<br />autrement ?
          </h2>
          <p style={{ fontSize: 17, color: '#BFDBFE', lineHeight: 1.65, marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
            Accédez à la démo avec un jeu de données réaliste. Aucune installation, aucune carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl transition-all hover:opacity-95 hover:scale-[1.02]"
              style={{ background: P.white, color: P.blue, fontWeight: 700, fontSize: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
            >
              <Play className="h-4 w-4" style={{ fill: P.blue }} />
              Accéder à la démo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl transition-all hover:bg-white/10"
              style={{ background: 'transparent', color: P.white, fontWeight: 700, fontSize: 16, border: '1.5px solid rgba(255,255,255,0.4)' }}
            >
              Créer un compte
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(191,219,254,0.7)', marginTop: 16 }}>
            Connexion immédiate · Données démo préchargées · Visite guidée incluse
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#060D18', padding: '36px 24px' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <KanvixMark size={28} />
            <div>
              <KanvixLogo width={100} white={true} />
              <p style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>Solution de suivi de chantier</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <a href="#fonctionnalites" style={{ fontSize: 13, color: '#475569', fontWeight: 500 }} className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#terrain" style={{ fontSize: 13, color: '#475569', fontWeight: 500 }} className="hover:text-white transition-colors">Terrain</a>
            <a href="#demo" style={{ fontSize: 13, color: '#475569', fontWeight: 500 }} className="hover:text-white transition-colors">Démo</a>
            <Link href="/login" style={{ fontSize: 13, color: '#475569', fontWeight: 500 }} className="hover:text-white transition-colors">Se connecter</Link>
            <Link href="/signup" style={{ fontSize: 13, color: '#475569', fontWeight: 500 }} className="hover:text-white transition-colors">Créer un compte</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
