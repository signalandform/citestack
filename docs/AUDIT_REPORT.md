# Clerkbook / Citestack Repo Audit Report

**Date:** February 11, 2025  
**Scope:** Full repository audit against production-readiness rubric

---

## Executive Summary

Clerkbook (also named Citestack in code) is a citation-first research library: users capture URLs/files/paste, items are enriched with AI, and citations/bibliographies are generated. The stack is Next.js 16, Supabase (Auth + Postgres + Storage), Stripe, and OpenAI.

**Overall weighted score: 2.9 / 5**

The app has solid foundations: RLS, idempotency on capture flows, atomic credit operations, Stripe webhook verification, and structured migrations. Critical gaps include: no Stripe webhook idempotency (double-credit risk), SSRF via image-download proxy, admin secret in URL params, no CI/CD, minimal tests, and no structured observability.

---

## A. Product Risk / Correctness

### A1. Critical Flows Correctness (weight: high)

| Flow | Tests | Idempotency | Failure Handling | Logging | Score |
|------|-------|-------------|------------------|---------|-------|
| Auth/signup/login | ❌ No | N/A | Basic | Supabase default | 2 |
| Billing/payments | ❌ No | Partial | OK | console.error | 3 |
| Stripe webhooks | ❌ No | **❌ None** | Return 500 on error | console.error | 2 |
| Data writes (capture) | ❌ No | ✅ Yes | OK | console.error | 4 |
| Jobs/credits | ❌ No | Partial | OK | console.error | 3 |
| Permissions | RLS | N/A | RLS enforced | N/A | 4 |

**Findings:**
- **Auth:** Supabase Auth used; middleware protects routes; `getUser()` on all API routes. No tests.
- **Billing:** Stripe checkout creates session with `client_reference_id` = user_id. Webhook verifies signature.
- **Stripe webhook idempotency:** Stripe sends duplicate events (e.g. retries). `checkout.session.completed` and `payment` mode both call `grant_credits_pack` / `ensureUserCredits` / `syncSubscriptionToUser` with no event-id deduplication. **Risk of double-credits on retries.**
- **Capture:** File and URL capture use idempotency keys; paste does not (lower risk).
- **Credits:** `spend_credits` RPC is atomic; `grant_credits_pack` and `grant_credits_admin` use upsert. No double-spend at DB level.
- **Compare flow:** Credits spent before `runCompareItems`; if compare fails, credits are not refunded.

**Score: 3/5**

### A2. Data Integrity

| Aspect | Status | Notes |
|--------|--------|-------|
| Migrations | ✅ | 21 migrations, ordered, versioned |
| Constraints | ✅ | Unique indexes (url_canonical, file_sha256), FKs, checks |
| Transactional boundaries | Partial | Credits RPCs are atomic; capture file has multi-step flow (insert → upload → update → job) — partial rollback on upload failure |
| Retries | Partial | Jobs: stuck job reset after 15 min; no retry backoff for failed jobs |
| Idempotency keys | ✅ | Capture file/url; not Stripe webhook |

**Score: 4/5**

### A3. Error Handling & Observability

| Aspect | Status | Notes |
|--------|--------|-------|
| Structured logs | ❌ | `console.error` only; no JSON, no levels |
| Correlation IDs | ❌ | None |
| Sentry / APM | ❌ | None |
| Alerts | ❌ | None configured |
| Dead-letter | ❌ | Failed jobs stay `failed`; no DLQ |

**Score: 1/5**

**A. Product Risk / Correctness aggregate: 2.7/5**

---

## B. Security Posture

### B1. Secrets & Config Hygiene (weight: high)

| Aspect | Status | Notes |
|--------|--------|-------|
| Env vars | ✅ | All secrets from env; `.env*` in .gitignore |
| Secret leakage | Partial | Admin secret accepted via `?secret=` in URL — can leak in referrer, logs |
| Key rotation | ⚠️ | No documented rotation procedure |
| Least privilege | ✅ | Service role only server-side; anon key client |

**Secrets in use:** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, `CITESTACK_ADMIN_SECRET`, `MICROLINK_API_KEY` (optional). `.env.example` present, no values.

**Score: 4/5**

### B2. AuthZ & Multi-Tenant Isolation

| Aspect | Status | Notes |
|--------|--------|-------|
| RLS | ✅ | All tables; `to authenticated` policies |
| Org/user boundaries | ✅ | Single-tenant by `user_id`; RLS enforces |
| API checks | ✅ | `getUser()` on protected routes; `eq('user_id', user.id)` |
| Object-level perms | ✅ | Items, collections, comparisons scoped by user |

**Score: 5/5**

### B3. External Surface Safety

| Aspect | Status | Notes |
|--------|--------|-------|
| Webhook verification | ✅ | Stripe signature verified |
| SSRF | **❌** | `extract-url` and `image-download` fetch user-provided URLs; no blocklist for localhost/169.254.169.254/internal IPs |
| Injection | ✅ | Parameterized queries via Supabase client |
| File uploads | ✅ | MIME + extension allowlist; 50MB limit; sha256 dedupe |
| Rate limiting | ❌ | None |
| CORS/CSRF | ✅ | Next.js default; API is JSON |

**SSRF details:** `extract-url` fetches the URL directly. `image-download` proxies URLs from `item.image_urls` (extracted from page). A malicious page could embed `<img src="http://169.254.169.254/latest/meta-data/">`; after capture, user download triggers fetch.

**Score: 2/5**

**B. Security aggregate: 3.7/5**

---

## C. Reliability & Scalability

### C1. Performance & Bottlenecks

| Aspect | Status | Notes |
|--------|--------|-------|
| Hot endpoints | ⚠️ | `/api/jobs/run` cron every 2 min; items list fetches 200 + several joins |
| N+1 | Partial | Items list: parallel `Promise.all` for tags/collections; tag filter does extra query |
| Caching | ❌ | None |
| Payload sizes | ⚠️ | `raw_text`/`cleaned_text` up to 500k chars; large responses possible |

**Score: 3/5**

### C2. Async Jobs Robustness

| Aspect | Status | Notes |
|--------|--------|-------|
| Retries/backoff | Partial | Stuck jobs reset to queued; no exponential backoff for failures |
| Idempotency | Partial | `claim_job` is atomic; enrich skips if already queued |
| Timeouts | ✅ | extract-url 15s; screenshot 30s |
| Poison-pill | ❌ | Failed jobs stay failed; no max attempts / dead-letter |

**Score: 3/5**

### C3. Dependency + Build Stability

| Aspect | Status | Notes |
|--------|--------|-------|
| Lockfile | ✅ | `package-lock.json` present |
| Version pinning | Partial | Some `^` ranges; Next.js 16, Supabase, Stripe pinned |
| CI reproducibility | ❌ | No CI |
| Native deps | ⚠️ | `@napi-rs/canvas`, `pdf-parse` — may need build env |

**Score: 3/5**

**C. Reliability aggregate: 3/5**

---

## D. Maintainability & Velocity

### D1. Architecture Clarity

| Aspect | Status | Notes |
|--------|--------|-------|
| Module boundaries | ✅ | `lib/` for credits, jobs, stripe, supabase, url |
| Layering | ✅ | API routes → lib → Supabase |
| Naming | ✅ | Consistent |
| "Where does logic live?" | ✅ | Clear |

**Score: 4/5**

### D2. Test Coverage Quality

| Aspect | Status | Notes |
|--------|--------|-------|
| Critical path tests | ❌ | Only `lib/url/normalize.test.ts` |
| Integration tests | ❌ | None |
| Mocking | N/A | — |
| Flaky tests | N/A | — |

**Score: 1/5**

### D3. Code Health / Consistency

| Aspect | Status | Notes |
|--------|--------|-------|
| Lint | ✅ | ESLint + Next config |
| Type safety | ✅ | TypeScript |
| Dead code | ⚠️ | invite_codes / invite_redemptions tables present; unclear if used |
| Duplication | ⚠️ | Collection-item logic repeated in capture routes |
| Complexity | ✅ | Manageable |

**Score: 3/5**

**D. Maintainability aggregate: 2.7/5**

---

## E. DX / Release Quality

### E1. CI/CD Confidence

| Aspect | Status | Notes |
|--------|--------|-------|
| Checks gated | ❌ | No `.github/workflows` |
| Preview envs | ⚠️ | Vercel (assumed) — unknown |
| Migrations | ⚠️ | Manual; no CI migration check |
| Rollback plan | ❌ | Not documented |

**Score: 1/5**

### E2. Runbooks + On-Call Readiness

| Aspect | Status | Notes |
|--------|--------|-------|
| "How to debug" | ❌ | README has setup only |
| "How to recover" | ❌ | None |
| Known failure modes | ❌ | Not documented |

**Score: 1/5**

**E. DX aggregate: 1/5**

---

## Scorecard (0–5 each + weighted total)

| Category | Raw Score | Weight | Weighted |
|----------|-----------|--------|----------|
| **Security + critical flows** (A+B) | 3.2 | 40% | 1.28 |
| **Reliability & observability** (C) | 3.0 | 25% | 0.75 |
| **Maintainability & tests** (D) | 2.7 | 20% | 0.54 |
| **Performance & scaling** (C1) | 3.0 | 10% | 0.30 |
| **DX & runbooks** (E) | 1.0 | 5% | 0.05 |
| **Total** | — | — | **2.9** |

*Per rubric: Security + critical flows 40%, Reliability 25%, Maintainability 20%, Performance 10%, DX 5%*

---

## Top 10 Risks (impact × likelihood × effort)

| # | Risk | Impact | Likelihood | Effort | Mitigation |
|---|------|--------|------------|--------|------------|
| 1 | Stripe webhook double-credits on retry | High | Medium | Low | Add event-id idempotency table; skip if already processed |
| 2 | SSRF via image-download / extract-url | High | Medium | Low | Block private IP ranges, localhost, 169.254.x.x |
| 3 | Admin secret in URL param | Medium | Medium | Trivial | Remove `?secret=`; use header only |
| 4 | Compare: credits spent, no refund on failure | Medium | Low | Medium | Refund on failure or spend after success |
| 5 | No CI/CD — broken builds ship | Medium | High | Medium | Add GitHub Actions: lint, test, build |
| 6 | No observability — delayed incident detection | High | High | Medium | Add Sentry and structured logging |
| 7 | Job poison pills — no retry/backoff | Medium | Low | Medium | Add max_attempts, exponential backoff, DLQ |
| 8 | No rate limiting — abuse/DoS | Medium | Medium | Low | Add Vercel/upstream rate limiting |
| 9 | Items list N+1 / 200 limit at scale | Low | Medium | Medium | Pagination, cursor, optimize queries |
| 10 | No runbooks — slow recovery | Medium | High | Low | Document key flows and failure modes |

---

## Ship Blocker List (must-fix before launch)

1. **Stripe webhook idempotency** — Prevent double-credits on duplicate events.
2. **SSRF mitigation** — Block internal/metadata URLs in fetch paths.
3. **Admin secret in URL** — Remove query param; header-only.
4. **CI** — At least: lint, test, build on PR.

---

## First 10 Hours Plan (exact files, exact changes)

| Hour | File(s) | Change |
|------|---------|--------|
| 1–2 | `supabase/migrations/0022_stripe_webhook_idempotency.sql` | Create `stripe_webhook_events(id, event_id, processed_at)`; unique on event_id |
| 2–3 | `app/api/stripe/webhook/route.ts` | At start: check `event.id` in table; if exists return 200; after success insert event_id |
| 3–4 | `lib/url/blocklist.ts` (new) | `isBlockedUrl(url): boolean` — block localhost, 127.*, 10.*, 172.16–31.*, 169.254.*, ::1 |
| 4–5 | `lib/jobs/extract-url.ts` | Before fetch: if `isBlockedUrl(url)` return error |
| 5–6 | `app/api/items/[id]/image-download/route.ts` | Before fetch: if `isBlockedUrl(url)` return 400 |
| 6–7 | `app/api/admin/credits/grant/route.ts`, `app/api/jobs/run/route.ts` | Remove `url.searchParams.get('secret')`; only accept header |
| 7–8 | `.github/workflows/ci.yml` (new) | Run `npm ci`, `npm run lint`, `npm run test`, `npm run build` |
| 8–9 | `lib/url/blocklist.test.ts` (new) | Test blocklist for localhost, 169.254, etc. |
| 9–10 | `docs/RUNBOOK.md` (new) | Document: deploy, migrations, Stripe webhook, job cron, common failures |

---

## Quick Wins (≤30 min each)

1. **Remove admin secret from URL** — Delete `url.searchParams.get('secret')` in admin routes.
2. **Add `MICROLINK_API_KEY` to .env.example** — Document optional var.
3. **Add `npm run build` to pre-commit** — Or document in README.
4. **README: document required env vars** — List all from `.env.example` with descriptions.
5. **Health check** — `/api/health` already exists; add basic DB ping if desired.
6. **Stripe webhook: return 200 on unknown event** — Avoid 500 for unhandled types (currently `break` is fine, but explicit 200 helps).
7. **Add `OPENAI_API_KEY` to .env.example** — Ensure it's listed.

---

## Architecture Map (one page)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLERKBOOK / CITESTACK                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────────────────────────┐
│   Browser    │────▶│  Next.js     │────▶│  Supabase                        │
│   (React)    │     │  App Router  │     │  - Auth (session/cookies)        │
└──────────────┘     └──────────────┘     │  - Postgres (items, jobs,        │
       │                    │             │    credits, collections, etc.)   │
       │                    │             │  - Storage (library-files)       │
       │                    │             └──────────────────────────────────┘
       │                    │                              │
       │                    │             ┌───────────────┴───────────────┐
       │                    │             │                               │
       │                    ▼             ▼                               ▼
       │             ┌─────────────┐  ┌─────────────┐              ┌─────────────┐
       │             │ API Routes  │  │  Cron       │              │  Stripe      │
       │             │ - capture  │  │  /api/jobs/ │              │  - checkout  │
       │             │ - items    │  │  run        │              │  - webhook   │
       │             │ - compare  │  │  (every 2m) │              │  - portal    │
       │             │ - credits  │  └──────┬──────┘              └─────────────┘
       │             │ - stripe   │         │
       │             └─────┬──────┘         │
       │                   │                │
       │                   ▼                ▼
       │             ┌─────────────────────────────────────────────────────────┐
       │             │  lib/                                                    │
       │             │  - credits (spend, grant, ensure, balance)               │
       │             │  - jobs (extract-url, extract-file, enrich-item,       │
       │             │         screenshot-url, compare-items)                  │
       │             │  - stripe (config, server)                               │
       │             │  - supabase (client, server, admin)                     │
       │             │  - idempotency ( capture only )                         │
       │             │  - url (normalize, blocklist)                            │
       │             └─────────────────────────────────────────────────────────┘
       │                                    │
       │                                    ▼
       │             ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
       └────────────▶│  OpenAI     │  │  Microlink  │  │  External   │
                     │  (enrich,   │  │  (screenshots)│  │  URLs       │
                     │  compare)  │  │             │  │  (extract)   │
                     └─────────────┘  └─────────────┘  └─────────────┘

Data flow (simplified):
  User → capture (file/url/paste) → items + jobs
  Cron → jobs/run → claim_job → runExtract* / runEnrich / runScreenshot
  Enrich → spend credits → OpenAI → update item
  Stripe webhook → sync subscription / grant credits
  User → compare → spend credits → OpenAI → comparisons
```

---

## Summary

Clerkbook has a solid base: RLS, capture idempotency, atomic credits, and Stripe webhook verification. The main risks before launch are:

1. **Stripe webhook idempotency** — Double-credits on retries.
2. **SSRF** — Image-download and URL extract fetching user-controlled URLs.
3. **Admin secret in URL** — Remove query param.
4. **CI** — Add basic checks.

Addressing the ship blockers and first 10 hours plan will materially improve reliability and security. Quick wins and runbooks improve DX and maintainability.
