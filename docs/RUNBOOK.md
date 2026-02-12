# Clerkbook / Citestack Runbook

## Deploy

- **Platform:** Vercel
- **Build command:** `npm run build`
- **Output:** Next.js default (`.next`)
- **Env vars:** Set in Vercel project settings (see [Environment Variables](#environment-variables))

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for enrich/compare |
| `STRIPE_SECRET_KEY` | Billing | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Billing | Stripe webhook signing secret |
| `CITESTACK_ADMIN_SECRET` | Yes | Secret for admin endpoints (jobs cron, credits grant) |
| `MICROLINK_API_KEY` | No | Microlink API key for screenshots (optional) |
| `SENTRY_DSN` | No | Sentry DSN for error monitoring |
| `SENTRY_ORG` | No | Sentry org slug (for source maps) |
| `SENTRY_PROJECT` | No | Sentry project slug (for source maps) |

## Migrations

Run migrations in order via Supabase:

1. **SQL Editor:** Paste and run each file in `supabase/migrations/` in numerical order (0001, 0002, …).
2. **CLI:** `supabase db push` (if Supabase CLI is linked).

Migration order: `0001_init.sql` through `0023_compare_refund_and_job_retry.sql`.

## Stripe Webhook

- **Endpoint:** `https://<your-domain>/api/stripe/webhook`
- **Secret:** Set `STRIPE_WEBHOOK_SECRET` in env.
- **Testing:** Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- **Events handled:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Idempotency:** Duplicate events are detected via `stripe_webhook_events` table; return 200 without re-processing.

## Job Cron

- **Path:** `/api/jobs/run`
- **Schedule:** `*/2 * * * *` (every 2 minutes, see `vercel.json`)
- **Auth:** Send `x-citestack-admin-secret` header or `Authorization: Bearer <CITESTACK_ADMIN_SECRET>`
- **GET/POST:** Both supported. Cron typically uses POST.

## Rate Limiting

For production, consider:

- **Vercel Pro/Enterprise:** Vercel Firewall or rate limiting add-on
- **Upstash:** `@upstash/ratelimit` + Redis for `/api/capture/*`, `/api/compare`, `/api/stripe/checkout`

## Common Failures

### Webhook returns 500

- Check Vercel logs for `[stripe/webhook]` errors
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check `stripe_webhook_events` for duplicate event_id (idempotency should prevent double-credits)

### Jobs stuck in "running"

- Stuck jobs are reset to "queued" after 15 minutes (see `jobs/run` route)
- Check `run_after` if jobs are delayed (exponential backoff on retry)

### Credits mismatch

- Inspect `credit_ledger` for user's grants and spends
- Check `user_credits` for current balance and `monthly_grant`
- Refunds: `grant_credits_refund` is used for compare failures

### Item extraction fails

- Check `items.error` for the failure message
- URL extraction: ensure URL is not blocked (SSRF blocklist: localhost, 169.254.x.x, private ranges)
- File extraction: check MIME type and file size (50MB max)

## Key Rotation

1. **STRIPE_WEBHOOK_SECRET:** Create new webhook endpoint in Stripe, update env, redeploy
2. **CITESTACK_ADMIN_SECRET:** Generate new secret, update env, redeploy. Update cron config if needed.
3. **SUPABASE_SERVICE_ROLE_KEY:** Rotate in Supabase dashboard, update env, redeploy
