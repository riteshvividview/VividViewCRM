const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

export async function sendEmail({ to, subject, htmlContent }: SendEmailOptions): Promise<void> {
  // Reserved domains (.test, .invalid, .example, .localhost) can never receive mail:
  // sending would only bounce and hurt the sender reputation. Locally, keep them in a file instead.
  if (/\.(test|invalid|example|localhost)$/i.test(to.split("@")[1] ?? "")) {
    if (process.env.NODE_ENV !== "production") {
      const { appendFile } = await import("fs/promises");
      const { join } = await import("path");
      const { tmpdir } = await import("os");
      await appendFile(join(tmpdir(), "vividview-dev-mail.jsonl"), JSON.stringify({ to, subject, htmlContent, at: new Date().toISOString() }) + "\n").catch(() => {});
    }
    return;
  }
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME ?? "Vivid View CRM";

  if (!apiKey || !senderEmail) {
    throw new Error("Brevo API key or sender email not configured");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${error}`);
  }
}
