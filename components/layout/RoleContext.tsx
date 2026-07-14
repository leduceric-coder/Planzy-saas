'use client'

// LOT 42 — contexte de rôle côté client. Alimenté par le layout dashboard
// (profile.role) via DashboardShell. Permet aux composants clients de masquer
// les actions d'écriture selon la matrice (lib/permissions). Défense en
// profondeur — la RLS reste la sécurité réelle.

import { createContext, useContext } from 'react'
import { asRole, can as canDo, canWrite as canWriteFn, isReadOnly, type Action, type Role } from '@/lib/permissions'

const RoleContext = createContext<Role>('viewer')

export function RoleProvider({ role, children }: { role: string | null | undefined; children: React.ReactNode }) {
  return <RoleContext.Provider value={asRole(role)}>{children}</RoleContext.Provider>
}

export function useRole(): Role {
  return useContext(RoleContext)
}

export function usePermissions() {
  const role = useContext(RoleContext)
  return {
    role,
    can: (action: Action) => canDo(role, action),
    canWrite: canWriteFn(role),
    isReadOnly: isReadOnly(role),
  }
}
