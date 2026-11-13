import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/decorators/current-user.decorator.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';

const SCRYPT_KEYLEN = 64;

/** Who is asking for a token. Used for the audit columns, never for authorisation. */
export interface TokenContext {
  userAgent?: string;
  ip?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Absolute expiry of the refresh token, so the controller can mirror it on the cookie. */
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: ReturnType<AuthService['publicUser']>;
  tokens: TokenPair;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Refresh tokens are opaque to the database: only their hash is stored. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto, context: TokenContext = {}): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'email_taken',
        message: 'That email already has an account.',
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: hashPassword(dto.password),
        memberships: {
          create: {
            role: 'OWNER',
            account: {
              create: { name: dto.accountName?.trim() || `${dto.name.trim()}'s workspace` },
            },
          },
        },
      },
      include: { memberships: { include: { account: true } } },
    });

    return {
      user: this.publicUser(user),
      tokens: await this.issueTokens({ sub: user.id, email: user.email }, context),
    };
  }

  async login(dto: LoginDto, context: TokenContext = {}): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { account: true } } },
    });

    // Same response for unknown email and wrong password: no account enumeration.
    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException({
        code: 'invalid_credentials',
        message: 'Email or password is incorrect.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: this.publicUser(user),
      tokens: await this.issueTokens({ sub: user.id, email: user.email }, context),
    };
  }

  /**
   * Rotates a refresh token.
   *
   * Order matters: the signature is checked first (cheap rejection of garbage), then the
   * persisted session decides. A token that verifies but whose row is already revoked is a
   * *reused* token, which means it leaked — the whole family dies, including the token the
   * legitimate client is holding right now. That is why the front must refresh single-flight.
   */
  async refresh(refreshToken: string, context: TokenContext = {}): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'invalid_refresh_token',
        message: 'Sign in again.',
      });
    }

    if (session.revokedAt) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException({
        code: 'refresh_reuse_detected',
        message: 'Sign in again.',
      });
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'refresh_expired',
        message: 'Sign in again.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { memberships: { include: { account: true } } },
    });
    if (!user || user.id !== session.userId) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException({
        code: 'invalid_refresh_token',
        message: 'Sign in again.',
      });
    }

    const tokens = await this.issueTokens(
      { sub: user.id, email: user.email },
      context,
      session.familyId,
    );

    // Retire the presented token and remember what replaced it, in one write.
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedByHash: hashToken(tokens.refreshToken),
      },
    });

    return { user: this.publicUser(user), tokens };
  }

  /**
   * Logout is idempotent by design: an unknown, expired or already-revoked token is not an
   * error, because the client is trying to end a session and the outcome is the same.
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (session) await this.revokeFamily(session.familyId);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { include: { account: true } } },
    });

    if (!user) {
      throw new UnauthorizedException({ code: 'user_not_found', message: 'Sign in again.' });
    }

    return this.publicUser(user);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async verifyRefreshToken(token: string): Promise<AuthUser & { typ?: string }> {
    try {
      const payload = await this.jwt.verifyAsync<AuthUser & { typ?: string }>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      if (payload.typ !== 'refresh') throw new Error('wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedException({
        code: 'invalid_refresh_token',
        message: 'Sign in again.',
      });
    }
  }

  private async issueTokens(
    user: AuthUser,
    context: TokenContext,
    familyId: string = randomBytes(16).toString('hex'),
  ): Promise<TokenPair> {
    // TTLs are plain seconds: jsonwebtoken reads a number as seconds, and the same number
    // is what the refresh session stores in `expiresAt`. One unit, no 'ms' strings.
    const accessTtl = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
    const refreshTtl = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 60 * 60 * 24 * 30);
    const refreshExpiresAt = new Date(Date.now() + refreshTtl * 1000);

    const accessToken = this.jwt.sign(
      { sub: user.sub, email: user.email, typ: 'access' },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: accessTtl, jwtid: randomBytes(8).toString('hex') },
    );
    // `jti` is mandatory here, not decorative: a JWT signed twice within the same second with
    // the same payload is byte-identical, and `tokenHash` is unique — rotation would collide.
    const refreshToken = this.jwt.sign(
      { sub: user.sub, email: user.email, typ: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: refreshTtl,
        jwtid: randomBytes(16).toString('hex'),
      },
    );

    await this.prisma.refreshSession.create({
      data: {
        userId: user.sub,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: context.userAgent,
        ip: context.ip,
      },
    });

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  publicUser(user: {
    id: string;
    email: string;
    name: string;
    locale: string;
    memberships?: Array<{ role: string; account: { id: string; name: string; plan: string } }>;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      locale: user.locale,
      accounts:
        user.memberships?.map((m) => ({
          id: m.account.id,
          name: m.account.name,
          plan: m.account.plan,
          role: m.role,
        })) ?? [],
    };
  }
}
