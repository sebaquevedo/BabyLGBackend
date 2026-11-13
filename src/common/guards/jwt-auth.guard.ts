import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../decorators/current-user.decorator.js';

/**
 * Validates the access token and attaches its payload to the request.
 * Any route without this guard is public; keep that list short.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();

    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: 'missing_token',
        message: 'Authorization: Bearer <token> is required.',
      });
    }

    try {
      const payload = await this.jwt.verifyAsync<AuthUser & { typ?: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      if (payload.typ && payload.typ !== 'access') {
        throw new Error('wrong token type');
      }
      request.user = { sub: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'invalid_token',
        message: 'The access token is missing, expired or invalid.',
      });
    }
  }
}
