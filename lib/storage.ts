// ─── Résolution des URLs Storage (photos / documents) ───────────────────────
// LOT 33 — Corrige l'ouverture des photos/documents depuis la fiche chantier.
// Cause du bug : les uploads réels stockent un CHEMIN NU dans `url`/`file_url`
// (identique à `storage_path`). Rendu tel quel dans <img src> / <a href>, ce
// chemin est résolu RELATIVEMENT à la page (/chantiers/[id]/xxx.png) → 404.
// Le bucket est privé → il faut une URL SIGNÉE générée à partir de `storage_path`.
//
// Helper mutualisé entre photos et documents. Ne rend jamais le bucket public,
// ne construit jamais d'URL à partir d'un simple filename, ne persiste pas d'URL
// signée en base (générée au rendu serveur, fraîche à chaque visite).

type SignedUrlRow = { path?: string | null; signedUrl?: string | null; error?: unknown }

interface StorageSigner {
  storage: {
    from(bucket: string): {
      createSignedUrls(
        paths: string[],
        expiresIn: number,
      ): Promise<{ data: SignedUrlRow[] | null; error: unknown }>
    }
  }
}

/**
 * Génère des URLs signées pour une liste de chemins Storage.
 * @returns Map `storage_path` → URL signée (les chemins introuvables sont omis).
 */
export async function signStoragePaths(
  supabase: StorageSigner,
  bucket: string,
  paths: (string | null | undefined)[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn)
  for (const row of data ?? []) {
    if (row?.path && row?.signedUrl) map.set(row.path, row.signedUrl)
  }
  return map
}

/**
 * Choisit l'URL d'affichage d'un objet Storage — FONCTION PURE (testable).
 *
 * Priorité :
 *   1. `storagePath` présent + URL signée disponible → URL signée.
 *   2. `fallbackUrl` déjà ABSOLUE (http/https) → conservée (anciennes données démo).
 *   3. sinon → `null` (jamais un chemin nu / filename, qui provoquerait un 404).
 */
export function resolveStorageUrl(
  storagePath: string | null | undefined,
  signed: Map<string, string>,
  fallbackUrl: string | null | undefined,
): string | null {
  if (storagePath) {
    const s = signed.get(storagePath)
    if (s) return s
  }
  if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) return fallbackUrl
  return null
}
