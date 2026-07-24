import type { Metadata, Viewport } from 'next'
import FeuxApp from '@/components/feux/FeuxApp'

export const metadata: Metadata = {
  title: 'Feux France — détections satellites de chaleur',
  description:
    'Visualisez sur une carte interactive les détections satellites récentes de feux actifs et anomalies thermiques en France métropolitaine et en Corse (NASA FIRMS, quasi-temps réel).',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0B0F19',
}

export default function FeuxPage() {
  return <FeuxApp />
}
