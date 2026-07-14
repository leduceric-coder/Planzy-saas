'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GenererRapportModal } from './GenererRapportModal'
import { useRole } from '@/components/layout/RoleContext'
import { can } from '@/lib/permissions'

interface Props {
  orgId: string
  userId: string
  projects: { id: string; name: string; color: string }[]
}

export function NouveauRapportButton({ orgId, userId, projects }: Props) {
  const role = useRole()
  const [showModal, setShowModal] = useState(false)

  if (!can(role, 'report.create')) return null // LOT 42 — viewer/artisan ne créent pas de rapport

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
