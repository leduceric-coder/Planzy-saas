import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canCreateResourceInvitation, normalizeEmail } from '@/lib/invitations'

// ── POST /api/invitations/create-resource-invite ─────────────────────────────
// Point serveur UNIQUE de création d'invitation depuis la fiche ressource.
// Applique toutes les gardes anti-doublon AVANT l'INSERT, en fail-closed : si une
// lecture de contrôle échoue, on renvoie 500 sans insérer. Le client n'insère plus.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

    // 2. Body
    let body: { artisanId?: string; email?: string; role?: string; projectId?: string | null; taskIds?: string[] | null }
    try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
    const artisanId = body.artisanId
    const role = body.role ?? ''
    const projectId = body.projectId ?? null
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds : null
    if (!artisanId || typeof artisanId !== 'string') return NextResponse.json({ ok: false, error: 'missing_param' }, { status: 400 })
    const email = normalizeEmail(body.email)

    // 3. Caller profile (org + rôle)
    const { data: caller, error: callerErr } = await (supabase as any)
      .from('profiles').select('org_id, role').eq('id', user.id).single() as { data: { org_id: string | null; role: string } | null; error: unknown }
    if (callerErr || !caller?.org_id) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    const orgId = caller.org_id

    // 4. Ressource artisan + cohérence org
    const { data: artisan, error: artErr } = await (supabase as any)
      .from('artisans').select('id, org_id, user_id, email').eq('id', artisanId).maybeSingle() as { data: { id: string; org_id: string; user_id: string | null; email: string | null } | null; error: unknown }
    if (artErr) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
    if (!artisan || artisan.org_id !== orgId) return NextResponse.json({ ok: false, error: 'resource_not_found' }, { status: 403 })

    // 5. Faits « compte existant » (fail-closed : une erreur de lecture ⇒ 500)
    const { data: profs, error: profErr } = await (supabase as any)
      .from('profiles').select('id, email, artisan_id').eq('org_id', orgId) as { data: { id: string; email: string | null; artisan_id: string | null }[] | null; error: unknown }
    if (profErr) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
    const profiles = profs ?? []
    const artisanHasAccount = !!artisan.user_id || profiles.some(p => p.artisan_id === artisanId)
    const emailIsMember = email !== '' && profiles.some(p => normalizeEmail(p.email) === email)

    // 6. Invitations existantes (pending + accepted) de l'org
    const { data: invs, error: invErr } = await (supabase as any)
      .from('invitations').select('email, artisan_id, status').eq('org_id', orgId).in('status', ['pending', 'accepted']) as { data: { email: string | null; artisan_id: string | null; status: string }[] | null; error: unknown }
    if (invErr) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
    const rows = invs ?? []
    const pendingArtisanIds = rows.filter(r => r.status === 'pending' && r.artisan_id).map(r => r.artisan_id as string)
    const pendingEmails = rows.filter(r => r.status === 'pending').map(r => r.email ?? '')
    const acceptedEmails = rows.filter(r => r.status === 'accepted').map(r => r.email ?? '')

    // 7. Validité périmètre artisan (projet ∈ org ET toutes les tâches ∈ projet)
    let taskProjectValid = true
    if (role === 'artisan' && projectId && taskIds && taskIds.length > 0) {
      const { data: proj, error: pErr } = await (supabase as any)
        .from('projects').select('id').eq('id', projectId).eq('org_id', orgId).maybeSingle() as { data: { id: string } | null; error: unknown }
      const { data: tks, error: tErr } = await (supabase as any)
        .from('tasks').select('id').eq('org_id', orgId).eq('project_id', projectId).in('id', taskIds) as { data: { id: string }[] | null; error: unknown }
      if (pErr || tErr) return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
      taskProjectValid = !!proj && (tks?.length ?? 0) === taskIds.length
    }

    // 8. Verdict (source unique)
    const verdict = canCreateResourceInvitation({
      callerRole: caller.role, email, role, artisanId,
      artisanHasAccount, emailIsMember, pendingArtisanIds, pendingEmails, acceptedEmails,
      projectId, taskIds, taskProjectValid,
    })
    if (!verdict.ok) return NextResponse.json({ ok: false, error: verdict.error }, { status: verdict.code })

    // 9. INSERT (seule voie d'écriture) — après tous les contrôles
    const isArtisan = role === 'artisan'
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: inserted, error: insErr } = await (supabase as any)
      .from('invitations')
      .insert({
        org_id: orgId,
        email: verdict.email,
        role,
        artisan_id: artisanId,
        token,
        invited_by: user.id,
        expires_at: expiresAt,
        project_id: isArtisan ? projectId : null,
        task_ids: isArtisan ? taskIds : null,
      })
      .select('id, email, role, artisan_id, project_id, task_ids, token, status')
      .single() as { data: { id: string; email: string; role: string; artisan_id: string | null; project_id: string | null; task_ids: string[] | null; token: string; status: string } | null; error: { message: string } | null }

    if (insErr || !inserted) {
      return NextResponse.json({ ok: false, error: 'server_error', detail: insErr?.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, invitation: inserted })
  } catch (err) {
    console.error('[Kanvix] create-resource-invite error:', err)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
