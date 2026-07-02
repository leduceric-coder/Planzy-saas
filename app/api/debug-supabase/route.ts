import { NextResponse } from 'next/server'

// Diagnostic endpoint — returns only non-sensitive config info.
// No keys, no secrets. Safe to call from browser or monitoring.
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  let urlStatus: string
  let hostname: string | null = null

  if (!supabaseUrl) {
    urlStatus = 'missing'
  } else {
    try {
      const parsed = new URL(supabaseUrl)
      hostname = parsed.hostname
      urlStatus = parsed.pathname === '/' ? 'ok' : `invalid_path:${parsed.pathname}`
    } catch {
      urlStatus = 'invalid_format'
    }
  }

  return NextResponse.json({
    supabase_url: urlStatus,
    hostname,
    anon_key_present: !!anonKey,
    anon_key_prefix: anonKey ? anonKey.slice(0, 12) + '...' : null,
    node_env: process.env.NODE_ENV,
  })
}
