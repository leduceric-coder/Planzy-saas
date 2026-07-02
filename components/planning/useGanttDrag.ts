'use client'

// GELÉ — LOT 5.S. Le hook useGanttDrag n'est pas câblé dans GanttView ni
// GanttArtisanView. Seul parseDBDate est importé depuis ce fichier.
// Ne pas supprimer : parseDBDate est nécessaire pour éviter le décalage UTC.
// Pour réactiver drag/resize, rebrancher startMove/startResizeLeft/startResizeRight
// sur une branche dédiée après recette complète.

import { useState, useEffect, useCallback, useRef } from 'react'
import { addDays, differenceInDays, format } from 'date-fns'

export type DragMode = 'move' | 'resize-left' | 'resize-right'

export interface DragActive {
  taskId: string
  mode: DragMode
  startClientX: number
  dayW: number
  originalStart: string
  originalEnd: string
  ghostStart: string
  ghostEnd: string
}

export type OnDropFn = (
  taskId: string,
  newStart: string,
  newEnd: string,
  prevStart: string,
  prevEnd: string,
) => Promise<void>

// Parse 'yyyy-MM-dd' as local midnight (avoids UTC timezone shift)
export function parseDBDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function computeGhost(
  mode: DragMode,
  origStart: string,
  origEnd: string,
  deltaDays: number,
): { ghostStart: string; ghostEnd: string } {
  const start = parseDBDate(origStart)
  const end = parseDBDate(origEnd)

  if (mode === 'move') {
    return {
      ghostStart: format(addDays(start, deltaDays), 'yyyy-MM-dd'),
      ghostEnd: format(addDays(end, deltaDays), 'yyyy-MM-dd'),
    }
  }
  if (mode === 'resize-left') {
    const newStart = addDays(start, deltaDays)
    const maxStart = addDays(end, -1)
    return {
      ghostStart: format(newStart > maxStart ? maxStart : newStart, 'yyyy-MM-dd'),
      ghostEnd: origEnd,
    }
  }
  // resize-right
  const newEnd = addDays(end, deltaDays)
  const minEnd = addDays(start, 1)
  return {
    ghostStart: origStart,
    ghostEnd: format(newEnd < minEnd ? minEnd : newEnd, 'yyyy-MM-dd'),
  }
}

export function useGanttDrag(dayW: number, onDrop: OnDropFn) {
  const [drag, setDrag] = useState<DragActive | null>(null)
  const dragRef = useRef<DragActive | null>(null)
  const onDropRef = useRef(onDrop)
  const dayWRef = useRef(dayW)
  useEffect(() => { onDropRef.current = onDrop }, [onDrop])
  useEffect(() => { dayWRef.current = dayW }, [dayW])

  const startDrag = useCallback((
    task: { id: string; start_date: string | null; end_date: string | null },
    mode: DragMode,
    e: React.MouseEvent,
  ) => {
    if (!task.start_date || !task.end_date) return
    e.preventDefault()
    const active: DragActive = {
      taskId: task.id,
      mode,
      startClientX: e.clientX,
      dayW: dayWRef.current,
      originalStart: task.start_date,
      originalEnd: task.end_date,
      ghostStart: task.start_date,
      ghostEnd: task.end_date,
    }
    dragRef.current = active
    setDrag(active)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const deltaDays = Math.round((e.clientX - cur.startClientX) / cur.dayW)
      const { ghostStart, ghostEnd } = computeGhost(cur.mode, cur.originalStart, cur.originalEnd, deltaDays)
      if (ghostStart !== cur.ghostStart || ghostEnd !== cur.ghostEnd) {
        const next = { ...cur, ghostStart, ghostEnd }
        dragRef.current = next
        setDrag(next)
      }
    }

    const onUp = async (e: MouseEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const deltaDays = Math.round((e.clientX - cur.startClientX) / cur.dayW)
      const { ghostStart, ghostEnd } = computeGhost(cur.mode, cur.originalStart, cur.originalEnd, deltaDays)
      dragRef.current = null
      setDrag(null)
      if (ghostStart === cur.originalStart && ghostEnd === cur.originalEnd) return
      await onDropRef.current(cur.taskId, ghostStart, ghostEnd, cur.originalStart, cur.originalEnd)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Cursor + selection lock
  useEffect(() => {
    if (drag) {
      document.body.style.cursor = drag.mode === 'move' ? 'grabbing' : 'ew-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [drag])

  return {
    drag,
    startMove: (task: { id: string; start_date: string | null; end_date: string | null }, e: React.MouseEvent) =>
      startDrag(task, 'move', e),
    startResizeLeft: (task: { id: string; start_date: string | null; end_date: string | null }, e: React.MouseEvent) =>
      startDrag(task, 'resize-left', e),
    startResizeRight: (task: { id: string; start_date: string | null; end_date: string | null }, e: React.MouseEvent) =>
      startDrag(task, 'resize-right', e),
  }
}
