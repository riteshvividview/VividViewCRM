/** Sign-in emails: setup link, 6-digit code, password changed. Plain, table-based HTML that mail apps render well. */

const LOGO_URL = "https://framerusercontent.com/images/2gAAyVbI2Y7gBWNO6ztH91fY2w.png?scale-down-to=512&width=1628&height=875";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";

function layout(title: string, inner: string, footer: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:${FONT};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:32px 12px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
<tr><td style="background:#5b21b6;padding:20px 32px;"><img src="${LOGO_URL}" alt="Vivid View" width="120" style="display:block;height:auto;max-width:120px;" /></td></tr>
<tr><td style="padding:32px;font-family:${FONT};color:#111827;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${esc(title)}</h1>
${inner}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #f0f0f3;font-family:${FONT};font-size:12px;line-height:1.6;color:#6b7280;">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${html}</p>`;

export type CodePurpose = "activate" | "reset" | "change";

/** "You've been added": sent only when the CEO asks for a reminder. Points to the activation page; holds no code. */
export function addedEmail({ name, page, addedBy }: { name: string; page: string; addedBy?: string }) {
  const first = esc(name.split(" ")[0] || "there");
  const inner = [
    p(`Hi ${first},`),
    p(`${addedBy ? `${esc(addedBy)} has` : "You've been"} added to the Vivid View workspace.`),
    p(`To get started, open <a href="${esc(page)}" style="color:#7c3aed;">${esc(page.replace(/^https?:\/\//, ""))}</a> on the device you want to use, enter this email address and follow the steps. You can also sign in with Google if this is a Google account.`),
  ].join("");
  return { subject: "You've been added to Vivid View", htmlContent: layout("Welcome to Vivid View", inner, "If you weren't expecting this email, you can ignore it.") };
}

const CODE_COPY: Record<CodePurpose, { title: string; lead: string; subject: string }> = {
  activate: { title: "Activate your account", lead: "Enter this code on the activation screen to set up your account:", subject: "is your Vivid View activation code" },
  reset: { title: "Reset your password", lead: "Enter this code on the password reset screen:", subject: "is your Vivid View password reset code" },
  change: { title: "Confirm your new password", lead: "Enter this code to confirm your new password:", subject: "is your Vivid View verification code" },
};

export function codeEmail(code: string, purpose: CodePurpose, name?: string) {
  const c = CODE_COPY[purpose];
  const inner = [
    name ? p(`Hi ${esc(name.split(" ")[0])},`) : "",
    p(c.lead),
    `<p style="margin:8px 0 24px;font-size:32px;font-weight:700;letter-spacing:8px;color:#5b21b6;font-family:${FONT};">${esc(code)}</p>`,
    p(`<span style="font-size:13px;color:#6b7280;">The code works once and expires in 1 hour. Never share it with anyone, including people who say they work at Vivid View.</span>`),
  ].join("");
  return { subject: `${code} ${c.subject}`, htmlContent: layout(c.title, inner, "If you didn't ask for this code, someone may have typed your email by mistake. Nothing has changed on your account.") };
}

export function passwordChangedEmail(name: string) {
  const first = esc(name.split(" ")[0] || "there");
  const inner = [
    p(`Hi ${first},`),
    p(`The password for your Vivid View account was changed on ${new Date().toUTCString()}.`),
    p("If this was you, there's nothing to do."),
  ].join("");
  return { subject: "Your Vivid View password was changed", htmlContent: layout("Your password was changed", inner, "If you didn't change it, reset your password right away.") };
}
