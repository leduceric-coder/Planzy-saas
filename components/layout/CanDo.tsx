'use client'

// LOT 42 — garde d'affichage réutilisable (île client) : rend ses enfants
// seulement si le rôle courant autorise l'action. Utilisable même depuis une
// page serveur (frontière client). Défense en profondeur — la RLS reste la
// sécurité réelle.

import { useRole } from '@/components/layout/RoleContext'
import { can, canWrite, type Action } from '@/lib/permissions'

export function CanDo({
  action, children, fallback = null,
}: {
  action?: Action
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const role = useRole()
  const allowed = action ? can(role, action) : canWrite(role)
  return <>{allowed ? children : fallback}</>
}
