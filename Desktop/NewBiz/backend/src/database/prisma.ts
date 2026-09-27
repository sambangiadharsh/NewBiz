import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      config.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (config.NODE_ENV === 'development') {
  type QueryEvent = { query: string; params: string; duration: number };
  (prisma as unknown as { $on: (event: string, cb: (e: QueryEvent) => void) => void }).$on(
    'query',
    (e: QueryEvent) => {
      logger.debug(`Prisma Query [${e.duration}ms]: ${e.query}`, e.params, 'Database');
    }
  );
}

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
