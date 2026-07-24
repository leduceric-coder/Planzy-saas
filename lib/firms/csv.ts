// ── Feux France — parseur CSV FIRMS ──────────────────────────────────────────
// FIRMS renvoie du CSV avec une ligne d'en-tête. On veut un parseur tolérant :
// gestion des guillemets, des séparateurs internes, des lignes vides et des
// fins de ligne CRLF / LF.

/**
 * Parse un CSV en tableau d'objets clé→valeur (string) en s'appuyant sur la
 * ligne d'en-tête. Robuste aux guillemets doubles et aux virgules quotées.
 *
 * Retourne `[]` si le contenu est vide, n'a pas d'en-tête, ou n'est pas du CSV
 * (ex. réponse d'erreur HTML/texte de FIRMS).
 */
export function parseCsv(raw: string): Record<string, string>[] {
  if (!raw) return []
  const text = raw.replace(/^﻿/, '') // BOM éventuel
  const rows = splitCsvRows(text)
  if (rows.length < 2) return []

  const header = rows[0].map((h) => h.trim())
  // Garde-fou : une réponse d'erreur FIRMS (« Invalid MAP_KEY... ») n'a pas la
  // colonne latitude ; on refuse de la traiter comme des données.
  if (!header.includes('latitude') || !header.includes('longitude')) return []

  const out: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    // Ligne vide (souvent une dernière ligne « \n »).
    if (cells.length === 1 && cells[0].trim() === '') continue
    const obj: Record<string, string> = {}
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (cells[c] ?? '').trim()
    }
    out.push(obj)
  }
  return out
}

/** Découpe un texte CSV en lignes puis en cellules, en respectant les guillemets. */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++ // guillemet échappé ""
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // ignore : traité par le \n suivant (CRLF)
    } else {
      field += ch
    }
  }

  // dernière cellule / ligne sans saut final
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
