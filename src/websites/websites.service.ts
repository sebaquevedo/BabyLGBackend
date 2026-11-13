import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role } from '../prisma/generated/client.js';
import { OverviewService } from './overview.service.js';
import type { OverviewDto } from './overview.types.js';
import type { CreateWebsiteDto, UpdateWebsiteDto } from './dto/website.dto.js';

/** Roles allowed to create or mutate a website. EDITOR reads and writes content only. */
const WRITE_ROLES: Role[] = [Role.OWNER, Role.ADMIN];

@Injectable()
export class WebsitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overviewService: OverviewService,
  ) {}

  /** Every site the caller can see, through a membership. Empty list is not an error. */
  async list(userId: string) {
    const websites = await this.prisma.website.findMany({
      where: { account: { memberships: { some: { userId } } } },
      orderBy: { createdAt: 'asc' },
    });
    return { data: websites };
  }

  async create(userId: string, dto: CreateWebsiteDto) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        role: { in: WRITE_ROLES },
        ...(dto.accountId ? { accountId: dto.accountId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 'forbidden_role',
        message: 'Only an owner or admin can add a website.',
      });
    }

    this.assertTimezone(dto.timezone);

    const domain = normalizeDomain(dto.domain);
    if (!isBareDomain(domain)) {
      throw new BadRequestException({
        code: 'domain_invalid',
        message: 'That does not look like a domain.',
      });
    }

    try {
      const website = await this.prisma.website.create({
        data: {
          accountId: membership.accountId,
          domain,
          name: dto.name.trim(),
          ...(dto.language ? { language: dto.language } : {}),
          ...(dto.timezone ? { timezone: dto.timezone } : {}),
          ...(dto.autoPublish !== undefined ? { autoPublish: dto.autoPublish } : {}),
          ...(dto.publishHour !== undefined ? { publishHour: dto.publishHour } : {}),
        },
      });
      return website;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'website_domain_taken',
          message: 'That domain is already in this account.',
        });
      }
      throw error;
    }
  }

  async findOne(websiteId: string) {
    const website = await this.prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw notFound();
    return website;
  }

  async update(websiteId: string, dto: UpdateWebsiteDto) {
    this.assertTimezone(dto.timezone);

    return this.prisma.website.update({
      where: { id: websiteId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.autoPublish !== undefined ? { autoPublish: dto.autoPublish } : {}),
        ...(dto.publishHour !== undefined ? { publishHour: dto.publishHour } : {}),
      },
    });
  }

  async remove(websiteId: string): Promise<void> {
    await this.prisma.website.delete({ where: { id: websiteId } });
  }

  async overview(websiteId: string, date?: string): Promise<OverviewDto> {
    return this.overviewService.build(websiteId, date);
  }

  /**
   * A bad timezone is a 400, not a 500 at publish time: `America/Santiago` is what the scheduler
   * and the day boundary both depend on, so it is validated where it enters.
   */
  private assertTimezone(timezone: string | undefined): void {
    if (!timezone) return;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new BadRequestException({
        code: 'timezone_invalid',
        message: 'That timezone is not a valid IANA identifier.',
      });
    }
  }
}

/** `https://Kinesilk.cl/` and `kinesilk.cl` are the same site; the column is unique per account. */
function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/** The stored shape: bare host, at least one dot, no scheme, no trailing slash. */
const BARE_DOMAIN = /^(?=.{3,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isBareDomain(domain: string): boolean {
  return BARE_DOMAIN.test(domain);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'website_not_found',
    message: 'The website was not found.',
  });
}
