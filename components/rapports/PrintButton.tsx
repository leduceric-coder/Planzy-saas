'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PrintButton() {
  return (
    <Button size="sm" variant="outline" aria-label="Imprimer la page" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      <span className="hidden sm:inline">Imprimer</span>
    </Button>
  )
}
