import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the connection URL out of `schema.prisma` and into this file.
 *
 * The fallback mirrors `env.example` (and `docker-compose.yml`), so the CLI works in a
 * fresh checkout with no `.env`: `prisma generate` needs a URL shape, not a live database.
 * `prisma migrate` still needs the real Postgres instance to be up.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://citera:citera@localhost:5432/citera?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: DATABASE_URL,
  },
});
