type OtpType = "password_reset" | "password_change" | "registration";

const TYPE_COPY: Record<OtpType, { subject: string; heading: string; body: string }> = {
  registration: {
    subject: "Verify your Vivid View account",
    heading: "Welcome to Vivid View!",
    body: "Use the code below to verify your email and create your account. It&apos;s valid for <strong>10 minutes</strong>.",
  },
  password_reset: {
    subject: "Reset your Vivid View password",
    heading: "Reset your password",
    body: "Use the code below to verify your identity and reset your password. It's valid for <strong>10 minutes</strong>.",
  },
  password_change: {
    subject: "Verify your Vivid View password change",
    heading: "Verify password change",
    body: "Use the code below to confirm your identity before updating your password. It's valid for <strong>10 minutes</strong>.",
  },
};

const LOGO_URL =
  "https://framerusercontent.com/images/2gAAyVbI2Y7gBWNO6ztH91fY2w.png?scale-down-to=512&width=1628&height=875";

export function buildOtpEmail(otp: string, type: OtpType): { subject: string; htmlContent: string } {
  const { subject, heading, body } = TYPE_COPY[type];
  const digits = otp.split("");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0f0a1e;font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0a1e;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Brand Logo Banner -->
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <img
                src="${LOGO_URL}"
                alt="Vivid View CRM"
                width="220"
                style="display:inline-block;max-width:220px;height:auto;border-radius:14px;"
              />
            </td>
          </tr>

          <!-- Header Card -->
          <tr>
            <td style="
              background:linear-gradient(145deg,#2d0a5c 0%,#5b21b6 45%,#7c3aed 80%,#a855f7 100%);
              border-radius:20px 20px 0 0;
              padding:36px 36px 32px;
              text-align:center;
              box-shadow:0 -4px 32px rgba(124,58,237,0.3);
            ">
              <!-- Decorative ring -->
              <div style="
                width:64px;height:64px;
                background:rgba(255,255,255,0.12);
                border:2px solid rgba(255,255,255,0.25);
                border-radius:50%;
                margin:0 auto 18px;
                display:flex;align-items:center;justify-content:center;
                line-height:64px;
                font-size:28px;
              ">🔐</div>
              <div style="
                color:#ffffff;
                font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                font-size:26px;
                font-weight:800;
                letter-spacing:-0.5px;
                line-height:1.2;
              ">${heading}</div>
              <div style="
                margin-top:6px;
                width:40px;height:3px;
                background:rgba(255,255,255,0.35);
                border-radius:2px;
                margin-left:auto;margin-right:auto;
              "></div>
            </td>
          </tr>

          <!-- Body Card -->
          <tr>
            <td style="
              background:#1a1030;
              padding:36px 36px 32px;
              border-left:1px solid rgba(124,58,237,0.25);
              border-right:1px solid rgba(124,58,237,0.25);
            ">
              <p style="
                margin:0 0 28px;
                color:#c4b5fd;
                font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                font-size:15px;
                font-weight:400;
                line-height:1.75;
                text-align:center;
              ">${body}</p>

              <!-- OTP digit row -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  ${digits
                    .map(
                      (d) =>
                        `<td style="padding:0 5px;">
                          <div style="
                            width:50px;height:60px;
                            background:linear-gradient(160deg,#6d28d9,#7c3aed);
                            border-radius:14px;
                            text-align:center;
                            line-height:60px;
                            font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                            font-size:30px;
                            font-weight:800;
                            color:#ffffff;
                            letter-spacing:0;
                            box-shadow:0 6px 20px rgba(109,40,217,0.55),inset 0 1px 0 rgba(255,255,255,0.15);
                            border:1px solid rgba(168,85,247,0.4);
                          ">${d}</div>
                        </td>`
                    )
                    .join("")}
                </tr>
              </table>

              <!-- Expiry pill -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="
                    background:rgba(109,40,217,0.15);
                    border:1px solid rgba(124,58,237,0.35);
                    border-radius:50px;
                    padding:10px 22px;
                    text-align:center;
                  ">
                    <span style="
                      color:#a78bfa;
                      font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                      font-size:13px;
                      font-weight:600;
                      letter-spacing:0.2px;
                    ">⏱&nbsp;&nbsp;This code expires in 10 minutes</span>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:rgba(124,58,237,0.2);margin-bottom:24px;"></div>

              <p style="
                margin:0;
                color:#6b7280;
                font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                font-size:13px;
                font-weight:400;
                line-height:1.7;
                text-align:center;
              ">
                If you didn&apos;t request this code, you can safely ignore this email.<br/>
                Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background:#130d24;
              border:1px solid rgba(124,58,237,0.2);
              border-top:none;
              border-radius:0 0 20px 20px;
              padding:22px 36px;
              text-align:center;
            ">
              <p style="
                margin:0 0 6px;
                color:#4b5563;
                font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                font-size:12px;
                font-weight:500;
              ">
                &copy; ${new Date().getFullYear()} Vivid View CRM &mdash; All rights reserved
              </p>
              <p style="
                margin:0;
                color:#374151;
                font-family:'Plus Jakarta Sans',ui-sans-serif,-apple-system,sans-serif;
                font-size:11px;
              ">
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, htmlContent };
}
