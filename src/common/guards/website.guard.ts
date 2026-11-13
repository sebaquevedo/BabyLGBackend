import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Membership, Website } from '../../prisma/generated/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';

interface RequestWithScope {
  params: Record<string, string | undefined>;
  user?: AuthUser;
  website?: Website;
  membership?: Membership;
}

/**
 * Resolves :websiteId (or :id on website routes) against the caller's memberships and
 * attaches the website plus the membership to the request.
 *
 * A site the caller cannot see answers 404, never 403: existence is not leaked.
 */
@Injectable()
export class WebsiteGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithScope>();
    const websiteId = request.params.websiteId ?? request.params.id;
    const userId = request.user?.sub;

    if (!websiteId || !userId) {
      throw new NotFoundException({
        code: 'website_not_found',
        message: 'The website was not found.',
      });
    }

    const website = await this.prisma.website.findFirst({
      where: { id: websiteId, account: { memberships: { some: { userId } } } },
    });

    if (!website) {
      throw new NotFoundException({
        code: 'website_not_found',
        message: 'The website was not found.',
      });
    }

    const membership = await this.prisma.membership.findFirst({
      where: { accountId: website.accountId, userId },
    });

    if (!membership) {
      throw new NotFoundException({
        code: 'website_not_found',
        message: 'The website was not found.',
      });
    }

    request.website = website;
    request.membership = membership;
    return true;
  }
}
