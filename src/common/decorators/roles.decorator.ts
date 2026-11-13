import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../prisma/generated/client.js';

export const ROLES_KEY = 'citera:roles';

/** Restrict a route to the given account roles. Requires @UseGuards(WebsiteGuard). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
