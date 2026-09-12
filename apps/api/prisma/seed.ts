/**
 * Seed de dados de demonstração — cria uma loja de exemplo com catálogo,
 * clientes e um usuário OWNER para testar o sistema sem precisar cadastrar
 * tudo manualmente.
 *
 * Uso: npm run db:seed --workspace apps/api
 * Slug customizado (ex.: para não colidir com um tenant real): SEED_TENANT_SLUG=minha-loja-demo npm run db:seed --workspace apps/api
 *
 * Idempotente apenas para o próprio tenant de seed: se o slug já existir e
 * pertencer a uma loja com uso real (vendas registradas), o script aborta
 * em vez de inserir dados nela — evita poluir um tenant de verdade que por
 * acaso tenha o mesmo slug.
 *
 * Conecta direto com DATABASE_URL (role superuser), como as migrations —
 * o RLS não se aplica aqui porque não há requisição/contexto de tenant.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const DEMO_TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? 'loja-demonstracao';
const DEMO_OWNER_EMAIL = 'demo@sistemapdv.com';
const DEMO_OWNER_PASSWORD = 'Demo@1234';

const CATEGORIES = ['Bebidas', 'Padaria', 'Mercearia', 'Limpeza'];

const PRODUCTS: {
  name: string;
  category: string;
  barcode: string;
  price: number;
  cost: number;
  unit: string;
  stock: number;
  minStock: number;
}[] = [
  {
    name: 'Coca-Cola 350ml',
    category: 'Bebidas',
    barcode: '7894900011517',
    price: 5.5,
    cost: 3.2,
    unit: 'UN',
    stock: 48,
    minStock: 12,
  },
  {
    name: 'Água Mineral 500ml',
    category: 'Bebidas',
    barcode: '7891910000197',
    price: 3.0,
    cost: 1.4,
    unit: 'UN',
    stock: 60,
    minStock: 15,
  },
  {
    name: 'Suco de Laranja 1L',
    category: 'Bebidas',
    barcode: '7891000100103',
    price: 8.9,
    cost: 5.5,
    unit: 'UN',
    stock: 20,
    minStock: 6,
  },
  {
    name: 'Pão Francês',
    category: 'Padaria',
    barcode: '2000000000015',
    price: 14.9,
    cost: 8.0,
    unit: 'KG',
    stock: 8,
    minStock: 3,
  },
  {
    name: 'Bolo de Fubá',
    category: 'Padaria',
    barcode: '2000000000022',
    price: 22.0,
    cost: 12.0,
    unit: 'UN',
    stock: 5,
    minStock: 2,
  },
  {
    name: 'Arroz 5kg',
    category: 'Mercearia',
    barcode: '7896004400015',
    price: 24.9,
    cost: 18.0,
    unit: 'UN',
    stock: 15,
    minStock: 4,
  },
  {
    name: 'Feijão Carioca 1kg',
    category: 'Mercearia',
    barcode: '7896004400206',
    price: 8.5,
    cost: 5.8,
    unit: 'UN',
    stock: 25,
    minStock: 8,
  },
  {
    name: 'Óleo de Soja 900ml',
    category: 'Mercearia',
    barcode: '7891107100236',
    price: 7.99,
    cost: 5.2,
    unit: 'UN',
    stock: 18,
    minStock: 6,
  },
  {
    name: 'Detergente Neutro 500ml',
    category: 'Limpeza',
    barcode: '7891024132009',
    price: 2.99,
    cost: 1.6,
    unit: 'UN',
    stock: 30,
    minStock: 10,
  },
  {
    name: 'Água Sanitária 1L',
    category: 'Limpeza',
    barcode: '7891024135017',
    price: 5.49,
    cost: 3.1,
    unit: 'UN',
    stock: 2,
    minStock: 5,
  },
];

const CUSTOMERS = [
  { name: 'Ana Souza', document: '111.111.111-11', phone: '11999990001' },
  { name: 'Carlos Lima', document: '222.222.222-22', phone: '11999990002' },
  { name: 'Juliana Alves', document: '333.333.333-33', phone: '11999990003' },
];

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const existing = await prisma.tenant.findUnique({
      where: { slug: DEMO_TENANT_SLUG },
      include: { _count: { select: { sales: true } } },
    });
    if (existing && existing._count.sales > 0) {
      throw new Error(
        `O tenant "${DEMO_TENANT_SLUG}" já existe e tem ${existing._count.sales} venda(s) registrada(s) — ` +
          'parece ser uma loja real, não vou inserir dados de demonstração nela. ' +
          'Rode com SEED_TENANT_SLUG=outro-slug para usar um slug diferente.',
      );
    }

    const tenant = await prisma.tenant.upsert({
      where: { slug: DEMO_TENANT_SLUG },
      update: {},
      create: {
        name: 'Loja Demonstração',
        slug: DEMO_TENANT_SLUG,
        plan: 'PRO',
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
      },
    });
    console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

    const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, 10);
    const owner = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: DEMO_OWNER_EMAIL },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Proprietário Demo',
        email: DEMO_OWNER_EMAIL,
        passwordHash,
        role: 'OWNER',
      },
    });
    console.log(`Usuário: ${owner.email} / senha: ${DEMO_OWNER_PASSWORD}`);

    const categoryByName = new Map<string, string>();
    for (const name of CATEGORIES) {
      const category = await prisma.category.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        update: {},
        create: { tenantId: tenant.id, name },
      });
      categoryByName.set(name, category.id);
    }
    console.log(`Categorias: ${CATEGORIES.length}`);

    for (const product of PRODUCTS) {
      await prisma.product.upsert({
        where: {
          tenantId_barcode: { tenantId: tenant.id, barcode: product.barcode },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          categoryId: categoryByName.get(product.category) ?? null,
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          cost: product.cost,
          unit: product.unit,
          stock: product.stock,
          minStock: product.minStock,
        },
      });
    }
    console.log(`Produtos: ${PRODUCTS.length}`);

    for (const customer of CUSTOMERS) {
      const existing = await prisma.customer.findFirst({
        where: { tenantId: tenant.id, document: customer.document },
      });
      if (!existing) {
        await prisma.customer.create({
          data: { tenantId: tenant.id, ...customer },
        });
      }
    }
    console.log(`Clientes: ${CUSTOMERS.length}`);

    console.log('\nSeed concluído. Login de demonstração:');
    console.log(`  Loja: ${DEMO_TENANT_SLUG}`);
    console.log(`  E-mail: ${DEMO_OWNER_EMAIL}`);
    console.log(`  Senha: ${DEMO_OWNER_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
