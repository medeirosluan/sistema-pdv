import type { NextFunction, Request, Response } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(key, entry);
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, options.max - entry.count),
    );

    if (entry.count > options.max) {
      res.status(429).json({
        statusCode: 429,
        message:
          options.message ??
          'Muitas requisições. Aguarde alguns instantes e tente novamente.',
      });
      return;
    }

    next();
  };
}
