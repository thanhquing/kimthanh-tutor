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
      this.renderEmail({
        preheader: 'Xác thực email để kích hoạt tài khoản Kim Thành Tutor của bạn.',
        heading: 'Xác thực email của bạn',
        intro:
          'Cảm ơn bạn đã đăng ký <strong>Kim Thành Tutor</strong>. Chỉ còn một bước nữa — nhấn nút bên dưới để xác thực email và kích hoạt tài khoản.',
        ctaLabel: 'Xác thực email',
        ctaUrl: link,
        note: 'Nếu bạn không tạo tài khoản này, hãy bỏ qua email — sẽ không có gì xảy ra.',
      }),
    );
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    await this.send(
      to,
      'Đặt lại mật khẩu · Kim Thành Tutor',
      this.renderEmail({
        preheader: 'Đặt lại mật khẩu Kim Thành Tutor — liên kết hết hạn sau 1 giờ.',
        heading: 'Đặt lại mật khẩu',
        intro:
          'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản này. Nhấn nút bên dưới để tạo mật khẩu mới.',
        ctaLabel: 'Đặt lại mật khẩu',
        ctaUrl: link,
        badge: 'Liên kết hết hạn sau 1 giờ',
        note: 'Nếu bạn không yêu cầu, hãy bỏ qua email — mật khẩu của bạn không thay đổi.',
      }),
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

    try {
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
        throw new Error(`Resend ${response.status}: ${detail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Resend gửi email thất bại tới ${to}: ${message}`);
      // Prod: ném để không âm thầm nuốt email quan trọng. Non-prod: chỉ log —
      // không để lỗi gửi email (vd Resend test-mode chặn recipient) làm hỏng
      // luồng đăng ký/reset; `dev_*_link` do caller trả là fallback để test.
      if (isProd) throw new Error('Không gửi được email');
    }
  }

  private renderEmail(opts: {
    preheader: string;
    heading: string;
    intro: string;
    ctaLabel: string;
    ctaUrl: string;
    note: string;
    badge?: string;
  }): string {
    const { preheader, heading, intro, ctaLabel, ctaUrl, note, badge } = opts;
    const year = new Date().getFullYear();
    const badgeHtml = badge
      ? `<tr><td style="padding:0 40px 4px"><span style="display:inline-block;background:#fff4e5;color:#a15c00;font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px">⏱ ${badge}</span></td></tr>`
      : '';
    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2a3a;-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}&#8202;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(11,37,69,.08)">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0b2545 0%,#13315c 100%);padding:24px 40px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px"><div style="width:36px;height:36px;background:#ffffff;border-radius:9px;text-align:center;line-height:36px;font-weight:800;color:#0b2545;font-size:15px">KT</div></td>
            <td style="padding-left:12px;color:#ffffff;font-weight:700;font-size:16px;letter-spacing:.2px">Kim Thành Tutor</td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px 8px">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0b2545;font-weight:700">${heading}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#48566e">${intro}</p>
        </td></tr>
        ${badgeHtml}
        <!-- CTA (bulletproof) -->
        <tr><td style="padding:12px 40px 8px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="border-radius:10px;background:#0f4c81">
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${ctaLabel}</a>
            </td>
          </tr></table>
        </td></tr>
        <!-- Fallback link -->
        <tr><td style="padding:20px 40px 0">
          <p style="margin:0 0 6px;font-size:12px;color:#8894a8">Nút không hoạt động? Sao chép liên kết sau vào trình duyệt:</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#0f4c81;word-break:break-all"><a href="${ctaUrl}" style="color:#0f4c81;text-decoration:none">${ctaUrl}</a></p>
        </td></tr>
        <!-- Divider + note -->
        <tr><td style="padding:24px 40px 0"><div style="height:1px;background:#eaeef4"></div></td></tr>
        <tr><td style="padding:16px 40px 32px">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#94a0b4">${note}</p>
        </td></tr>
      </table>
      <!-- Footer -->
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px">
        <tr><td style="padding:20px 40px;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#0b2545;font-weight:600">Kim Thành Tutor</p>
          <p style="margin:0;font-size:11px;color:#9aa6ba">Nền tảng kết nối gia sư · © ${year}. Email tự động, vui lòng không trả lời.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
