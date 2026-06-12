import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@config/config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: AppConfigService) {}

  async sendPasswordResetOtp(email: string, otp: string, fullName: string): Promise<void> {
    if (!this.config.brevoApiKey) {
      this.logger.warn('Brevo API key not set — skipping email send');
      return;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.brevoApiKey,
        },
        body: JSON.stringify({
          sender: {
            name: this.config.brevoFromName,
            email: this.config.brevoFromEmail,
          },
          to: [{ email, name: fullName }],
          subject: 'Your VividCRM password reset code',
          textContent: [
            `Hi ${fullName},`,
            '',
            `Your password reset code is: ${otp}`,
            '',
            'This code expires in 15 minutes.',
            '',
            'If you did not request this, please ignore this email.',
            '',
            '— VividCRM',
          ].join('\n'),
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#6366f1">Password Reset</h2>
              <p>Hi ${fullName},</p>
              <p>Your password reset code is:</p>
              <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1f2937;background:#f3f4f6;padding:16px 24px;border-radius:8px;text-align:center;margin:16px 0">
                ${otp}
              </div>
              <p style="color:#6b7280;font-size:14px">This code expires in <strong>15 minutes</strong>.</p>
              <p style="color:#6b7280;font-size:14px">If you did not request this, please ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Brevo email failed: ${response.status} ${body}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send OTP email: ${(err as Error).message}`);
    }
  }
}
