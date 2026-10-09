import type { Metadata } from "next";
import Link from "next/link";
import { MethodBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { RecomputeButton } from "@/components/shared/pipeline-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBank } from "@/lib/bank-context";
import { humanize, TREND_LABELS } from "@/lib/constants";
import { listAudit } from "@/lib/db/audit";
import { aiConfigured, env } from "@/lib/env";
import { RISK_LEVEL_THRESHOLDS, RISK_WEIGHTS } from "@/lib/scoring/risk";
import { NEW_ISSUE_MIN_VOLUME, TREND_THRESHOLDS } from "@/lib/scoring/trend";
import { formatConfidence, formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Settings & audit" };

const RISK_LABELS: Record<keyof typeof RISK_WEIGHTS, string> = {
  volume: "Complaint volume (share of period complaints)",
  growth: "Growth rate (trend status)",
  severity: "Average severity",
  customer_impact: "Customer impact (negative sentiment)",
  channels: "Number of channels",
  locations: "Number of locations",
  financial: "Financial impact (if amounts available)",
};

export default async function SettingsPage() {
  const bank = await requireBank();
  const audit = await listAudit(bank.id, { limit: 150 });
  const ai = aiConfigured();
  const { OPENAI_MODEL, ANALYSIS_PERIOD_DAYS, AI_TIMEOUT_MS } = env();

  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="Settings & audit"
        description="Institution profile, AI engine configuration, deterministic engine rules and the audit log."
        actions={<RecomputeButton />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Institution</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Name</dt>
                <dd className="font-medium">{bank.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Description</dt>
                <dd>{bank.description}</dd>
              </div>
              <div className="flex gap-6">
                <div>
                  <dt className="text-muted-foreground text-xs">Status</dt>
                  <dd>{humanize(bank.status)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Currency</dt>
                  <dd>{bank.currency}</dd>
                </div>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Tenant isolation</dt>
                <dd className="text-muted-foreground">
                  Every query is scoped by bank id; composite foreign keys block cross-bank references; RLS denies
                  public API access.
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI engine</CardTitle>
            <CardDescription>Server-side only — keys never reach the browser.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="flex items-center gap-2">
                  {ai ? "OpenAI" : "Not configured"} <MethodBadge method={ai ? "AI" : "RULES"} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-mono text-xs">{ai ? OPENAI_MODEL : "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Timeout</dt>
                <dd>{AI_TIMEOUT_MS / 1000}s · 2 retries</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Output validation</dt>
                <dd>Structured outputs + Zod</dd>
              </div>
            </dl>
            {!ai && (
              <p className="bg-muted/60 text-muted-foreground mt-3 rounded-lg p-2.5 text-xs">
                Set <code>OPENAI_API_KEY</code> to enable AI classification, root-cause analysis, team recommendation
                and Ask ServicePulse. Until then a deterministic rules engine is used and labelled &ldquo;Rules&rdquo;.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Early-warning engine</CardTitle>
            <CardDescription>Deterministic — the AI never does this arithmetic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-muted-foreground">
              Current period = the {ANALYSIS_PERIOD_DAYS} days ending at the latest complaint, compared with the
              previous {ANALYSIS_PERIOD_DAYS} days.
            </div>
            <table className="w-full">
              <tbody>
                {TREND_THRESHOLDS.map((t) => (
                  <tr key={t.status} className="border-b last:border-0">
                    <td className="text-muted-foreground py-1.5">{t.label} growth</td>
                    <td className="py-1.5 text-right font-medium">{TREND_LABELS[t.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted-foreground text-xs">
              New issues (no baseline) are Emerging from {NEW_ISSUE_MIN_VOLUME} complaints; rises below{" "}
              {NEW_ISSUE_MIN_VOLUME} complaints are capped at Watch.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Risk prioritisation weights</CardTitle>
          <CardDescription>
            Levels: {RISK_LEVEL_THRESHOLDS.map((t) => `${humanize(t.level)} ≥ ${t.min}`).join(" · ")}. Factors without
            data are excluded and weights re-normalised.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(RISK_WEIGHTS) as (keyof typeof RISK_WEIGHTS)[]).map((k) => (
            <div key={k} className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
              <span>{RISK_LABELS[k]}</span>
              <span className="tabular font-semibold">{RISK_WEIGHTS[k]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6 py-0">
        <CardHeader className="pt-4">
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            Every AI analysis, recommendation, rejection, assignment, override and status change (latest 150).
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-4">Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Root cause</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id} className="align-top text-xs">
                  <TableCell className="text-muted-foreground pl-4 whitespace-nowrap">
                    {formatDateTime(a.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{humanize(a.event_type)}</div>
                    {a.method && <MethodBadge method={a.method as "AI" | "RULES"} model={a.model} />}
                    {a.event_type === "CLASSIFICATION_BATCH" && a.details !== null && typeof a.details === "object" && (
                      <div className="text-muted-foreground mt-1">
                        {String((a.details as { ai_classified?: number }).ai_classified ?? 0)} AI ·{" "}
                        {String((a.details as { rules_classified?: number }).rules_classified ?? 0)} rules
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{a.actor}</TableCell>
                  <TableCell>
                    {a.issue_id ? (
                      <Link href={`/issues/${a.issue_id}`} className="hover:underline">
                        {a.issue_title ?? a.detected_issue}
                      </Link>
                    ) : (
                      (a.detected_issue ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">{a.root_cause ?? "—"}</TableCell>
                  <TableCell>
                    {a.recommended_team_name ?? "—"}
                    {a.confidence !== null && (
                      <span className="text-muted-foreground"> · {formatConfidence(a.confidence)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.assigned_team_name ?? "—"}
                    {a.human_override && <div className="font-medium text-[var(--status-serious)]">Human override</div>}
                  </TableCell>
                  <TableCell className="pr-4">{a.final_status ? humanize(a.final_status) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
