import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn(async () => undefined);
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});

vi.mock('nodemailer', () => ({
  default: { createTransport },
  createTransport,
}));

import { MailService } from './mail.module.js';

function createConfigMock(values: Record<string, string | undefined>) {
  return {
    get: vi.fn((key: string) => values[key]),
  };
}

describe('MailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra no console e não envia e-mail quando SMTP não está configurado', async () => {
    const config = createConfigMock({});
    const service = new MailService(config as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await service.send('cliente@example.com', 'Assunto', '<p>Corpo</p>');

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('cliente@example.com'),
    );
    logSpy.mockRestore();
  });

  it('envia o e-mail pelo transporte SMTP quando configurado', async () => {
    const config = createConfigMock({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      MAIL_FROM: 'Loja <loja@example.com>',
    });
    const service = new MailService(config as never);

    await service.send('cliente@example.com', 'Assunto', '<p>Corpo</p>');

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com', port: 587 }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Loja <loja@example.com>',
      to: 'cliente@example.com',
      subject: 'Assunto',
      html: '<p>Corpo</p>',
    });
  });

  it('inclui autenticação apenas quando SMTP_USER está definido', async () => {
    const config = createConfigMock({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });
    // eslint-disable-next-line no-new
    new MailService(config as never);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: { user: 'user', pass: 'pass' },
      }),
    );
  });
});
