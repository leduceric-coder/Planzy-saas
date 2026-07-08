import type { Metadata } from 'next'

// SEO / Open Graph dédiés à la landing publique. La page (`page.tsx`) est un
// composant client (scroll listener) et ne peut donc pas exporter `metadata` :
// ce layout serveur s'en charge pour la route /landing, sans la convertir.

const TITLE = 'Kanvix — Logiciel de pilotage de chantiers BTP'
const DESCRIPTION =
  'Kanvix centralise planning, tâches, réserves, photos, documents et messages ' +
  'terrain pour aider les équipes BTP à piloter leurs chantiers simplement.'
const OG_IMAGE = '/screenshots/dashboard-overview.png'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanvix-saas.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/landing' },
  openGraph: {
    type: 'website',
    siteName: 'Kanvix',
    locale: 'fr_FR',
    url: '/landing',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1400, height: 663, alt: 'Tableau de bord Kanvix' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
