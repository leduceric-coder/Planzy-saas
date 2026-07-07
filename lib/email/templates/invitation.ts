const ROLE_LABEL: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  manager: 'Chef de projet',
  site_supervisor: 'Conducteur de travaux',
  artisan: 'Artisan',
  viewer: 'Lecteur',
}

export interface InvitationEmailParams {
  orgName: string
  role: string
  artisanName: string | null
  artisanTrade: string | null
  inviteLink: string
  expiresAt: string | null
}

export function buildInvitationEmail({
  orgName,
  role,
  artisanName,
  artisanTrade,
  inviteLink,
  expiresAt,
}: InvitationEmailParams): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABEL[role] ?? role

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  const subject = `Invitation à rejoindre ${orgName} sur Kanvix`

  const artisanRow = artisanName
    ? `<tr>
        <td style="padding-top:8px;">
          <p style="margin:0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Rattaché à</p>
          <p style="margin:4px 0 0 0;color:#f1f5f9;font-size:15px;font-weight:600;">${artisanName}${artisanTrade ? ` <span style="color:#94a3b8;font-weight:400;">· ${artisanTrade}</span>` : ''}</p>
        </td>
      </tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1117;padding:48px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#2563FF;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="color:white;font-size:20px;font-weight:800;line-height:40px;letter-spacing:-1px;">K</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#f1f5f9;font-weight:700;font-size:22px;letter-spacing:-0.5px;">Kanvix</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1a1d2e;border:1px solid #2d3148;border-radius:20px;padding:40px 36px;">

              <p style="margin:0 0 6px 0;color:#6366f1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Invitation</p>
              <h1 style="margin:0 0 20px 0;color:#f1f5f9;font-size:26px;font-weight:700;line-height:1.25;">
                Rejoignez&nbsp;${orgName}
              </h1>

              <p style="margin:0 0 28px 0;color:#94a3b8;font-size:15px;line-height:1.65;">
                Vous avez été invité à rejoindre l'organisation <strong style="color:#f1f5f9;">${orgName}</strong> sur Kanvix, la plateforme de gestion de chantier.
              </p>

              <!-- Info card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1117;border:1px solid #2d3148;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Votre rôle</p>
                          <p style="margin:0;color:#6366f1;font-size:17px;font-weight:700;">${roleLabel}</p>
                        </td>
                      </tr>
                      ${artisanRow}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}"
                      style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.01em;">
                      Rejoindre Kanvix
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 8px 0;color:#64748b;font-size:12px;text-align:center;line-height:1.5;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
              </p>
              <p style="margin:0${expiryText ? ' 0 20px 0' : ''};text-align:center;">
                <a href="${inviteLink}" style="color:#6366f1;font-size:12px;word-break:break-all;text-decoration:underline;">${inviteLink}</a>
              </p>

              ${expiryText ? `<p style="margin:0;color:#64748b;font-size:12px;text-align:center;">Ce lien expire le <strong style="color:#94a3b8;">${expiryText}</strong>.</p>` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center;">
              <p style="margin:0;color:#334155;font-size:12px;line-height:1.6;">
                L'équipe Kanvix &mdash; Gestion de chantier simplifiée<br>
                Vous recevez cet email car vous avez été invité par un administrateur de ${orgName}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `Invitation à rejoindre ${orgName} sur Kanvix`,
    '',
    `Vous avez été invité à rejoindre l'organisation "${orgName}" sur Kanvix.`,
    '',
    `Votre rôle : ${roleLabel}`,
    artisanName ? `Rattaché à : ${artisanName}${artisanTrade ? ` · ${artisanTrade}` : ''}` : '',
    '',
    'Pour accepter l\'invitation, cliquez sur ce lien :',
    inviteLink,
    '',
    expiryText ? `Ce lien expire le ${expiryText}.` : '',
    '',
    'L\'équipe Kanvix',
  ]
    .filter(line => line !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { subject, html, text }
}
