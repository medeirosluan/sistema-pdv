import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Token de injeção do Prisma. O provedor real é criado no PrismaModule como
 * um Proxy que roteia as operações para a transação da requisição (com RLS)
 * quando houver contexto de tenant, ou para o cliente base caso contrário.
 *
 * O merge interface+classe garante que `PrismaService` exponha todos os
 * métodos do PrismaClient para os serviços (sem mudanças no código deles).
 */
export interface PrismaService extends PrismaClient {}

export class PrismaService {}
