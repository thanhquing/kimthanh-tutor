import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Gửi email giao dịch qua Resend (HTTP API). Khi chưa cấu hình RESEND_API_KEY
 * (dev/test) → log link để test được ngay; caller trả `dev_*_link` ở non-prod.
 * Ở production thiếu key sẽ throw để không âm thầm nuốt email quan trọng.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Xác thực email · Kim Thành Tutor',
      this.wrap(
        'Xác thực email của bạn',
        `Cảm ơn bạn đã đăng ký Kim Thành Tutor. Nhấn nút bên dưới để xác thực email và kích hoạt tài khoản.`,
        'Xác thực email',
        link,
        'Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.',
      ),
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Đặt lại mật khẩu · Kim Thành Tutor',
      this.wrap(
        'Đặt lại mật khẩu',
        `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản này. Nhấn nút bên dưới để tạo mật khẩu mới. Liên kết sẽ hết hạn sau một giờ.`,
        'Đặt lại mật khẩu',
        link,
        'Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.',
      ),
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.config.get<string>('mail.resendApiKey');
    const from = this.config.get<string>('mail.from')!;
    const isProd = this.config.get<string>('env') === 'production';

    if (!apiKey) {
      if (isProd) {
        throw new Error('RESEND_API_KEY chưa cấu hình ở production — không thể gửi email');
      }
      this.logger.warn(`[DEV MAIL] tới ${to} · ${subject}`);
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logger.error(`Resend gửi email thất bại (${response.status}): ${detail}`);
      throw new Error('Không gửi được email');
    }
  }

  private wrap(
    heading: string,
    intro: string,
    cta: string,
    link: string,
    footer: string,
  ): string {
    return `<!doctype html>
<html lang="vi"><body style="margin:0;background:#f4f6fa;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2a3a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5eaf1;border-radius:10px;overflow:hidden">
        <tr><td style="background:#0b2545;padding:18px 24px;color:#fff;font-weight:700">Kim Thành Tutor</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:18px;color:#0b2545">${heading}</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3a4a63">${intro}</p>
          <a href="${link}" style="display:inline-block;background:#0f4c81;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">${cta}</a>
          <p style="margin:20px 0 0;font-size:12px;color:#56657f;word-break:break-all">Hoặc mở liên kết: ${link}</p>
          <p style="margin:16px 0 0;font-size:12px;color:#8894a8">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  }
}
