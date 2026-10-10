# ServicePulse AI

**Multi-Bank Dispute Aggregation & Distillation Engine for Nigerian Commercial Banking**

---

## The Problem

Nigerian commercial banking suffers from fragmented customer complaint touchpoints. When USSD sessions drop (*966# / *945#), POS debits fail without dispense, or branch backlogs cascade into social media mentions, the signals are scattered. This creates massive blind spots, manual triage bottlenecks, and ultimately, breaches of CBN SLA (Central Bank of Nigeria Service Level Agreements). Operators are left reacting to noise rather than resolving systemic faults.

## The Solution

ServicePulse AI is a unified multi-tenant ingestion, automated distillation, and structured dispatch engine designed for institutional feeds (Zenith Bank, Wema Bank, ALAT, etc.). 

Raw, unstructured multi-channel complaints are ingested, normalised, and routed deterministically. We don't just classify what went wrong; we compute risk based on institutional data density, and our AI hypothesises the root cause while recommending the exact internal team responsible—pulled dynamically from the bank's own operational directory.

## Architecture Diagram

```text
[Raw Ingestion]                 [NLP Distillation]                   [SLA Triage Matrix]
USSD / POS / Social   --->   Intent & Sentiment Parser   --->   Trend & Risk Scoring (Deterministic)
Email / Branch        --->   Entity & Product Extraction --->   AI Root Cause Hypothesis
Mobile App            --->   Issue Normalisation         --->   Team Recommendation (Directory-Grounded)
                                                                 |
                                                                 v
                                                        [Human Oversight & Dispatch]
                                                        Status Tracking & Audit Log
```

## Quickstart

Spin up the entire application locally in under 60 seconds (using a bundled PGlite database).

```bash
# 1. Clone & Install
git clone https://github.com/Ayokunnumi1/service-pulse-ai.git
cd service-pulse-ai
npm install

# 2. Configure Environment
cp .env.example .env.local

# 3. Boot Local DB, Seed Data & Start Server
npm run db:local
npm run db:migrate && npm run db:seed
npm run dev
```

*Note: You will need two terminals running if you use `db:local` and `npm run dev` concurrently.*

## Demo Tour (Evaluation Click-Path)

Follow this path to evaluate the core product strengths during live judging:

1. **Dashboard Entry:** Select **Zenith Bank** (or the primary demo institution). You will see the executive dashboard with dense, high-contrast KPIs and systemic issue groupings.
2. **Customer Interactions:** Navigate to the interactions feed. Observe the granular, omni-channel logs (USSD, POS, Web). See how raw customer frustration is distilled into structured SLA data.
3. **Systemic Issues:** Click into an emerging issue (e.g., "USSD Gateway Timeout" or "POS Debit Without Dispense").
4. **Issue Detail & Triage:** Review the AI-generated root cause hypothesis. Note that the assigned team is grounded in reality—pulled directly from the bank's responsibility matrix.
5. **Audit Trail:** Execute a manual override or status change, and observe the rigorous audit log capturing the exact operational transition.

## Design Decisions

- **Deterministic Scoring over Hallucination:** Risk scores and trend bands are hard-coded calculations. AI is strictly confined to NLP distillation and root-cause hypothesis, eliminating mathematical hallucinations.
- **Strict Tenant Isolation:** All queries are parameterized with composite foreign keys. Cross-bank data leakage is structurally impossible.
- **Institutional UX:** Designed for high data density. We discarded generic SaaS glassmorphism in favor of crisp borders, strict monospace audit trails, and high-contrast Zenith Red (`#D32F2F`) accents that Nigerian operators trust.
