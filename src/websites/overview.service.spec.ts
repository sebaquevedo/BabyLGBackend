import { Test } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OverviewService } from './overview.service.js';
import {
  ActivityKind,
  IntegrationKind,
  IntegrationStatus,
  IssueCategory,
  PlanItemStatus,
  Role,
  Severity,
} from '../prisma/generated/client.js';

/**
 * Integration tests against the real database: the whole value of this endpoint is the
 * composition, and a mocked Prisma would happily confirm an aggregation that never aggregates.
 *
 * Every fixture is namespaced under an account whose name ends in `@test.citera.local` and is
 * removed in afterAll.
 */
const TAG = '@test.citera.local';

describe('OverviewService — GET /websites/:id/overview', () => {
  let service: OverviewService;
  let prisma: PrismaService;
  let userId: string;
  let accountId: string;
  let richWebsiteId: string;
  let emptyWebsiteId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [OverviewService],
    }).compile();

    service = moduleRef.get(OverviewService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: {
        email: `overview-${stamp}${TAG}`,
        name: 'Overview Test',
        passwordHash: 'scrypt$x$y',
      },
    });
    userId = user.id;

    const account = await prisma.account.create({
      data: { name: `Overview account ${stamp}` },
    });
    accountId = account.id;
    await prisma.membership.create({ data: { accountId, userId, role: Role.OWNER } });

    const rich = await prisma.website.create({
      data: {
        accountId,
        name: 'Kinesilk',
        domain: `kinesilk-${stamp}.cl`,
        timezone: 'America/Santiago',
        autoPublish: false,
        publishHour: 9,
      },
    });
    richWebsiteId = rich.id;

    const empty = await prisma.website.create({
      data: { accountId, name: 'Vacío', domain: `vacio-${stamp}.cl` },
    });
    emptyWebsiteId = empty.id;

    await prisma.brandProfile.create({
      data: {
        websiteId: richWebsiteId,
        positioning: 'Centro de estética láser',
        colorPrimary: '#87E9CE',
        colorSecondary: '#FEAAA4',
      },
    });

    // 25 activities: the feed must cap at 20 and still report the true count.
    const base = Date.now() - 25 * 60_000;
    for (let i = 0; i < 25; i += 1) {
      await prisma.activityLog.create({
        data: {
          websiteId: richWebsiteId,
          kind: ActivityKind.ARTICLE_PUBLISHED,
          createdAt: new Date(base + i * 60_000),
          payload: {
            title: `Artículo ${i}`,
            summary: `Resumen ${i}`,
            href: `/content-plan/articles/${i}`,
            targetKeyword: 'depilación láser',
            status: 'live',
            model: 'claude-sonnet-4-6',
            promptVersion: 'article-v3',
            revisionCount: i,
            approvedBy: { id: userId, name: 'Overview Test' },
          },
        },
      });
    }

    const scan = await prisma.siteScan.create({
      data: {
        websiteId: richWebsiteId,
        score: 82,
        pageSpeed: 100,
        llmScore: 76,
        technicalSeo: 80,
      },
    });
    await prisma.siteIssue.create({
      data: {
        scanId: scan.id,
        severity: Severity.HIGH,
        category: IssueCategory.TECHNICAL_SEO,
        code: 'multiple_canonical',
        message: 'Multiple canonical URLs',
      },
    });

    const prompt = await prisma.aiPrompt.create({
      data: { websiteId: richWebsiteId, prompt: 'mejor depilación láser Punta Arenas' },
    });
    const run = await prisma.aiRun.create({
      data: {
        promptId: prompt.id,
        model: 'chatgpt',
        brandMentioned: true,
        sentiment: 70,
        answerExcerpt: 'Kinesilk es una opción',
      },
    });
    await prisma.aiCitation.create({
      data: { runId: run.id, domain: 'novedadesesteticas.com' },
    });
    await prisma.aiRun.create({
      data: { promptId: prompt.id, model: 'gemini', brandMentioned: false },
    });

    await prisma.backlinkAccount.create({
      data: { websiteId: richWebsiteId, credits: 100, domainRating: 1 },
    });

    await prisma.contentPlanItem.createMany({
      data: [
        { websiteId: richWebsiteId, scheduledFor: new Date(), status: PlanItemStatus.PUBLISHED },
        { websiteId: richWebsiteId, scheduledFor: new Date(), status: PlanItemStatus.QUEUED },
        { websiteId: richWebsiteId, scheduledFor: new Date(), status: PlanItemStatus.QUEUED },
      ],
    });

    await prisma.integration.create({
      data: {
        websiteId: richWebsiteId,
        kind: IntegrationKind.WORDPRESS,
        status: IntegrationStatus.CONNECTED,
        lastSyncAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { id: accountId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('S4 returns exactly the documented top-level shape', async () => {
    const overview = await service.build(richWebsiteId, '2026-11-13');

    expect(Object.keys(overview).sort()).toEqual(
      ['activity', 'agents', 'brandSummary', 'date', 'learnings', 'nextSteps', 'scores', 'timezone'].sort(),
    );
    expect(overview.date).toBe('2026-11-13');
    expect(overview.timezone).toBe('America/Santiago');
    expect(Object.keys(overview.scores).sort()).toEqual(
      ['aiVisibility', 'backlinks', 'contentPlan', 'siteHealth'].sort(),
    );
  });

  it('S5 caps the feed at 20 but reports the true total, newest first', async () => {
    const overview = await service.build(richWebsiteId);

    expect(overview.activity.total).toBe(25);
    expect(overview.activity.items).toHaveLength(20);

    const times = overview.activity.items.map((item) => new Date(item.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('S5 carries the provenance keys on article activities', async () => {
    const overview = await service.build(richWebsiteId);
    const article = overview.activity.items[0];

    expect(article?.kind).toBe('article_published');
    expect(article?.meta).toMatchObject({
      targetKeyword: 'depilación láser',
      status: 'live',
      model: 'claude-sonnet-4-6',
      promptVersion: 'article-v3',
    });
    expect(typeof article?.meta.revisionCount).toBe('number');
    expect(article?.meta.approvedBy).toEqual({ id: userId, name: 'Overview Test' });
  });

  it('S5 nextSteps[].kind is only "required" or "optional"', async () => {
    const overview = await service.build(richWebsiteId);

    expect(overview.nextSteps.length).toBeGreaterThan(0);
    for (const step of overview.nextSteps) {
      expect(['required', 'optional']).toContain(step.kind);
    }
    // WordPress is connected, so its required step is done; the rest are pending optionals.
    const wordpress = overview.nextSteps.find((step) => step.id === 'wordpress');
    expect(wordpress?.kind).toBe('required');
    expect(wordpress?.doneAt).toBeTruthy();
    expect(overview.nextSteps.some((step) => step.kind === 'optional' && step.doneAt === null)).toBe(true);
  });

  it('S4 measures what exists: health, visibility, backlinks and the plan counts', async () => {
    const overview = await service.build(richWebsiteId);

    expect(overview.scores.siteHealth).toMatchObject({
      overall: 82,
      pageSpeed: 100,
      llmOptimization: 76,
      technicalSeo: 80,
      status: 'good',
      issueCounts: { high: 1, medium: 0, low: 0 },
    });
    expect(overview.scores.aiVisibility).toMatchObject({
      prompts: 1,
      answers: 2,
      mentions: 1,
    });
    expect(overview.scores.backlinks).toMatchObject({ credits: 100, domainRating: 1 });
    expect(overview.scores.contentPlan).toEqual({ published: 1, queued: 2 });
  });

  it('S5 null means "not measured yet" for a site with no data', async () => {
    const overview = await service.build(emptyWebsiteId);

    expect(overview.scores.siteHealth).toBeNull();
    expect(overview.scores.aiVisibility).toBeNull();
    expect(overview.scores.backlinks).toBeNull();
    expect(overview.scores.contentPlan).toEqual({ published: 0, queued: 0 });
    expect(overview.activity.total).toBe(0);
    expect(overview.agents.running).toBe(false);
    expect(Array.isArray(overview.learnings.facts)).toBe(true);
    expect(overview.brandSummary.colors).toEqual({ primary: null, secondary: null });
  });
});
