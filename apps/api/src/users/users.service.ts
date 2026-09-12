import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service.js';
import {
  computeOverrides,
  effectivePermissions,
  ROLE_PERMISSIONS,
  type Permission,
  type PermissionOverrides,
} from '../common/permissions.js';
import { Prisma } from '../generated/prisma/client.js';
import { UserRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantService } from '../tenant/tenant.service.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  permissionOverrides: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function toUserView(user: UserRow) {
  const { permissionOverrides, ...rest } = user;
  return {
    ...rest,
    permissions: effectivePermissions(
      user.role,
      permissionOverrides as PermissionOverrides | null,
    ),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, query: QueryUsersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.UserWhereInput = { tenantId };
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: rows.map(toUserView),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return toUserView(user);
  }

  async create(tenantId: string, actor: AuthUser, dto: CreateUserDto) {
    this.assertCanAssignRole(actor, dto.role);
    if (dto.permissions !== undefined) {
      this.assertCanGrantPermissions(actor, dto.permissions);
    }
    await this.ensureEmailAvailable(tenantId, dto.email);

    const { limits, usage, name } =
      await this.tenantService.getPlanInfo(tenantId);
    if (usage.users >= limits.maxUsers) {
      throw new ForbiddenException(
        `Limite de ${limits.maxUsers} usuário(s) do plano ${name} atingido. Faça upgrade para adicionar mais.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const desired = dto.permissions ?? ROLE_PERMISSIONS[dto.role];
    const overrides = computeOverrides(dto.role, desired);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        permissionOverrides: overrides as Prisma.InputJsonValue,
      },
      select: userSelect,
    });
    await this.audit.log({
      tenantId,
      userId: actor.userId,
      userName: actor.email,
      action: 'user.create',
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return toUserView(user);
  }

  async update(
    tenantId: string,
    actor: AuthUser,
    id: string,
    dto: UpdateUserDto,
  ) {
    if (
      id === actor.userId &&
      (dto.role !== undefined || dto.permissions !== undefined)
    ) {
      throw new ForbiddenException(
        'Você não pode alterar seu próprio papel ou permissões',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (dto.role !== undefined && dto.role !== user.role) {
      this.assertCanAssignRole(actor, dto.role);
      if (user.role === UserRole.OWNER) {
        await this.ensureNotLastOwner(tenantId, user.id);
      }
    }

    if (dto.permissions !== undefined) {
      this.assertCanGrantPermissions(actor, dto.permissions);
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      await this.ensureEmailAvailable(tenantId, dto.email, user.id);
    }

    const nextRole = dto.role ?? user.role;
    const overrides =
      dto.permissions !== undefined
        ? computeOverrides(nextRole, dto.permissions)
        : undefined;

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(overrides !== undefined && {
          permissionOverrides: overrides as Prisma.InputJsonValue,
        }),
      },
      select: userSelect,
    });
    await this.audit.log({
      tenantId,
      userId: actor.userId,
      userName: actor.email,
      action: 'user.update',
      entity: 'User',
      entityId: updated.id,
      metadata: { changes: Object.keys(dto) },
    });
    return toUserView(updated);
  }

  async updatePassword(
    tenantId: string,
    id: string,
    dto: UpdateUserPasswordDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { id: user.id };
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (user.id === actorId) {
      throw new ConflictException('Você não pode excluir o próprio usuário');
    }
    if (user.role === UserRole.OWNER) {
      await this.ensureNotLastOwner(tenantId, user.id);
    }

    const [sales, cashRegisters, stockMovements] = await this.prisma.$transaction(
      [
        this.prisma.sale.count({ where: { createdById: user.id } }),
        this.prisma.cashRegister.count({ where: { openedById: user.id } }),
        this.prisma.stockMovement.count({ where: { createdById: user.id } }),
      ],
    );
    if (sales + cashRegisters + stockMovements > 0) {
      throw new ConflictException(
        'Este usuário possui histórico (vendas, caixa ou estoque). Inative-o em vez de excluir.',
      );
    }

    await this.prisma.user.delete({ where: { id: user.id } });
    await this.audit.log({
      tenantId,
      userId: actorId,
      action: 'user.delete',
      entity: 'User',
      entityId: user.id,
      metadata: { email: user.email },
    });
    return { id: user.id };
  }

  private assertCanAssignRole(actor: AuthUser, role: UserRole) {
    const canManageOwners: boolean = actor.permissions.includes(
      'owners.manage' as Permission,
    );
    if (role === UserRole.OWNER && !canManageOwners) {
      throw new ForbiddenException(
        'Apenas quem pode definir proprietários pode atribuir este papel',
      );
    }
  }

  private assertCanGrantPermissions(actor: AuthUser, desired: Permission[]) {
    const notOwned = desired.filter(
      (permission) => !actor.permissions.includes(permission),
    );
    if (notOwned.length > 0) {
      throw new ForbiddenException(
        'Você não pode conceder permissões que não possui',
      );
    }
  }

  private async ensureEmailAvailable(
    tenantId: string,
    email: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: email.toLowerCase(),
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }
  }

  private async ensureNotLastOwner(tenantId: string, excludeId: string) {
    const owners = await this.prisma.user.count({
      where: {
        tenantId,
        role: UserRole.OWNER,
        active: true,
        NOT: { id: excludeId },
      },
    });
    if (owners === 0) {
      throw new ConflictException(
        'É necessário manter ao menos um proprietário ativo',
      );
    }
  }
}
