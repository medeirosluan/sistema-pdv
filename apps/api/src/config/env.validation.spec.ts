import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('aceita configuração válida', () => {
    expect(validateEnv({ ...base })).toMatchObject(base);
  });

  it('lança erro quando falta variável obrigatória', () => {
    const config = { ...base } as Record<string, unknown>;
    delete config.DATABASE_URL;
    expect(() => validateEnv(config)).toThrow(/DATABASE_URL/);
  });

  it('lança erro para PORT inválida', () => {
    expect(() => validateEnv({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejeita segredo fraco em produção', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'dev-secret',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('aceita segredos fortes em produção', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'x'.repeat(40),
        JWT_REFRESH_SECRET: 'y'.repeat(40),
      }),
    ).not.toThrow();
  });
});
