import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Membership, Website } from '../../prisma/generated/client.js';

export interface AuthUser {
  sub: string;
  email: string;
}

/** `@CurrentUser()` returns the JWT payload; `@CurrentUser('sub')` returns one field. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) return undefined;
    return field ? user[field] : user;
  },
);

/** The website resolved by WebsiteGuard, plus the caller's membership in its account. */
export const CurrentWebsite = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ website?: Website; membership?: Membership }>();
    return request.website;
  },
);

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ membership?: Membership }>();
    return request.membership;
  },
);
