import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { createHash } from 'node:crypto';

/**
 * These are integration tests on purpose: the whole point of the refresh design is what the
 * database remembers, and a mocked Prisma would happily "pass" a rotation that never rotates.
 *
 * Requires the local Postgres from docker-compose (see README). It writes only users whose
 * email ends in `@test.citera.local` and deletes them again in afterAll.
 */
const EMAIL_DOMAIN = '@test.citera.local';

function password(): string {
  return `pw-${Math.random().toString(36).slice(2)}-test`;
}

function hashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService — refresh rotation', () => {
  let service: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
    process.env.JWT_ACCESS_TTL_SECONDS ??= '900';

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, JwtModule.register({})],
      providers: [AuthService],
    }).compile();

    service = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.$disconnect();
  });

  async function registerUser(tag: string) {
    return service.register({
      email: `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${EMAIL_DOMAIN}`,
      password: password(),
      name: `Test ${tag}`,
    });
  }

  it('S1 register creates an OWNER membership and stores only the hash of the refresh token', async () => {
    const result = await registerUser('s1');

    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(result.user.accounts).toHaveLength(1);
    expect(result.user.accounts[0]?.role).toBe('OWNER');

    const sessions = await prisma.refreshSession.findMany({
      where: { userId: result.user.id },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe(hashOf(result.tokens.refreshToken));
    // The raw token must never be recoverable from the row.
    expect(JSON.stringify(sessions[0])).not.toContain(result.tokens.refreshToken);
  });

  it('S2 refresh rotates: the presented token is retired and the new one works', async () => {
    const first = await registerUser('s2');
    const rotated = await service.refresh(first.tokens.refreshToken);

    expect(rotated.tokens.refreshToken).not.toBe(first.tokens.refreshToken);

    const oldRow = await prisma.refreshSession.findUnique({
      where: { tokenHash: hashOf(first.tokens.refreshToken) },
    });
    expect(oldRow?.revokedAt).toBeInstanceOf(Date);
    expect(oldRow?.replacedByHash).toBe(hashOf(rotated.tokens.refreshToken));

    // The new token is live: a second rotation succeeds.
    const again = await service.refresh(rotated.tokens.refreshToken);
    expect(again.tokens.refreshToken).toBeTruthy();
  });

  it('S3 reusing a rotated token revokes the whole family, including the current token', async () => {
    const first = await registerUser('s3');
    const second = await service.refresh(first.tokens.refreshToken);

    // Replay the retired token: this is what a stolen copy looks like.
    await expect(service.refresh(first.tokens.refreshToken)).rejects.toMatchObject({
      response: { code: 'refresh_reuse_detected' },
    });

    // The legitimate client's *current* token must now be dead too.
    await expect(service.refresh(second.tokens.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const live = await prisma.refreshSession.count({
      where: { userId: first.user.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });

  it('S4 logout revokes the family, and an unknown token is not an error', async () => {
    const registered = await registerUser('s4');

    await service.logout(registered.tokens.refreshToken);
    await expect(service.refresh(registered.tokens.refreshToken)).rejects.toMatchObject({
      response: { code: 'refresh_reuse_detected' },
    });

    await expect(service.logout(undefined)).resolves.toBeUndefined();
    await expect(service.logout('not-a-real-token')).resolves.toBeUndefined();
  });

  it('S5 a garbage token is rejected without touching the database', async () => {
    await expect(service.refresh('eyJhbGciOiJIUzI1NiJ9.garbage.garbage')).rejects.toMatchObject({
      response: { code: 'invalid_refresh_token' },
    });
  });
});
