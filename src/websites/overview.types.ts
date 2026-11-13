/**
 * Wire shape of `GET /websites/:id/overview`.
 *
 * Frozen in `docs/api-contract.md`; both the service and the tests import these types so the
 * contract cannot drift silently. Every nullable field means "not measured yet", never
 * "failed" — the UI renders an empty state instead of a zero.
 */

export type ActivityItemKind =
  | 'article_published'
  | 'topic_researched'
  | 'article_improved'
  | 'backlink_added'
  | 'social_opportunity_found'
  | 'social_replied'
  | 'scan_completed'
  | 'visibility_run_completed'
  | 'failed';

export interface ActivityMeta {
  targetKeyword?: string | null;
  status?: string | null;
  /** Provenance — present for `article_published` and `article_drafted` activities. */
  model?: string | null;
  promptVersion?: string | null;
  revisionCount?: number | null;
  /** Null when the article went out with `autoPublish` on and no human approved it. */
  approvedBy?: { id: string; name: string } | null;
  [key: string]: unknown;
}

export interface ActivityItem {
  id: string;
  kind: ActivityItemKind;
  title: string;
  summary: string | null;
  occurredAt: string;
  href: string | null;
  thumbnailUrl: string | null;
  meta: ActivityMeta;
  viewedAt: string | null;
}

export interface SiteHealthScore {
  overall: number;
  status: 'good' | 'warn' | 'bad';
  pageSpeed: number | null;
  llmOptimization: number | null;
  technicalSeo: number | null;
  issueCounts: { high: number; medium: number; low: number };
}

export interface AiVisibilityScore {
  score: number;
  prompts: number;
  answers: number;
  mentions: number;
}

export interface BacklinkScore {
  credits: number;
  received: number;
  given: number;
  domainRating: number;
}

export interface NextStep {
  id: string;
  kind: 'required' | 'optional';
  title: string;
  description: string | null;
  href: string;
  doneAt: string | null;
}

export interface OverviewDto {
  date: string;
  timezone: string;
  agents: { running: boolean; lastRunAt: string | null };
  activity: { total: number; items: ActivityItem[] };
  learnings: {
    updatedAt: string | null;
    summary: string | null;
    facts: Array<{ label: string; value: string }>;
  };
  scores: {
    siteHealth: SiteHealthScore | null;
    aiVisibility: AiVisibilityScore | null;
    backlinks: BacklinkScore | null;
    contentPlan: { published: number; queued: number };
  };
  nextSteps: NextStep[];
  brandSummary: {
    name: string;
    domain: string;
    /** No column exists yet, so this stays null rather than guessing from the domain. */
    industry: string | null;
    positioning: string | null;
    logoUrl: string | null;
    colors: { primary: string | null; secondary: string | null };
  };
}

/** The feed is capped; `activity.total` carries the real count for the "+N more" affordance. */
export const ACTIVITY_ITEM_CAP = 20;
