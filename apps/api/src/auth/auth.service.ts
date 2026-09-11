import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service.js';
import { effectivePermissions, type PermissionOverrides } from '../common/permissions.js';
import { TERMS_VERSION } from '../common/legal.js';
import { MailService } from '../mail/mail.module.js';
import { TenantStatus, UserRole } from '../generated/prisma/enums.js';
import type { TenantModel, UserModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { JwtPayload } from './types/auth-user.js';

function isPlatformAdmin(email: string): boolean {
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;
  private readonly refreshExpiresIn: JwtSignOptions['expiresIn'];
  private readonly accessExpiresIn: JwtSignOptions['expiresIn'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {
    this.refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.refreshExpiresIn = (this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as JwtSignOptions['expiresIn'];
    this.accessExpiresIn = (this.config.get<string>('JWT_EXPIRES_IN') ??
      '15m') as JwtSignOptions['expiresIn'];
  }

  async register(dto: RegisterDto) {
    const slug = dto.tenantSlug.toLowerCase();
    const email = dto.email.toLowerCase();

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException('Já existe uma loja com este identificador');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug,
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
          termsAcceptedAt: new Date(),
          termsVersion: TERMS_VERSION,
        },
      });
      return tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.name,
          email,
          passwordHash,
          role: UserRole.OWNER,
        },
      });
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto, ip?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug.toLowerCase() },
    });
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email: dto.email.toLowerCase() },
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      await this.audit.log({
        tenantId: tenant.id,
        userId: user.id,
        userName: user.name,
        action: 'auth.login.failed',
        ip,
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.twoFactorEnabled) {
      const code = dto.totp?.trim();
      const valid =
        !!code &&
        !!user.twoFactorSecret &&
        verifySync({ token: code, secret: user.twoFactorSecret }).valid;
      if (!valid) {
        await this.audit.log({
          tenantId: tenant.id,
          userId: user.id,
          userName: user.name,
          action: 'auth.login.failed',
          metadata: { reason: '2fa' },
          ip,
        });
        throw new UnauthorizedException(
          'Código de verificação 2FA inválido ou ausente',
        );
      }
    }

    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      userName: user.name,
      action: 'auth.login',
      ip,
    });

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuário inválido');
    }
    if (payload.ver !== undefined && payload.ver !== user.tokenVersion) {
      throw new UnauthorizedException('Sessão encerrada');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return this.toPublicUser(user, user.tenant);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new BadRequestException('Senha atual incorreta');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    return { id: user.id };
  }

  async logout(userId: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    if (user) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.id,
        userName: user.name,
        action: 'auth.logout',
        ip,
      });
    }
    return { ok: true };
  }

  async setupTwoFactor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    const otpauth = generateURI({
      issuer: 'Sistema PDV',
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    return { secret, otpauth, qrDataUrl };
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('Inicie a configuração do 2FA primeiro');
    }
    if (!verifySync({ token: code, secret: user.twoFactorSecret }).valid) {
      throw new BadRequestException('Código inválido');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'auth.2fa.enabled',
    });
    return { enabled: true };
  }

  async disableTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!verifySync({ token: code, secret: user.twoFactorSecret }).valid) {
        throw new BadRequestException('Código inválido');
      }
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'auth.2fa.disabled',
    });
    return { enabled: false };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug.toLowerCase() },
    });
    if (tenant) {
      const user = await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: dto.email.toLowerCase(),
          },
        },
      });
      if (user && user.active) {
        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: new Date(Date.now() + 3_600_000),
          },
        });

        const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
        const link = `${appUrl}/redefinir-senha?token=${token}&tenant=${tenant.slug}`;
        await this.mail.send(
          user.email,
          'Redefinição de senha — Sistema PDV',
          `<p>Olá, ${user.name}.</p><p>Recebemos um pedido para redefinir sua senha.</p><p><a href="${link}">Clique aqui para criar uma nova senha</a></p><p>O link expira em 1 hora. Se não foi você, ignore este e-mail.</p>`,
        );

        await this.audit.log({
          tenantId: tenant.id,
          userId: user.id,
          userName: user.name,
          action: 'auth.password.reset_requested',
        });
      }
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) {
      throw new BadRequestException('Link inválido ou expirado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.log({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      action: 'auth.password.reset',
    });
    return { ok: true };
  }

  private async buildAuthResponse(user: UserModel) {
    const permissions = effectivePermissions(
      user.role,
      user.permissionOverrides as PermissionOverrides | null,
    );
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      permissions,
      ver: user.tokenVersion,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      }),
    ]);

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId },
    });

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user, tenant),
    };
  }

  private toPublicUser(user: UserModel, tenant: TenantModel) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      platformAdmin: isPlatformAdmin(user.email),
      twoFactorEnabled: user.twoFactorEnabled,
      permissions: effectivePermissions(
        user.role,
        user.permissionOverrides as PermissionOverrides | null,
      ),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        document: tenant.document,
        phone: tenant.phone,
        email: tenant.email,
        address: tenant.address,
        settings: tenant.settings,
        plan: tenant.plan,
        status: tenant.status,
      },
    };
  }
}
