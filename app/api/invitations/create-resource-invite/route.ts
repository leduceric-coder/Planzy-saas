import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveResourceInvitation, type InviteReader } from '@/lib/invitations'

// ── POST /api/invitations/create-resource-invite ─────────────────────────────
// Point serveur UNIQUE de création d'invitation depuis la fiche ressource.
// Toute la décision (autorisation, anti-doublon, périmètre) est déléguée à
// resolveResourceInvitation() — testable sans HTTP — qui est FAIL-CLOSED :
// une lecture de contrôle en échec renvoie 500 et l'INSERT n'a jamais lieu.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

    // 2. Body
    let body: { artisanId?: string; email?: string; role?: string; projectId?: string | null; taskIds?: string[] | null }
    try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
    if (!body.artisanId || typeof body.artisanId !== 'string') {
      return NextResponse.json({ ok: false, error: 'missing_param' }, { status: 400 })
    }

    // 3. Lecteur de faits (RLS-scoped). Chaque échec de lecture ⇒ { ok: false } ⇒ 500.
    const db = supabase as any
    const reader: InviteReader = {
      async getCaller() {
        const { data, error } = await db.from('profiles').select('org_id, role').eq('id', user.id).single()
        if (error) return { ok: false }
        return { ok: true, data: data ? { orgId: data.org_id, role: data.role } : null }
      },
      async getArtisan(artisanId) {
        const { data, error } = await db.from('artisans').select('id, org_id, user_id').eq('id', artisanId).maybeSingle()
        if (error) return { ok: false }
        return { ok: true, data: data ?? null }
      },
      async getProfiles(orgId) {
        const { data, error } = await db.from('profiles').select('email, artisan_id').eq('org_id', orgId)
        if (error) return { ok: false }
        return { ok: true, data: data ?? [] }
      },
      async getInvitations(orgId) {
        const { data, error } = await db.from('invitations').select('email, artisan_id, status')
          .eq('org_id', orgId).in('status', ['pending', 'accepted'])
        if (error) return { ok: false }
        return { ok: true, data: data ?? [] }
      },
      async validateScope(orgId, projectId, taskIds) {
        const { data: proj, error: pErr } = await db.from('projects').select('id').eq('id', projectId).eq('org_id', orgId).maybeSingle()
        if (pErr) return { ok: false }
        const { data: tks, error: tErr } = await db.from('tasks').select('id').eq('org_id', orgId).eq('project_id', projectId).in('id', taskIds)
        if (tErr) return { ok: false }
        return { ok: true, data: !!proj && (tks?.length ?? 0) === taskIds.length }
      },
    }

    // 4. Décision (autorisation + anti-doublon + périmètre)
    const resolved = await resolveResourceInvitation(reader, {
      artisanId: body.artisanId,
      email: body.email ?? '',
      role: body.role ?? '',
      projectId: body.projectId ?? null,
      taskIds: Array.isArray(body.taskIds) ? body.taskIds : null,
    })
    if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.code })

    // 5. INSERT — seule voie d'écriture, atteinte uniquement après tous les contrôles.
    const { data: inserted, error: insErr } = await db
      .from('invitations')
      .insert({
        org_id: resolved.orgId,
        email: resolved.email,
        role: resolved.role,
        artisan_id: resolved.artisanId,
        token: crypto.randomUUID(),
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        project_id: resolved.projectId,
        task_ids: resolved.taskIds,
      })
      .select('id, email, role, artisan_id, project_id, task_ids, token, status')
      .single()

    if (insErr || !inserted) {
      return NextResponse.json({ ok: false, error: 'server_error', detail: insErr?.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, invitation: inserted })
  } catch (err) {
    console.error('[Kanvix] create-resource-invite error:', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
