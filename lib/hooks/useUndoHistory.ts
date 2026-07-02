'use client'

import { useRef, useState, useCallback } from 'react'

export interface HistoryAction {
  id: string
  label: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

const MAX_HISTORY = 20

export function useUndoHistory() {
  const undoStackRef = useRef<HistoryAction[]>([])
  const redoStackRef = useRef<HistoryAction[]>([])
  // Bump counter forces re-render so canUndo/canRedo/labels stay fresh after mutations
  const [, setBump] = useState(0)
  const bump = useCallback(() => setBump(n => n + 1), [])

  const push = useCallback((action: HistoryAction) => {
    undoStackRef.current = [...undoStackRef.current, action].slice(-MAX_HISTORY)
    redoStackRef.current = []
    bump()
  }, [bump])

  const handleUndo = useCallback(async (onError?: (err: unknown) => void): Promise<boolean> => {
    const stack = undoStackRef.current
    if (stack.length === 0) return false
    const action = stack[stack.length - 1]
    undoStackRef.current = stack.slice(0, -1)
    bump()
    try {
      await action.undo()
      redoStackRef.current = [...redoStackRef.current, action]
      bump()
      return true
    } catch (err) {
      undoStackRef.current = [...undoStackRef.current, action]
      bump()
      onError?.(err)
      return false
    }
  }, [bump])

  const handleRedo = useCallback(async (onError?: (err: unknown) => void): Promise<boolean> => {
    const stack = redoStackRef.current
    if (stack.length === 0) return false
    const action = stack[stack.length - 1]
    redoStackRef.current = stack.slice(0, -1)
    bump()
    try {
      await action.redo()
      undoStackRef.current = [...undoStackRef.current, action]
      bump()
      return true
    } catch (err) {
      redoStackRef.current = [...redoStackRef.current, action]
      bump()
      onError?.(err)
      return false
    }
  }, [bump])

  return {
    push,
    handleUndo,
    handleRedo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undoLabel: undoStackRef.current[undoStackRef.current.length - 1]?.label ?? null,
    redoLabel: redoStackRef.current[redoStackRef.current.length - 1]?.label ?? null,
  }
}
