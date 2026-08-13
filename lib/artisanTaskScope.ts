// ── Périmètre des tâches affectées à un artisan (LOT 42E1D) ──────────────────
// Le mobile n'affiche que les tâches PERSONNELLEMENT affectées, c'est-à-dire
// exactement la règle d'écriture 42E1B : ATA active ∪ tasks.assigned_to.
// C'est volontairement plus étroit que la RLS 42E1A, qui laisse aussi voir les
// tâches du chantier : le mobile ne doit jamais devenir « toutes les tâches du
// chantier ».
//
// Ce module ne fait que construire un filtre PostgREST. Il n'accorde aucun
// droit — la RLS reste la sécurité réelle. Les identifiants sont revalidés ici
// parce qu'ils partent tels quels dans l'URL de la requête.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ne garde que des UUID valides, dans l'ordre, sans doublon. */
function sanitizeUuids(values: readonly unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    if (typeof v !== 'string' || !UUID_RE.test(v) || seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/** Ids de tâches issus des lignes `artisan_task_assignments` déjà filtrées actives. */
export function collectAtaTaskIds(
  rows: readonly { task_id?: string | null }[] | null | undefined,
): string[] {
  return sanitizeUuids((rows ?? []).map(r => r?.task_id))
}

/**
 * Filtre PostgREST « tâche affectée à l'artisan » : `assigned_to` OU ATA active.
 * Retourne `null` quand il n'y a aucune ATA exploitable — l'appelant conserve
 * alors son `.eq('assigned_to', artisanId)`. Jamais de `id.in.()` vide.
 */
export function artisanTaskFilter(
  artisanId: string | null | undefined,
  ataTaskIds: readonly string[],
): string | null {
  if (typeof artisanId !== 'string' || !UUID_RE.test(artisanId)) return null
  const ids = sanitizeUuids(ataTaskIds)
  if (ids.length === 0) return null
  return `assigned_to.eq.${artisanId},id.in.(${ids.join(',')})`
}
