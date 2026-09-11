import { Global, Module } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';
import { tenantContext } from './tenant-context.js';

function createPrismaClient(): PrismaService {
  const base = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL,
    }),
  });

  const proxy = new Proxy(base, {
    get(target, property, receiver) {
      const client = tenantContext.get() ?? target;
      const value = Reflect.get(client, property, receiver);
      return typeof value === 'function' ? value.bind(client) : value;
    },
  });

  return proxy as unknown as PrismaService;
}

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: createPrismaClient,
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
