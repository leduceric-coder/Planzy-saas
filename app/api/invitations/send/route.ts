import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { buildInvitationEmail } from '@/lib/email/templates/invitation'

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, code: 'unauthenticated', message: 'Non authentifié' }, { status: 401 })
    }

    // ── 2. Parse body ────────────────────────────────────────────────────────────
    let invitationId: string
    try {
      const body = await req.json()
      invitationId = body.invitationId
    } catch {
      return NextResponse.json({ ok: false, code: 'invalid_body', message: 'Corps de requête invalide' }, { status: 400 })
    }
    if (!invitationId || typeof invitationId !== 'string') {
      return NextResponse.json({ ok: false, code: 'missing_param', message: 'invitationId requis' }, { status: 400 })
    }

    // ── 3. Load invitation ───────────────────────────────────────────────────────
    const { data: inv, error: invErr } = await (supabase as any)
      .from('invitations')
      .select('id, email, token, role, artisan_id, org_id, status, expires_at, email_send_count')
      .eq('id', invitationId)
      .single() as { data: {
        id: string
        email: string
        token: string
        role: string
        artisan_id: string | null
        org_id: string
        status: string
        expires_at: string | null
        email_send_count: number
      } | null; error: unknown }

    if (invErr || !inv) {
      return NextResponse.json({ ok: false, code: 'not_found', message: 'Invitation introuvable' }, { status: 404 })
    }
    if (inv.status !== 'pending') {
      const message = inv.status === 'accepted' ? 'Cette invitation a déjà été acceptée.'
        : inv.status === 'revoked' ? 'Cette invitation a été révoquée.'
        : 'Cette invitation a expiré.'
      return NextResponse.json({ ok: false, code: 'invitation_not_pending', message }, { status: 400 })
    }
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, code: 'invitation_expired', message: 'Cette invitation a expiré. Créez une nouvelle invitation.' }, { status: 400 })
    }

    // ── 4. Verify caller is owner/admin of the same org ──────────────────────────
    const { data: caller } = await (supabase as any)
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single() as { data: { org_id: string | null; role: string } | null }

    if (!caller || caller.org_id !== inv.org_id) {
      return NextResponse.json({ ok: false, code: 'forbidden', message: 'Non autorisé' }, { status: 403 })
    }
    if (!['owner', 'admin'].includes(caller.role)) {
      return NextResponse.json({ ok: false, code: 'forbidden', message: 'Non autorisé' }, { status: 403 })
    }

    // ── 5. Load org name ─────────────────────────────────────────────────────────
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('name')
      .eq('id', inv.org_id)
      .single() as { data: { name: string } | null }

    const orgName = org?.name ?? 'votre organisation'

    // ── 6. Load artisan if linked ────────────────────────────────────────────────
    let artisanName: string | null = null
    let artisanTrade: string | null = null
    if (inv.artisan_id) {
      const { data: artisan } = await (supabase as any)
        .from('artisans')
        .select('full_name, trade')
        .eq('id', inv.artisan_id)
        .single() as { data: { full_name: string; trade: string } | null }
      artisanName = artisan?.full_name ?? null
      artisanTrade = artisan?.trade ?? null
    }

    // ── 7. Check Resend config ───────────────────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      await (supabase as any)
        .from('invitations')
        .update({
          email_send_count: (inv.email_send_count ?? 0) + 1,
          email_last_error: 'email_not_configured',
        })
        .eq('id', invitationId)

      return NextResponse.json({
        ok: false,
        code: 'email_not_configured',
        message: "L'envoi automatique n'est pas encore configuré. Copiez le lien manuellement.",
        fallback: true,
      })
    }

    // ── 8. Build invite link ─────────────────────────────────────────────────────
    const host = req.headers.get('host') ?? 'planzy-saas.vercel.app'
    const proto = host.startsWith('localhost') ? 'http' : 'https'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`
    const inviteLink = `${siteUrl}/invite/${inv.token}`

    // ── 9. Send email ────────────────────────────────────────────────────────────
    const resend = new Resend(resendKey)
    const from = process.env.KANVIX_EMAIL_FROM ?? process.env.PLANZY_EMAIL_FROM ?? 'Kanvix <onboarding@resend.dev>'

    const { subject, html, text } = buildInvitationEmail({
      orgName,
      role: inv.role,
      artisanName,
      artisanTrade,
      inviteLink,
      expiresAt: inv.expires_at,
    })

    let messageId: string | null = null
    let sendError: string | null = null

    try {
      const result = await resend.emails.send({ from, to: inv.email, subject, html, text })
      if (result.error) {
        sendError = result.error.message
      } else {
        messageId = result.data?.id ?? null
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : 'Erreur inconnue'
    }

    // ── 10. Update DB ────────────────────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      email_send_count: (inv.email_send_count ?? 0) + 1,
      email_provider: 'resend',
      email_last_error: sendError,
    }
    if (!sendError) {
      updatePayload.email_sent_at = new Date().toISOString()
      updatePayload.email_message_id = messageId
    }

    await (supabase as any)
      .from('invitations')
      .update(updatePayload)
      .eq('id', invitationId)

    if (sendError) {
      console.error('[Kanvix] Resend error for invitation', invitationId, ':', sendError)
      return NextResponse.json({
        ok: false,
        code: 'send_failed',
        message: "L'email n'a pas pu être envoyé. Vous pouvez copier le lien manuellement.",
        fallback: true,
      })
    }

    return NextResponse.json({ ok: true, messageId })

  } catch (err) {
    console.error('[Kanvix] Unhandled error in /api/invitations/send:', err)
    return NextResponse.json({
      ok: false,
      code: 'server_error',
      message: "Une erreur inattendue s'est produite. Le lien d'invitation reste copiable.",
      fallback: true,
    })
  }
}
