import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ASSIGNABLE_ROLES, ROLE_ERROR_STATUS, type RoleErrorCode } from '@/lib/roles'
import type { Role } from '@/lib/permissions'

// ── POST /api/resources/[id]/role ────────────────────────────────────────────
// [id] = identifiant de la RESSOURCE (artisan). La route résout le profil lié,
// puis délègue la décision à public.update_member_profile, exécutée avec le
// contexte de l'utilisateur authentifié (jamais service_role).
//
// La route ne fait AUCUN UPDATE sur profiles : la RPC est l'autorité finale et
// rejoue toute la matrice. Les contrôles ci-dessous ne sont là que pour
// produire des erreurs lisibles — ils ne peuvent pas contourner la base.
function fail(error: RoleErrorCode) {
  return NextResponse.json({ ok: false, error }, { status: ROLE_ERROR_STATUS[error] })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: resourceId } = await ctx.params
    const supabase = await createClient()
    const db = supabase as any

    // 1. Authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail('non_authentifie')

    // 2. Corps
    let body: { role?: string }
    try { body = await req.json() } catch { return fail('invalid_role') }
    const newRole = body.role ?? ''
    if (!ASSIGNABLE_ROLES.includes(newRole as Role)) {
      return fail(newRole === 'owner' ? 'cannot_assign_owner' : 'invalid_role')
    }

    // 3. Appelant (org de référence)
    const { data: caller, error: callerErr } = await db
      .from('profiles').select('org_id').eq('id', user.id).single()
    if (callerErr || !caller?.org_id) return fail('non_autorise')

    // 4. Ressource + cohérence d'organisation
    const { data: resource, error: resErr } = await db
      .from('artisans').select('id, org_id').eq('id', resourceId).maybeSingle()
    if (resErr) return fail('non_autorise')
    if (!resource || resource.org_id !== caller.org_id) return fail('member_not_found')

    // 5. Profil lié à la ressource — c'est LUI la cible, jamais artisan.id
    const { data: target, error: targetErr } = await db
      .from('profiles').select('id, artisan_id').eq('org_id', caller.org_id).eq('artisan_id', resourceId).maybeSingle()
    if (targetErr) return fail('non_autorise')
    if (!target) return fail('resource_not_linked')

    // 6. Délégation à la RPC (autorité finale).
    //    p_new_artisan_id : on retransmet le lien COURANT — la RPC traite cet
    //    argument comme faisant foi, un NULL délierait l'artisan.
    const { data, error: rpcErr } = await db.rpc('update_member_profile', {
      p_member_id: target.id,
      p_new_role: newRole,
      p_new_artisan_id: target.artisan_id,
    })
    if (rpcErr) return NextResponse.json({ ok: false, error: 'non_autorise' }, { status: 403 })

    const result = data as { success?: boolean; error?: string; old_role?: string; new_role?: string } | null
    if (result?.error) return fail(result.error as RoleErrorCode)
    if (!result?.success) return NextResponse.json({ ok: false, error: 'non_autorise' }, { status: 403 })

    return NextResponse.json({ ok: true, oldRole: result.old_role, newRole: result.new_role })
  } catch (err) {
    console.error('[Kanvix] resource role change error:', err)
    return NextResponse.json({ ok: false, error: 'non_autorise' }, { status: 500 })
  }
}
