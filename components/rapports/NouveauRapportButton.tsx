'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GenererRapportModal } from './GenererRapportModal'

interface Props {
  orgId: string
  userId: string
  projects: { id: string; name: string; color: string }[]
}

export function NouveauRapportButton({ orgId, userId, projects }: Props) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setShowModal(true)}>
        <Plus className="h-4 w-4" />
        Générer un rapport
      </Button>
      {showModal && (
        <GenererRapportModal
          orgId={orgId}
          userId={userId}
          projects={projects}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
