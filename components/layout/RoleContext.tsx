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

// ── Périmètre artisan (LOT 42E1C) ────────────────────────────────────────────
// Contexte distinct de RoleContext pour ne pas changer la signature de
// useRole(). Alimenté une seule fois par le layout dashboard, et uniquement
// pour un artisan : les rôles internes n'en ont pas besoin.
// `assignedTaskIds` = tâches réellement affectées (ATA active ∪ assigned_to),
// c'est-à-dire exactement la règle d'écriture de la RLS 42E1B — à ne pas
// confondre avec les tâches simplement visibles.

type ArtisanScope = { artisanId: string | null; assignedTaskIds: string[] }

const ArtisanScopeContext = createContext<ArtisanScope>({ artisanId: null, assignedTaskIds: [] })

export function ArtisanScopeProvider({ artisanId, assignedTaskIds, children }: ArtisanScope & { children: React.ReactNode }) {
  return (
    <ArtisanScopeContext.Provider value={{ artisanId: artisanId ?? null, assignedTaskIds: assignedTaskIds ?? [] }}>
      {children}
    </ArtisanScopeContext.Provider>
  )
}

export function useArtisanScope(): ArtisanScope {
  return useContext(ArtisanScopeContext)
}
