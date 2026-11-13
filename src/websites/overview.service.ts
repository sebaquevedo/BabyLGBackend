import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityKind, IntegrationKind, IntegrationStatus, PlanItemStatus } from '../prisma/generated/client.js';
import {
  ACTIVITY_ITEM_CAP,
  type ActivityItem,
  type ActivityItemKind,
  type ActivityMeta,
  type NextStep,
  type OverviewDto,
} from './overview.types.js';

/**
 * `ActivityKind` is the authoritative list of events. The API exposes it in snake_case, which
 * is the mapping the front binds against; the contract's earlier example
 * (`article_drafted`, `backlink_joined`, `keyword_planned`) named events that do not exist as
 * kinds, so the enum wins and the contract was corrected.
 */
const ACTIVITY_KIND: Record<ActivityKind, ActivityItemKind> = {
  ARTICLE_PUBLISHED: 'article_published',
  TOPIC_RESEARCHED: 'topic_researched',
  ARTICLE_IMPROVED: 'article_improved',
  BACKLINK_ADDED: 'backlink_added',
  SOCIAL_OPPORTUNITY_FOUND: 'social_opportunity_found',
  SOCIAL_REPLIED: 'social_replied',
  SCAN_COMPLETED: 'scan_completed',
  VISIBILITY_RUN_COMPLETED: 'visibility_run_completed',
  FAILED: 'failed',
};

/** Plan statuses that count as "still work in the pipeline" for the queue summary. */
const QUEUED_STATUSES: PlanItemStatus[] = [
  PlanItemStatus.QUEUED,
  PlanItemStatus.RESEARCHING,
  PlanItemStatus.WRITING,
  PlanItemStatus.READY,
  PlanItemStatus.APPROVED,
  PlanItemStatus.SCHEDULED,
  PlanItemStatus.PUBLISHING,
];

/** Statuses that mean an agent is actively working right now. */
const RUNNING_STATUSES: PlanItemStatus[] = [
  PlanItemStatus.RESEARCHING,
  PlanItemStatus.WRITING,
  PlanItemStatus.PUBLISHING,
];

const DEFAULT_HREF: Record<ActivityItemKind, string> = {
  article_published: '/content-plan',
  topic_researched: '/content-plan',
  article_improved: '/content-plan',
  backlink_added: '/backlinks',
  social_opportunity_found: '/socials',
  social_replied: '/socials',
  scan_completed: '/site-health',
  visibility_run_completed: '/ai-visibility',
  failed: '/site-health',
};

/** `en-CA` formats as YYYY-MM-DD, which is the wire format the day stepper posts back. */
function isoDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Offset of `timeZone` at a given instant, in milliseconds, read from the ICU data. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? '');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * ((Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000);
}

/**
 * UTC window for a calendar day in `timeZone`. Used to answer "what happened that day" without
 * storing a per-site day column: the day is a view, the instants are the data.
 */
function dayWindow(day: string, timeZone: string): { start: Date; end: Date } {
  const midnightUtc = new Date(`${day}T00:00:00.000Z`);
  const start = new Date(midnightUtc.getTime() - zoneOffsetMs(midnightUtc, timeZone));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}

function scoreStatus(overall: number): 'good' | 'warn' | 'bad' {
  if (overall >= 80) return 'good';
  if (overall >= 50) return 'warn';
  return 'bad';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async build(websiteId: string, day?: string): Promise<OverviewDto> {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: { brandProfile: true },
    });

    if (!website) {
      throw new NotFoundException({
        code: 'website_not_found',
        message: 'The website was not found.',
      });
    }

    const timeZone = website.timezone;
    const date = day ?? isoDay(new Date(), timeZone);
    const window = dayWindow(date, timeZone);

    const [
      activities,
      activityTotal,
      brand,
      logo,
      latestScan,
      scanCount,
      promptCount,
      runCount,
      mentionCount,
      backlinkAccount,
      exchangeCounts,
      planCounts,
      runningCount,
      integrations,
    ] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { websiteId, createdAt: { gte: window.start, lt: window.end } },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_ITEM_CAP,
      }),
      this.prisma.activityLog.count({
        where: { websiteId, createdAt: { gte: window.start, lt: window.end } },
      }),
      Promise.resolve(website.brandProfile),
      website.brandProfile?.logoAssetId
        ? this.prisma.asset.findUnique({
            where: { id: website.brandProfile.logoAssetId },
            select: { url: true },
          })
        : Promise.resolve(null),
      this.prisma.siteScan.findFirst({
        where: { websiteId },
        orderBy: { createdAt: 'desc' },
        include: { issues: { select: { severity: true } } },
      }),
      this.prisma.siteScan.count({ where: { websiteId } }),
      this.prisma.aiPrompt.count({ where: { websiteId, enabled: true } }),
      this.prisma.aiRun.count({ where: { prompt: { websiteId } } }),
      this.prisma.aiRun.count({ where: { prompt: { websiteId }, brandMentioned: true } }),
      this.prisma.backlinkAccount.findUnique({ where: { websiteId } }),
      this.prisma.backlinkExchange.groupBy({
        by: ['status'],
        where: { websiteId },
        _count: { _all: true },
      }),
      this.prisma.contentPlanItem.groupBy({
        by: ['status'],
        where: { websiteId },
        _count: { _all: true },
      }),
      this.prisma.contentPlanItem.count({
        where: { websiteId, status: { in: RUNNING_STATUSES } },
      }),
      this.prisma.integration.findMany({
        where: { websiteId },
        select: { kind: true, status: true, lastSyncAt: true, updatedAt: true },
      }),
    ]);

    const issueCounts = { high: 0, medium: 0, low: 0 };
    for (const issue of latestScan?.issues ?? []) {
      if (issue.severity === 'HIGH') issueCounts.high += 1;
      else if (issue.severity === 'MEDIUM') issueCounts.medium += 1;
      else issueCounts.low += 1;
    }

    const published = planCounts
      .filter((row) => row.status === PlanItemStatus.PUBLISHED)
      .reduce((sum, row) => sum + row._count._all, 0);
    const queued = planCounts
      .filter((row) => QUEUED_STATUSES.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);

    const liveExchanges =
      exchangeCounts.find((row) => row.status === 'LIVE')?._count._all ?? 0;
    const acceptedExchanges =
      exchangeCounts.find((row) => row.status === 'ACCEPTED')?._count._all ?? 0;

    const items: ActivityItem[] = activities.map((activity) => {
      const payload = asRecord(activity.payload);
      const kind = ACTIVITY_KIND[activity.kind];
      const meta: ActivityMeta = {
        targetKeyword: asString(payload.targetKeyword),
        status: asString(payload.status),
      };

      // Provenance travels with article activities only; for every other kind the keys are
      // meaningless and sending them null would imply they were measured.
      if (kind === 'article_published' || kind === 'article_improved') {
        const approvedBy = asRecord(payload.approvedBy);
        meta.model = asString(payload.model);
        meta.promptVersion = asString(payload.promptVersion);
        meta.revisionCount = asNumber(payload.revisionCount);
        meta.approvedBy = asString(approvedBy.id)
          ? { id: approvedBy.id as string, name: asString(approvedBy.name) ?? '' }
          : null;
      }

      return {
        id: activity.id,
        kind,
        title: asString(payload.title) ?? kind.replaceAll('_', ' '),
        summary: asString(payload.summary),
        occurredAt: activity.createdAt.toISOString(),
        href: asString(payload.href) ?? DEFAULT_HREF[kind],
        thumbnailUrl: asString(payload.thumbnailUrl),
        meta,
        viewedAt: asString(payload.viewedAt),
      };
    });

    const lastRunAt = activities[0]?.createdAt ?? latestScan?.createdAt ?? null;

    return {
      date,
      timezone: timeZone,
      agents: { running: runningCount > 0, lastRunAt: lastRunAt?.toISOString() ?? null },
      activity: { total: activityTotal, items },
      learnings: {
        updatedAt: brand?.updatedAt.toISOString() ?? null,
        // The API does not compose sentences: the UI owns the copy, this stays null until a
        // generated summary is actually stored.
        summary: null,
        facts: [
          { label: 'site', value: website.domain },
          { label: 'language', value: website.language },
          { label: 'timezone', value: timeZone },
          { label: 'scans', value: String(scanCount) },
        ],
      },
      scores: {
        siteHealth: latestScan
          ? {
              overall: latestScan.score,
              status: scoreStatus(latestScan.score),
              pageSpeed: latestScan.pageSpeed,
              llmOptimization: latestScan.llmScore,
              technicalSeo: latestScan.technicalSeo,
              issueCounts,
            }
          : null,
        aiVisibility:
          runCount > 0
            ? {
                score: Math.round((mentionCount / runCount) * 100),
                prompts: promptCount,
                answers: runCount,
                mentions: mentionCount,
              }
            : null,
        backlinks: backlinkAccount
          ? {
              credits: backlinkAccount.credits,
              // First cut of the mapping: LIVE = a link we received, ACCEPTED = one we committed
              // to giving. The backlink slice will refine this against the exchange lifecycle.
              received: liveExchanges,
              given: acceptedExchanges,
              domainRating: backlinkAccount.domainRating,
            }
          : null,
        contentPlan: { published, queued },
      },
      nextSteps: this.nextSteps(website.domain, integrations),
      brandSummary: {
        name: website.name,
        domain: website.domain,
        industry: null,
        positioning: brand?.positioning ?? null,
        logoUrl: logo?.url ?? null,
        colors: {
          primary: brand?.colorPrimary ?? null,
          secondary: brand?.colorSecondary ?? null,
        },
      },
    };
  }

  /**
   * Derived, not stored: the "get started" rail is a function of integration state, so it can
   * never go stale. `required` gates value, `optional` only adds it — exactly two values.
   */
  private nextSteps(
    domain: string,
    integrations: Array<{
      kind: IntegrationKind;
      status: IntegrationStatus;
      lastSyncAt: Date | null;
      updatedAt: Date;
    }>,
  ): NextStep[] {
    const find = (kind: IntegrationKind) => integrations.find((row) => row.kind === kind);
    const doneAt = (kind: IntegrationKind): string | null => {
      const row = find(kind);
      if (!row || row.status !== IntegrationStatus.CONNECTED) return null;
      return (row.lastSyncAt ?? row.updatedAt).toISOString();
    };

    return [
      {
        id: 'wordpress',
        kind: 'required',
        title: 'WordPress conectado',
        description: domain,
        href: '/settings/publishing',
        doneAt: doneAt(IntegrationKind.WORDPRESS),
      },
      {
        id: 'search-console',
        kind: 'optional',
        title: 'Conectar Google Search Console',
        description: null,
        href: '/settings/analytics',
        doneAt: doneAt(IntegrationKind.GOOGLE_SEARCH_CONSOLE),
      },
      {
        id: 'analytics',
        kind: 'optional',
        title: 'Conectar Google Analytics',
        description: null,
        href: '/settings/analytics',
        doneAt: doneAt(IntegrationKind.GOOGLE_ANALYTICS),
      },
      {
        id: 'instagram',
        kind: 'optional',
        title: 'Conectar Instagram',
        description: null,
        href: '/settings/socials',
        doneAt: doneAt(IntegrationKind.INSTAGRAM_FACEBOOK),
      },
      {
        id: 'branding',
        kind: 'optional',
        title: 'Completar la identidad de marca',
        description: null,
        href: '/settings/branding',
        doneAt: null,
      },
    ];
  }
}
