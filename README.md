# ServicePulse AI

AI-powered customer-interaction intelligence and early-warning platform for financial institutions.

ServicePulse turns fragmented customer interactions (branch, contact centre, email, mobile app, USSD, WhatsApp,
social media, web) into management intelligence:

```
interactions → AI classification (category, intent, sentiment, severity, product, issue)
             → issue normalisation (different phrasings → one issue group)
             → pattern detection & deterministic trend / risk scoring
             → root-cause hypothesis → responsible-team recommendation (from the bank's own directory)
             → human assignment / override → status tracking → audit log → management insight
```

The differentiator: ServicePulse does not stop at _what_ is wrong — it recommends **who** in the organisation should
investigate and fix it, and only ever from teams that exist in that bank's responsibility directory.

---

## Contents

- [Architecture](#architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Seeding demo data](#seeding-demo-data)
- [Local development](#local-development)
- [Demo walkthrough (acceptance test)](#demo-walkthrough-acceptance-test)
- [Deployment (Supabase + Vercel)](#deployment-supabase--vercel)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [Known limitations](#known-limitations)
- [Future production upgrades](#future-production-upgrades)

---

## Architecture

One Next.js 16 (App Router, TypeScript) application. No microservices, queues or ML infrastructure.

| Layer                 | Technology                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| UI                    | Next.js server components, Tailwind CSS v4, shadcn/ui, Recharts, Lucide icons                    |
| API                   | Next.js route handlers (`app/api/**`), every body validated with Zod                             |
| Database              | Supabase PostgreSQL via `postgres.js` (parameterised tagged-template queries only)               |
| AI                    | Anthropic Claude with **Structured Outputs** (`betaZodOutputFormat`), re-validated with Zod — Haiku for classification, Opus for analysis |
| Deterministic engines | `lib/scoring` (trend + risk), `lib/clustering` (aggregation), `lib/ai/team-validation`           |

```
app/
  page.tsx                  bank selection
  (platform)/dashboard      executive dashboard
  (platform)/complaints     interaction explorer, CSV/JSON import, classification
  (platform)/issues         systemic issues list + [id] investigation page
  (platform)/teams          team impact + configurable responsibility directory
  (platform)/insights       Ask ServicePulse (management assistant)
  (platform)/settings       AI engine status, engine rules, audit log
  api/                      route handlers (classify, import, analyse, assign, status, notes, assistant, directory)
components/                 dashboard / complaints / issues / teams / charts / shared / ui (shadcn)
lib/
  ai/                       Claude client (fast/deep model tiers), classification, root-cause + team orchestration, assistant,
                            team-id validation, rules fallback (classifier, root-cause library, team matcher)
  db/                       bank-scoped data access (banks, interactions, issues, directory, dashboard, audit)
  clustering/aggregate.ts   pattern detection: per-issue volumes, growth, breakdowns, risk
  scoring/                  trend thresholds + risk scoring (pure, unit-tested)
  validation/               Zod schemas: AI outputs, API bodies, import rows
  utils/                    sanitisation / PII redaction, formatting
prompts/                    complaint-classification, root-cause-analysis, team-recommendation, management-insight
types/                      domain types
data/seed/                  fictional organisations, message templates (hidden variations), generator, sample CSV
supabase/migrations/        SQL schema (multi-bank, composite FKs, RLS)
scripts/                    migrate, seed, classify (headless pipeline)
tests/                      Vitest unit tests
```

### Data model (summary)

`banks` → `departments` → `teams` → `team_responsibilities`; `products`, `systems` (owned by teams),
`team_product_ownership`, `branches`; `interactions` + `interaction_classifications`; `issues` (one per normalised
issue group per bank, with deterministic metrics); `issue_analyses` (root cause + owner recommendation history);
`issue_notes`; `audit_log`.

**Cross-bank leakage prevention:** every bank-owned table carries `bank_id`; every reference between them is a
composite `(bank_id, id)` foreign key, so the database itself rejects (for example) assigning one bank's team to
another bank's issue. All queries take an explicit bank id resolved server-side from an httpOnly cookie and
re-validated against the database. RLS is enabled with no policies, so Supabase's public anon/authenticated keys
cannot read tenant data.

---

## Setup

Prerequisites: **Node.js 20.9+** (22 recommended) and a PostgreSQL 15+ database (Supabase, or the bundled local
PGlite server — no Docker required).

```bash
git clone <repo> && cd service-pulse-ai
npm install
cp .env.example .env.local      # then edit values
```

## Environment variables

All variables are **server-side only** (none are prefixed `NEXT_PUBLIC_`), validated with Zod in `lib/env.ts`.

| Variable               | Required | Default        | Purpose                                                                         |
| ---------------------- | -------- | -------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes      | –              | Postgres connection string (Supabase or local)                                  |
| `DATABASE_SSL`         | no       | `false`        | `true` for Supabase / hosted Postgres                                           |
| `DATABASE_POOL_MAX`    | no       | 5 prod / 8 dev | Pool size. Use `1` with the local PGlite server                                 |
| `ANTHROPIC_API_KEY`    | no*      | –              | Enables AI. *Without it a deterministic rules engine is used (labelled "Rules") |
| `ANTHROPIC_MODEL_FAST` | no       | `claude-haiku-5-5` | Bulk complaint classification                                               |
| `ANTHROPIC_MODEL_DEEP` | no       | `claude-opus-5-5`  | Root-cause analysis, team recommendation, Ask ServicePulse                  |
| `AI_TIMEOUT_MS`        | no       | `25000`        | Per-request AI timeout (1 automatic retry)                                      |
| `ANALYSIS_PERIOD_DAYS` | no       | `7`            | Length of the current vs previous comparison period                             |

## Database migrations

Migrations live in `supabase/migrations/*.sql`.

```bash
npm run db:migrate          # apply pending migrations (tracked in _migrations)
npm run db:reset            # DESTRUCTIVE: drop all ServicePulse tables, then re-apply
```

With the Supabase CLI you can alternatively run `supabase db push` (the folder layout is Supabase-compatible).

## Seeding demo data

```bash
npm run db:seed
```

Creates two **fictional** banks (no real bank information is used):

| Bank               | Teams                                                    | Interactions        | Story                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kestrel Trust Bank | 13 teams in 5 departments (the structure from the brief) | ~1,050 over 8 weeks | Transfer failures +45% (emerging), mobile login +170% (critical), card payments high concern, ATM failures concentrated at two branches, branch delays at two branches |
| Harbourline Bank   | 6 teams, **no branch-operations team**                   | ~270                | USSD failures spiking; branch delays → `NO_CLEAR_OWNER` (demonstrates manual assignment)                                                                               |

Each systemic issue is written in many hidden variations (formal, angry, social-media, Nigerian Pidgin, typos) so the
classifier has to normalise them — e.g. "Money deducted", "Recipient didn't receive", "Transfer pending",
"Una don deduct my money but the person never receive am" → `TRANSFER_PROCESSING_FAILURE`.

Interactions are seeded as **pending** so you can watch the AI classify them. To run the whole pipeline headlessly:

```bash
npm run classify                         # classify every pending interaction for all banks
npm run classify -- --bank=kestrel-trust --analyze   # also root-cause + team recommendation
```

Re-running `db:seed` replaces the two demo banks. A sample import file is at `data/seed/sample-import.csv`.

## Local development

**Option A — no Docker (bundled PGlite Postgres):**

```bash
npm run db:local            # terminal 1: Postgres-compatible server on 127.0.0.1:54329 (data in ./.pglite)
npm run db:migrate && npm run db:seed
npm run dev                 # terminal 2: http://localhost:3000
```

`.env.local` for this option:
`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/postgres` and `DATABASE_POOL_MAX=1`
(PGlite is single-connection). Because of that, **stop `npm run dev` before running `db:migrate`, `db:seed` or
`classify`** — two processes cannot share the PGlite server. Stop `db:local` with Ctrl+C; killing it forcefully can
corrupt `./.pglite` — delete that folder and re-seed if it will not start. For anything beyond a quick local demo,
use Supabase (option B).

**Option B — Supabase (local CLI or cloud):** put the Supabase connection string in `DATABASE_URL`, set
`DATABASE_SSL=true` for cloud, then `npm run db:migrate && npm run db:seed && npm run dev`.

## Demo walkthrough (acceptance test)

1. **Start** `npm run dev` → **select a bank** (Kestrel Trust Bank).
2. **Dashboard** shows 1,050 interactions awaiting classification → **Classify** (progress bar; batches of 60).
3. **Customer interactions**: filter by channel / issue group / severity; see AI category, intent, sentiment,
   severity, confidence, normalised issue group and the specific issue label. **Import CSV / JSON** here.
4. **Systemic issues**: issue groups with current vs previous volume, growth %, trend status, risk score, owner.
   Toggle **Resolved (history)** for historical issues.
5. **Analyse significant issues** → likely root cause (always framed as a hypothesis), alternatives, affected systems,
   investigation steps, **recommended department / primary team / secondary team / reason / confidence**.
6. Open **Transfer Processing Failure** → _Accept recommendation & assign_ (Backend Team) or _Assign a different
   team_ (human override with reason) → _Mark investigating_ → _Mark resolved_. Add internal notes.
7. **Teams & impact**: where problems accumulate per team; edit responsibilities / product ownership.
8. **Ask ServicePulse**: e.g. "Which team should handle the biggest issue?" — answers only from database figures.
9. **Settings & audit**: every AI analysis, recommendation, rejection, assignment, override and status change.
10. Switch to **Harbourline Bank** → Branch Service Delay shows `NO_CLEAR_OWNER` → manual assignment. Kestrel's issue
    URLs return 404 while Harbourline is selected (tenant isolation).

## Deployment (Supabase + Vercel)

1. **Supabase**: create a project. Copy the **transaction pooler** connection string (port `6543`) from
   _Project Settings → Database_. (Prepared statements are disabled in the client, as the pooler requires.)
2. Run migrations and seed against it from your machine:
   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
   DATABASE_SSL=true npm run db:migrate && npm run db:seed
   ```
3. **Vercel**: import the Git repository (framework preset: Next.js). Add environment variables `DATABASE_URL`,
   `DATABASE_SSL=true`, `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL_FAST` / `ANTHROPIC_MODEL_DEEP`. Deploy.
4. Long AI routes declare `maxDuration = 60`; classification and analysis are chunked client-side so each request
   stays well inside serverless limits.

## Testing

```bash
npm test             # Vitest unit tests (56): trend bands, risk scoring, team-id validation (hallucinated /
                     # cross-bank teams rejected), team matcher, normalisation of every seeded phrasing,
                     # AI-output validation, CSV/JSON import, sanitisation & PII redaction, seed volume
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # production build
```

End-to-end check: follow the [demo walkthrough](#demo-walkthrough-acceptance-test). `npm run classify -- --analyze`
exercises the same server code paths headlessly.

## Design decisions

- **AI interprets, the application calculates.** Volumes, growth, trend bands (0–10% Stable, 11–30% Watch, 31–50%
  Emerging, 51–100% High concern, >100% Critical) and risk scores are deterministic and unit-tested. The AI receives
  pre-computed figures and is instructed never to compute its own. A low-volume guard caps spikes under 5 complaints
  at Watch.
- **Risk score** (0–100): complaint volume 20, growth 25, severity 20, customer impact 10, channel spread 10, location
  spread 5, financial impact 10 (excluded and re-normalised when no amounts exist). CRITICAL ≥ 75, HIGH ≥ 55,
  MEDIUM ≥ 35. The issue page shows every factor's evidence and points.
- **No hallucinated ownership.** Before the team-recommendation call, the bank's directory is read from the
  database and supplied to the model with team ids. Returned ids _and_ names are validated against the directory;
  any mismatch rejects the whole recommendation (`REJECTED_INVALID_TEAM`) and forces manual assignment. The model may
  return `NO_CLEAR_OWNER`. Displayed names/departments always come from the database.
- **Graceful AI failure.** No key, timeout, refusal or invalid output → a deterministic fallback (weighted phrase
  classifier, root-cause library, responsibility-keyword team matcher). Fallback results are labelled **Rules** in the
  UI and audit log; nothing is silently presented as AI.
- **Root causes are hypotheses.** Stored with status `LIKELY | POSSIBLE | REQUIRES_INVESTIGATION` and shown as "Likely
  root cause", never as fact.
- **Security.** Secrets only in server env; Zod on every input and AI output; parameterised SQL; customer text
  sanitised on ingest and PII-redacted (cards, accounts, phones, emails) before reaching the AI; prompts treat
  customer text as data; same-origin check on mutations; httpOnly bank cookie; logs never include customer content
  or prompts; basic security headers.

## Known limitations

- **No authentication / RBAC.** Bank selection is a cookie; actions are attributed to "Demo User". Suitable for a
  demo, not for production.
- The current period ends at the **latest complaint timestamp** (keeps seeded data meaningful whenever it is viewed);
  a production system would use wall-clock time.
- Without `ANTHROPIC_API_KEY` the rules fallback is tuned to the demo taxonomy; truly novel phrasing needs the AI.
- Classification and analysis run synchronously from the browser in chunks — closing the tab pauses processing.
- Issue grouping is by normalised issue code per bank; there is no embedding-based clustering of unseen issue types
  beyond what the model proposes.
- Re-analysis is manual (per issue or "Analyse significant issues" for unanalysed ones).
- The local PGlite server is for development only (single connection).

## Future production upgrades

- SSO (SAML/OIDC) with bank-scoped roles; Supabase Auth + RLS policies keyed on `bank_id` claims.
- Background job queue (e.g. Supabase queues / Vercel cron) for streaming ingestion, classification and scheduled
  re-analysis when metrics change.
- Connectors for real channels (CRM, contact-centre platform, social listening, app-store reviews) — synthetic data
  only in this MVP.
- Embedding-based semantic clustering to discover brand-new issue groups; feedback loop from human overrides to
  improve routing; evaluation harness with labelled data.
- Ticketing integrations (ServiceNow / Jira) and notifications (email, Teams, Slack) for assignments and alerts.
- SLA tracking, resolution-time analytics and regulator-ready complaint reporting.
- Observability (OpenTelemetry), rate limiting, CSP, data-retention policies and field-level encryption.
