# GrowthOS AI

AI-powered growth marketing platform (Vite + React + Express + Supabase + Gemini).

## Local development

```bash
cp .env.example .env
# Fill in Supabase + Gemini keys
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel (via GitHub)

1. Push this repo to GitHub (already configured for `DaUnderlord/GrowthAI`).
2. In [Vercel](https://vercel.com/new), import the GitHub repository.
3. Vercel reads `vercel.json` automatically:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **API routes:** `/api/*` and `/auth/*` → Express serverless function
4. Add environment variables in **Project → Settings → Environment Variables**:

| Variable | When | Required |
|----------|------|----------|
| `VITE_SUPABASE_URL` | Build | Yes |
| `VITE_SUPABASE_ANON_KEY` | Build | Yes |
| `GEMINI_API_KEY` | Runtime | Yes (AI features) |
| `SUPABASE_URL` | Runtime | Yes (WhatsApp/server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime | Yes (WhatsApp/server) |
| `APP_URL` | Runtime | Optional (auto from Vercel URL) |
| `GEMINI_MODEL` | Runtime | Optional (`gemini-3.6-flash`) |
| `META_*`, `WHATSAPP_*` | Runtime | Optional (WhatsApp module) |

5. In **Supabase Dashboard → Authentication → URL Configuration**, add your Vercel deployment URL(s) to **Site URL** and **Redirect URLs**.
6. For WhatsApp webhooks, set Meta callback URL to `https://YOUR_DOMAIN/api/meta/webhook`.

### Auth "Failed to fetch" troubleshooting

1. **Vercel env vars** — set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for **Production** (and Preview if needed), then **Redeploy**. Vite bakes these in at build time.
2. **Runtime fallback** — you can also set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (no `VITE_` prefix); the app loads them from `/api/public-config`.
3. **Supabase Auth URLs** — in Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to your Vercel domain and add it under **Redirect URLs** (e.g. `https://your-app.vercel.app/**`).
4. **Project active** — confirm the Supabase project is not paused in the Supabase dashboard.

- AI routes use up to 60s serverless timeout (Pro plan recommended for long Gemini calls).
- Static SPA is served from `dist/`; client routes fall back to `index.html`.
- Health check: `GET /api/health`

## Supabase migrations

Apply SQL files in `supabase/migrations/` in order (SQL Editor, CLI, or Supabase MCP `apply_migration`):

1. `20260810130000_growthos_schema.sql` — core tables
2. `20260810150000_calendar_team_sharing.sql` — calendar briefs
3. `20260820150000_whatsapp_sales_crm.sql` — WhatsApp / CRM
4. `20260827180000_production_hardening.sql` — org-scoped RLS, team invites, missing columns

Also enable **Leaked password protection** in Supabase Dashboard → Authentication → Attack Protection.

After deploy, add your Vercel URL to **Authentication → URL Configuration**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev (Vite + Express) |
| `npm run build` | Production frontend build (Vercel) |
| `npm run build:all` | Frontend + bundled Node server (self-hosted) |
| `npm run start` | Run bundled server locally (`NODE_ENV=production`) |
| `npm run lint` | TypeScript check |
