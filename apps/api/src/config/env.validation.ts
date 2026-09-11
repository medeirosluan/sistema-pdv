const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

const WEAK_MARKERS = ['dev-secret', 'troque-por', 'changeme', 'secret'];

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => {
    const value = config[key];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${missing.join(', ')}. Configure o .env.`,
    );
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('PORT inválido (deve ser um número entre 1 e 65535).');
  }

  const nodeEnv = String(config.NODE_ENV ?? 'development');
  if (nodeEnv === 'production') {
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      const value = String(config[key]);
      const weak = WEAK_MARKERS.some((marker) =>
        value.toLowerCase().includes(marker),
      );
      if (weak || value.length < 24) {
        throw new Error(
          `${key} está fraco para produção (mínimo 24 caracteres e sem valores padrão).`,
        );
      }
    }
  }

  return config;
}
