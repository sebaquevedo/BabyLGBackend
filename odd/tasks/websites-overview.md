# Websites + Overview slice

The API surface that unblocks the front's artboard 01: list/create/read/update websites and the
single-round-trip `GET /websites/:id/overview`. Spec is the frozen contract in
`docs/api-contract.md`; nothing here may invent a field. Owner: OLX. Branch: `feat/websites-overview`.

## Specs

S1 — `GET /api/v1/websites` returns the sites of the caller's account(s), scoped by membership.
Response `{ data: [...] }`. A caller with no memberships gets `{ data: [] }`, never 403.

S2 — `POST /api/v1/websites` accepts `domain`, `name`, `language`, `timezone`, `autoPublish?`
(default `false`), `publishHour?` (default `9`). Creating a site the account already has answers
`409 { code: "website_domain_taken" }`.

S3 — `GET /api/v1/websites/:id`, `PATCH /api/v1/websites/:id` (any of `name`, `language`,
`timezone`, `autoPublish`, `publishHour`) and `DELETE /api/v1/websites/:id` (cascades).

S4 — `GET /api/v1/websites/:websiteId/overview?date=YYYY-MM-DD` returns exactly:

```jsonc
{ "date", "timezone", "agents": { "running", "lastRunAt" },
  "activity": { "total", "items": [ { "id", "kind", "title", "summary", "occurredAt", "href",
                                      "thumbnailUrl", "meta", "viewedAt" } ] },
  "learnings": { "updatedAt", "summary", "facts": [ { "label", "value" } ] },
  "scores": { "siteHealth", "aiVisibility", "backlinks", "contentPlan": { "published", "queued" } },
  "nextSteps": [ { "id", "kind", "title", "description", "href", "doneAt" } ],
  "brandSummary": { "name", "domain", "industry", "positioning", "logoUrl",
                    "colors": { "primary", "secondary" } } }
```

S5 — The rules attached to S4, verbatim from the contract:
- "**Every score block is nullable** and null means \"not measured yet\" — that is how the Overview renders its empty states without a second call."
- "`activity.items` is capped at 20 and sorted `occurredAt` desc; `activity.total` is the true count so the UI can say \"did 12 more activities\"."
- "**`nextSteps[].kind` is exactly two values: `\"required\"` or `\"optional\"`.**"
- "`meta` is discriminated by `activity.items[].kind`." For `article_published` and
  `article_drafted` it always carries `targetKeyword`, `status`, `model`, `promptVersion`,
  `revisionCount`, `approvedBy` (`null` when auto-published).
- "`date` is echoed back so the day stepper never guesses the server's day."

S6 — Tenancy: every route below a website runs through `WebsiteGuard`; a site the caller has no
membership in answers `404 { code: "website_not_found" }`, never `403`.

## Tasks

| ID | Specs | Route | Commit |
| --- | --- | --- | --- |
| T1 | S1, S2, S3, S6 | inline | websites module: DTOs, service, controller, guards wiring |
| T2 | S4, S5 | inline | OverviewService composing the DTO from ActivityLog, BrandProfile, SiteScan/SiteIssue, AiRun/AiCitation, BacklinkAccount, ContentPlanItem, Integration |
| T3 | S4, S5, S6 | inline | integration tests against real Postgres (shape, nullability, cap, 404 tenancy) |
| T4 | — | inline | contract cross-check + work-unit commit |

## Log

- L1 (2026-11-13, verbatim): "continuamos?" — the slice named in the previous session's handoff
  (`docs/api-contract.md` → `GET /websites/:id/overview`), which is what blocks the front's
  artboard 01.
- L2: the DTO in the contract was already edited by this session to close the front's three gaps
  (provenance keys, `nextSteps[].kind`, publish policy columns). No spec changes since.
