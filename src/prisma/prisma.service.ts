import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

/**
 * Prisma 7 requires a driver adapter instead of a connection URL in the schema.
 * The URL lives in `prisma.config.ts` for the CLI and here for the runtime.
 *
 * Read in the constructor, never at module scope: a module-level constant is evaluated when
 * the file is imported, which is before `.env` has been loaded — that is how you end up
 * connecting to the wrong Postgres and getting a credentials error that looks like a bug.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString:
          process.env.DATABASE_URL ??
          'postgresql://citera:citera@localhost:5432/citera?schema=public',
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
