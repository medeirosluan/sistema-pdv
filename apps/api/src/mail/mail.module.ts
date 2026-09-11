import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from =
      config.get<string>('MAIL_FROM') ??
      'Sistema PDV <nao-responda@sistemapdv.com>';

    const host = config.get<string>('SMTP_HOST');
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get<string>('SMTP_PORT') ?? 587),
          secure: config.get<string>('SMTP_SECURE') === 'true',
          auth: config.get<string>('SMTP_USER')
            ? {
                user: config.get<string>('SMTP_USER'),
                pass: config.get<string>('SMTP_PASS'),
              }
            : undefined,
        })
      : null;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      // Sem SMTP configurado: registra no console (útil em desenvolvimento)
      console.log(`[mail:dev] para=${to} assunto="${subject}"\n${html}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }
}

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
