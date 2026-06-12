const LOGO_URL =
  "https://framerusercontent.com/images/2gAAyVbI2Y7gBWNO6ztH91fY2w.png?scale-down-to=512&width=1628&height=875";

export function buildInviteEmail(
  fullName: string,
  email: string,
  password: string,
  _role: string,
  loginUrl: string
): { subject: string; htmlContent: string } {
  const subject = "Your Vivid View CRM Account Has Been Created";

  const htmlContent = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;padding:32px 0;">
    <tr>
      <td align="center" valign="top">

        <!-- Email container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background-color:#ffffff;border:1px solid #e0e0e0;">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#5b21b6;padding:24px 40px;text-align:left;">
              <img src="${LOGO_URL}" alt="Vivid View CRM" width="140" style="display:inline-block;height:auto;max-width:140px;" />
            </td>
          </tr>

          <!-- Heading band -->
          <tr>
            <td style="background-color:#7c3aed;padding:28px 40px 24px;">
              <p style="margin:0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                Account Invitation
              </p>
              <p style="margin:6px 0 0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);">
                Vivid View CRM &mdash; New Account
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">

              <p style="margin:0 0 20px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
                Dear ${fullName},
              </p>

              <p style="margin:0 0 28px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
                An account has been created for you on <strong>Vivid View CRM</strong>. Please use the login credentials below to access the platform. You will be prompted to change your password upon first login.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;border:1px solid #e5e7eb;background-color:#fafafa;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">
                      Login Email
                    </p>
                    <p style="margin:0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#111827;word-break:break-all;">
                      ${email}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;">
                      Temporary Password
                    </p>
                    <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:20px;font-weight:700;color:#5b21b6;letter-spacing:2px;">
                      ${password}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background-color:#5b21b6;text-align:center;">
                    <a href="${loginUrl}" style="
                      display:inline-block;
                      padding:14px 36px;
                      font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;
                      font-size:14px;
                      font-weight:600;
                      color:#ffffff;
                      text-decoration:none;
                      letter-spacing:0.3px;
                    ">Sign In to Vivid View CRM</a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid #e5e7eb;font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Security note -->
              <p style="margin:0 0 12px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;line-height:1.7;">
                For your security, please change your password immediately after your first login. Do not share your credentials with anyone.
              </p>
              <p style="margin:0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;line-height:1.7;">
                If you were not expecting this invitation, please contact your system administrator.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0 0 4px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} Vivid View CRM. All rights reserved.
              </p>
              <p style="margin:0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#d1d5db;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- End email container -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, htmlContent };
}
