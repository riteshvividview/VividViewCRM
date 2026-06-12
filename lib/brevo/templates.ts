type OtpType = "password_reset" | "password_change" | "registration";

const TYPE_COPY: Record<OtpType, { subject: string; heading: string; body: string; note: string }> = {
  registration: {
    subject: "Your Vivid View CRM Verification Code",
    heading: "Email Verification",
    body: "You have requested a verification code to confirm your email address. Enter the code below to proceed. This code is valid for <strong>10 minutes</strong> and can only be used once.",
    note: "If you did not initiate this request, you may safely disregard this message. No action is required.",
  },
  password_reset: {
    subject: "Password Reset Request — Vivid View CRM",
    heading: "Password Reset",
    body: "A password reset request was submitted for your account. Enter the verification code below to confirm your identity and proceed with resetting your password. This code is valid for <strong>10 minutes</strong>.",
    note: "If you did not request a password reset, please disregard this message. Your password will not be changed.",
  },
  password_change: {
    subject: "Password Change Verification — Vivid View CRM",
    heading: "Password Change Verification",
    body: "A request has been made to change the password on your account. Enter the verification code below to authorise this action. This code is valid for <strong>10 minutes</strong>.",
    note: "If you did not initiate this change, please contact your administrator immediately.",
  },
};

const LOGO_URL =
  "https://framerusercontent.com/images/2gAAyVbI2Y7gBWNO6ztH91fY2w.png?scale-down-to=512&width=1628&height=875";

export function buildOtpEmail(otp: string, type: OtpType): { subject: string; htmlContent: string } {
  const { subject, heading, body, note } = TYPE_COPY[type];
  const digits = otp.split("");

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

        <!-- Email container — full width up to 640px -->
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
                ${heading}
              </p>
              <p style="margin:6px 0 0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.75);">
                Vivid View CRM &mdash; Security Notification
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 28px;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;color:#374151;line-height:1.7;">
                ${body}
              </p>

              <!-- OTP code row -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  ${digits.map((d) => `
                  <td style="padding:0 4px;">
                    <div style="
                      width:48px;height:56px;
                      background-color:#f5f3ff;
                      border:2px solid #7c3aed;
                      text-align:center;
                      line-height:56px;
                      font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;
                      font-size:28px;
                      font-weight:700;
                      color:#5b21b6;
                      letter-spacing:0;
                    ">${d}</div>
                  </td>`).join("")}
                </tr>
              </table>

              <!-- Expiry notice -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td style="
                    background-color:#f5f3ff;
                    border-left:4px solid #7c3aed;
                    padding:12px 16px;
                  ">
                    <p style="margin:0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#5b21b6;font-weight:600;">
                      This code expires in 10 minutes. Do not share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid #e5e7eb;font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Security note -->
              <p style="margin:0;font-family:'Plus Jakarta Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;line-height:1.7;">
                ${note}
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
