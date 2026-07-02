'use client'

import { createContext, useContext } from 'react'
import type { AlertsSummary } from '@/lib/alerts'

const defaultSummary: AlertsSummary = {
  tasksLate: 0,
  tasksBlocked: 0,
  issuesCritical: 0,
  messagesRecent: 0,
  total: 0,
  items: [],
}

const AlertsContext = createContext<AlertsSummary>(defaultSummary)

export function AlertsProvider({
  value,
  children,
}: {
  value: AlertsSummary
  children: React.ReactNode
}) {
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts() {
  return useContext(AlertsContext)
}
