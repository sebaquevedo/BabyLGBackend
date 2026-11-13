-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('WORDPRESS', 'GOOGLE_SEARCH_CONSOLE', 'GOOGLE_ANALYTICS', 'INSTAGRAM_FACEBOOK', 'REDDIT', 'QUORA');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "KeywordSource" AS ENUM ('RESEARCH', 'GSC', 'COMPETITOR', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('QUEUED', 'RESEARCHING', 'WRITING', 'READY', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ArticleType" AS ENUM ('HOW_TO', 'EXPLAINER', 'LISTICLE', 'COMPARISON', 'NEWS');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('TECHNICAL_SEO', 'LLM_OPTIMIZATION', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('REDDIT', 'QUORA', 'INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "SocialStatus" AS ENUM ('NEW', 'DRAFTED', 'APPROVED', 'PUBLISHED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BacklinkStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'LIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('LOGO', 'HERO', 'BODY_IMAGE', 'INFOGRAPHIC', 'SOCIAL_CAROUSEL');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('ARTICLE_PUBLISHED', 'TOPIC_RESEARCHED', 'ARTICLE_IMPROVED', 'BACKLINK_ADDED', 'SOCIAL_OPPORTUNITY_FOUND', 'SOCIAL_REPLIED', 'SCAN_COMPLETED', 'VISIBILITY_RUN_COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-CL',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websites" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Santiago',
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "publishHour" INTEGER NOT NULL DEFAULT 9,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "credentials" JSONB,
    "meta" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "positioning" TEXT,
    "voiceSourceUrl" TEXT,
    "logoAssetId" TEXT,
    "colorPrimary" TEXT,
    "colorSecondary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'service',
    "url" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "source" TEXT NOT NULL DEFAULT 'generated',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clusters" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "clusterId" TEXT,
    "term" TEXT NOT NULL,
    "volume" INTEGER,
    "difficulty" INTEGER,
    "intent" TEXT,
    "source" "KeywordSource" NOT NULL DEFAULT 'RESEARCH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_plan_items" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "keywordId" TEXT,
    "scheduledFor" DATE NOT NULL,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'QUEUED',
    "title" TEXT,
    "articleType" "ArticleType" NOT NULL DEFAULT 'EXPLAINER',
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "planItemId" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "jsonld" JSONB,
    "heroAssetId" TEXT,
    "wordCount" INTEGER,
    "model" TEXT,
    "promptVersion" TEXT,
    "wpPostId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_revisions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_scans" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "pageSpeed" INTEGER,
    "llmScore" INTEGER,
    "technicalSeo" INTEGER,
    "crawlerFiles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_issues" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "why" TEXT,
    "howToFix" TEXT,
    "pages" JSONB,

    CONSTRAINT "site_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompts" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "clusterId" TEXT,
    "prompt" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" INTEGER,
    "answerExcerpt" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_citations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "ai_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_brands" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "sentiment" INTEGER,

    CONSTRAINT "ai_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_opportunities" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "externalId" TEXT,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "matchedKeyword" TEXT,
    "score" INTEGER,
    "status" "SocialStatus" NOT NULL DEFAULT 'NEW',
    "draftReply" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_assets" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "variants" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "status" "SocialStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backlink_accounts" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 100,
    "domainRating" INTEGER NOT NULL DEFAULT 0,
    "drUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "backlink_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backlink_exchanges" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "partnerDomain" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "anchor" TEXT,
    "status" "BacklinkStatus" NOT NULL DEFAULT 'PROPOSED',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backlink_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'agent',
    "kind" "ActivityKind" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_accountId_userId_key" ON "memberships"("accountId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "websites_accountId_domain_key" ON "websites"("accountId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_websiteId_kind_key" ON "integrations"("websiteId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_websiteId_key" ON "brand_profiles"("websiteId");

-- CreateIndex
CREATE INDEX "catalog_items_websiteId_idx" ON "catalog_items"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "competitors_websiteId_domain_key" ON "competitors"("websiteId", "domain");

-- CreateIndex
CREATE INDEX "assets_websiteId_kind_idx" ON "assets"("websiteId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "clusters_websiteId_name_key" ON "clusters"("websiteId", "name");

-- CreateIndex
CREATE INDEX "keywords_websiteId_clusterId_idx" ON "keywords"("websiteId", "clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "keywords_websiteId_term_key" ON "keywords"("websiteId", "term");

-- CreateIndex
CREATE INDEX "content_plan_items_websiteId_scheduledFor_idx" ON "content_plan_items"("websiteId", "scheduledFor");

-- CreateIndex
CREATE INDEX "content_plan_items_websiteId_status_idx" ON "content_plan_items"("websiteId", "status");

-- CreateIndex
CREATE INDEX "articles_websiteId_status_idx" ON "articles"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "articles_websiteId_slug_key" ON "articles"("websiteId", "slug");

-- CreateIndex
CREATE INDEX "article_revisions_articleId_idx" ON "article_revisions"("articleId");

-- CreateIndex
CREATE INDEX "site_scans_websiteId_createdAt_idx" ON "site_scans"("websiteId", "createdAt");

-- CreateIndex
CREATE INDEX "site_issues_scanId_idx" ON "site_issues"("scanId");

-- CreateIndex
CREATE INDEX "ai_prompts_websiteId_idx" ON "ai_prompts"("websiteId");

-- CreateIndex
CREATE INDEX "ai_runs_promptId_runAt_idx" ON "ai_runs"("promptId", "runAt");

-- CreateIndex
CREATE INDEX "ai_citations_runId_idx" ON "ai_citations"("runId");

-- CreateIndex
CREATE INDEX "ai_brands_runId_idx" ON "ai_brands"("runId");

-- CreateIndex
CREATE INDEX "social_opportunities_websiteId_status_idx" ON "social_opportunities"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "social_opportunities_websiteId_platform_url_key" ON "social_opportunities"("websiteId", "platform", "url");

-- CreateIndex
CREATE INDEX "social_assets_articleId_idx" ON "social_assets"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "backlink_accounts_websiteId_key" ON "backlink_accounts"("websiteId");

-- CreateIndex
CREATE INDEX "backlink_exchanges_websiteId_status_idx" ON "backlink_exchanges"("websiteId", "status");

-- CreateIndex
CREATE INDEX "activity_log_websiteId_createdAt_idx" ON "activity_log"("websiteId", "createdAt");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clusters" ADD CONSTRAINT "clusters_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_plan_items" ADD CONSTRAINT "content_plan_items_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_plan_items" ADD CONSTRAINT "content_plan_items_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keywords"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "content_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_scans" ADD CONSTRAINT "site_scans_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "site_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_citations" ADD CONSTRAINT "ai_citations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_brands" ADD CONSTRAINT "ai_brands_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_opportunities" ADD CONSTRAINT "social_opportunities_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_assets" ADD CONSTRAINT "social_assets_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backlink_accounts" ADD CONSTRAINT "backlink_accounts_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backlink_exchanges" ADD CONSTRAINT "backlink_exchanges_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
