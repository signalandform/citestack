# Clerkbook

Citation-first research library (save → summarize → search → cite).

## Stack
- Next.js (App Router)
- Supabase (Postgres + Storage + Auth)
- OpenAI (summaries/quotes/tags; later embeddings)
- Vercel deploy

## Local dev

1) Install deps
```bash
npm install
```

2) Create `.env.local` from `.env.example`
```bash
cp .env.example .env.local
```

3) Run
```bash
npm run dev
```

## Supabase
- Enable **Auth**
- Create Storage bucket: `library-files`
- Run SQL in `supabase/migrations/0001_init.sql`

## Notes
This repo is an initial scaffold. Next steps:
- Invite-code gated signup (server route + tables)
- Capture flows: URL / paste / file upload
- Async job runner (simple `jobs` table + cron-triggered worker endpoint)
