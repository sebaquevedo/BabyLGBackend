import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Membership, Role } from '../../prisma/generated/client.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * Enforces @Roles(...) against the membership resolved by WebsiteGuard.
 * Routes without @Roles only require a valid membership.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ membership?: Membership }>();
    const role = request.membership?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException({
        code: 'insufficient_role',
        message: `This action requires one of: ${required.join(', ')}.`,
      });
    }

    return true;
  }
}
