import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

/**
 * Cobre o fluxo crítico do PDV de ponta a ponta contra um banco real:
 * cadastro de loja -> login -> abrir caixa -> criar produto -> vender ->
 * fechar caixa. Um bug de integração (ex.: contrato de payload divergente
 * entre front e back) quebraria algum desses passos mesmo com os testes
 * unitários todos verdes.
 */
describe('Fluxo crítico do PDV (e2e)', () => {
  let app: INestApplication<App>;
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const tenantSlug = `e2e-${runId}`;
  const ownerEmail = `owner-${runId}@e2e.local`;
  const ownerPassword = 'Senha@1234';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let accessToken: string;
  let productId: string;

  it('cadastra a loja e o dono, e já retorna os tokens de sessão', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        tenantName: 'Loja E2E',
        tenantSlug,
        name: 'Dono E2E',
        email: ownerEmail,
        password: ownerPassword,
        acceptedTerms: true,
      })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.role).toBe('OWNER');
    expect(res.body.user.tenant.slug).toBe(tenantSlug);
    accessToken = res.body.accessToken;
  });

  it('faz login com e-mail/senha/loja recém-criados', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tenantSlug, email: ownerEmail, password: ownerPassword })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    accessToken = res.body.accessToken;
  });

  it('recusa login com senha errada', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ tenantSlug, email: ownerEmail, password: 'senha-errada' })
      .expect(401);
  });

  it('não abre o PDV sem token', async () => {
    await request(app.getHttpServer()).get('/api/cash-register/current').expect(401);
  });

  it('abre o caixa com um valor inicial', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cash-register/open')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ openingAmount: 100 })
      .expect(201);

    expect(res.body.status).toBe('OPEN');
    expect(res.body.openingAmount).toBe('100');
  });

  it('cadastra um produto para vender', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Produto E2E', price: 25.5, stock: 10 })
      .expect(201);

    expect(res.body.id).toEqual(expect.any(String));
    productId = res.body.id;
  });

  it('finaliza uma venda paga em dinheiro e baixa o estoque', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [{ productId, quantity: 2 }],
        payments: [{ method: 'CASH', amount: 51 }],
      })
      .expect(201);

    expect(res.body.status).toBe('FINISHED');
    expect(res.body.total).toBe('51');

    const product = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(product.body.stock).toBe('8');
  });

  it('reflete a venda no resumo do caixa aberto', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cash-register/current')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.summary.salesCount).toBe(1);
    expect(res.body.summary.salesTotal).toBe(51);
    expect(res.body.summary.expectedCash).toBe(151);
  });

  it('fecha o caixa com o valor esperado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cash-register/close')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ closingAmount: 151 })
      .expect(201);

    expect(res.body.register.status).toBe('CLOSED');
  });

  it('recusa vender com o caixa fechado', async () => {
    await request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [{ productId, quantity: 1 }],
        payments: [{ method: 'CASH', amount: 25.5 }],
      })
      .expect(409);
  });

  it('não abre um segundo caixa sem fechar o anterior primeiro (caixa já fechado, então abre normalmente)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cash-register/open')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ openingAmount: 0 })
      .expect(201);

    expect(res.body.status).toBe('OPEN');

    await request(app.getHttpServer())
      .post('/api/cash-register/open')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ openingAmount: 0 })
      .expect(409);
  });
});
