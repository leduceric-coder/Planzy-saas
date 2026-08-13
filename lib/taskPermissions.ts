// ── Droits d'édition d'une tâche côté interface (LOT 42E1C) ──────────────────
// ⚠️ Affichage uniquement. La sécurité réelle est la RLS 42E1B : policies
// RESTRICTIVE sur tasks + trigger enforce_artisan_task_columns. Ce module sert
// à ne pas proposer une action que la base refusera — il ne protège rien.
//
// Le nommage distingue volontairement « voir » et « modifier » :
// can_access_task() (DB) est plus large que ces fonctions, car il couvre aussi
// l'appartenance au chantier. Un artisan voit 14 tâches et n'en modifie que 3.

import { isInternal, asRole } from './permissions'

type TaskRef = { id: string; assigned_to?: string | null }

/** Miroir exact de la règle DB : ATA active OU tasks.assigned_to. */
export function isTaskAssignedToArtisan(
  task: TaskRef,
  artisanId: string | null | undefined,
  assignedTaskIds: readonly string[] | ReadonlySet<string>,
): boolean {
  if (!artisanId) return false
  if (task.assigned_to === artisanId) return true
  return assignedTaskIds instanceof Set
    ? assignedTaskIds.has(task.id)
    : (assignedTaskIds as readonly string[]).includes(task.id)
}

/** Champs administratifs (titre, dates, priorité, description, affectations). */
export function canEditTaskFields(role: string | null | undefined): boolean {
  return isInternal(role)
}

/** Avancement d'une tâche : interne partout, artisan sur ses tâches seulement. */
export function canUpdateTaskStatus(
  role: string | null | undefined,
  task: TaskRef,
  artisanId: string | null | undefined,
  assignedTaskIds: readonly string[] | ReadonlySet<string>,
): boolean {
  if (isInternal(role)) return true
  if (asRole(role) !== 'artisan') return false
  return isTaskAssignedToArtisan(task, artisanId, assignedTaskIds)
}
