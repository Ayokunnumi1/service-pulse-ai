import { CheckCircle2, FlaskConical, Target, TrendingUp, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { RunEvaluationButton } from "@/components/evaluation/run-evaluation";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBank } from "@/lib/bank-context";
import { CHANNEL_LABELS, issueTitle } from "@/lib/constants";
import { aiConfigured, aiProviderName } from "@/lib/env";
import { getChallengeReport, getSeedReport, type ItemResult, type Score } from "@/lib/evaluation/accuracy";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "AI evaluation" };

const pct = (s: Score) => (s.accuracy === null ? "—" : `${(Math.round(s.accuracy * 1000) / 10).toFixed(1)}%`);

function AccuracyBar({ correct, n, tone }: { correct: number; n: number; tone: "ai" | "rules" }) {
  if (n === 0) return <span className="text-muted-foreground text-xs">not run</span>;
  const value = Math.round((correct / n) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
        <div
          className={tone === "ai" ? "h-full bg-[var(--series-1)]" : "bg-muted-foreground/50 h-full"}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="tabular w-16 text-xs">
        {correct}/{n}
      </span>
    </div>
  );
}

function Example({ item, kind }: { item: ItemResult; kind: "win" | "miss" }) {
  const aiName = aiProviderName();
  return (
    <li className="space-y-1.5 rounded-lg border p-3 text-sm">
      <div className="text-muted-foreground text-xs">{CHANNEL_LABELS[item.channel]}</div>
      <p>&ldquo;{item.message}&rdquo;</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          Expected: <span className="font-medium">{issueTitle(item.expected)}</span>
        </span>
        {kind === "win" ? (
          <>
            <span className="flex items-center gap-1 text-[var(--status-critical)]">
              <XCircle className="size-3.5" /> Rules: {issueTitle(item.rules)}
            </span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> {aiName}: {issueTitle(item.ai ?? "")}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 text-[var(--status-critical)]">
            <XCircle className="size-3.5" /> {aiName}: {issueTitle(item.ai ?? "")}
            {item.aiConfidence !== null && ` (${Math.round(item.aiConfidence * 100)}% confident)`}
          </span>
        )}
      </div>
    </li>
  );
}

export default async function EvaluationPage() {
  const bank = await requireBank();
  const ai = aiConfigured();
  const aiName = aiProviderName();
  const [challenge, seed] = await Promise.all([getChallengeReport(bank.id), getSeedReport(bank)]);
  const hasRun = challenge.ai.n > 0;
  const lift =
    challenge.ai.accuracy !== null && challenge.rules.accuracy !== null
      ? Math.round((challenge.ai.accuracy - challenge.rules.accuracy) * 1000) / 10
      : null;
  const wins = challenge.items.filter((i) => i.ai === i.expected && i.rules !== i.expected);
  const misses = challenge.items.filter((i) => i.ai !== null && i.ai !== i.expected);

  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="AI evaluation"
        description={`How accurately does ServicePulse normalise differently-worded complaints into the right issue group? Measured against labelled ground truth — ${aiName} versus the deterministic keyword-rules fallback.`}
        actions={<RunEvaluationButton aiEnabled={ai} hasRun={hasRun} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`${aiName} accuracy (held-out)`}
          value={pct(challenge.ai)}
          sub={
            hasRun
              ? `${challenge.ai.correct} of ${challenge.ai.n} correct · ${challenge.model ?? "AI"}`
              : ai
                ? "Run the evaluation to score the AI"
                : "AI not configured"
          }
          icon={Target}
        />
        <StatCard
          label="Keyword rules accuracy (held-out)"
          value={pct(challenge.rules)}
          sub={`${challenge.rules.correct} of ${challenge.rules.n} correct · deterministic fallback`}
          icon={FlaskConical}
        />
        <StatCard
          label="Improvement from AI"
          value={lift === null ? "—" : `${lift > 0 ? "+" : ""}${lift.toFixed(1)} pts`}
          sub="Percentage points over keyword rules on unseen phrasing"
          icon={TrendingUp}
        />
        <StatCard
          label="Held-out messages"
          value={formatNumber(challenge.rules.n)}
          sub={challenge.ranAt ? `Last AI run ${formatDateTime(challenge.ranAt)}` : "Never run against the AI"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Accuracy by issue group</CardTitle>
          <CardDescription>
            Held-out challenge set: {challenge.rules.n} new messages written separately from the demo data and never
            used to build the keyword rules or the prompts — indirect descriptions, Nigerian Pidgin, sarcasm, typos,
            agent notes and social-media shorthand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expected issue group</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead>Keyword rules</TableHead>
                <TableHead>{aiName}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challenge.groups.map((g) => (
                <TableRow key={g.group}>
                  <TableCell className="font-medium">{issueTitle(g.group)}</TableCell>
                  <TableCell className="tabular text-right">{g.n}</TableCell>
                  <TableCell>
                    <AccuracyBar correct={g.rulesCorrect} n={g.n} tone="rules" />
                  </TableCell>
                  <TableCell>
                    <AccuracyBar correct={g.aiCorrect} n={g.aiN} tone="ai" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {hasRun ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Where {aiName} beats keyword rules ({wins.length})
              </CardTitle>
              <CardDescription>
                Same message, same moment: the rules engine misread it, {aiName} normalised it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {wins.length === 0 ? (
                <p className="text-muted-foreground text-sm">No differences on this run.</p>
              ) : (
                <ul className="space-y-2">
                  {wins.slice(0, 8).map((i) => (
                    <Example key={i.id} item={i} kind="win" />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                Where {aiName} got it wrong ({misses.length})
              </CardTitle>
              <CardDescription>
                Shown for transparency. Every classification is still validated, audited and can be reviewed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {misses.length === 0 ? (
                <p className="text-muted-foreground text-sm">No AI errors on this run.</p>
              ) : (
                <ul className="space-y-2">
                  {misses.map((i) => (
                    <Example key={i.id} item={i} kind="miss" />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState icon={<FlaskConical className="size-8" />} title="The AI has not been evaluated yet">
            {ai
              ? `Run the evaluation to classify the held-out messages with ${aiName} and compare against keyword rules.`
              : "Set ANTHROPIC_API_KEY or GEMINI_API_KEY to evaluate the AI. Keyword-rules accuracy above is calculated live."}
          </EmptyState>
        </div>
      )}

      {seed && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Seeded demo data (in-distribution check)</CardTitle>
            <CardDescription>
              Stored classifications of the {formatNumber(seed.labelled)} synthetic messages for this bank, compared
              with the scenario each message was generated from (hidden from the classifier). The keyword rules were
              written for these templates, so they are expected to score near 100% here — the held-out set above is the
              fair comparison.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{aiName} (stored classifications)</dt>
                <dd className="text-xl font-semibold">{pct(seed.ai)}</dd>
                <dd className="text-muted-foreground text-xs">
                  {seed.ai.n > 0
                    ? `${formatNumber(seed.ai.correct)} of ${formatNumber(seed.ai.n)} AI-classified messages`
                    : "No messages classified by AI yet — classify or re-classify with AI"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Keyword rules (live)</dt>
                <dd className="text-xl font-semibold">{pct(seed.rules)}</dd>
                <dd className="text-muted-foreground text-xs">
                  {formatNumber(seed.rules.correct)} of {formatNumber(seed.rules.n)} messages
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">AI coverage</dt>
                <dd className="text-xl font-semibold">
                  {seed.labelled === 0 ? "—" : `${Math.round((seed.ai.n / seed.labelled) * 100)}%`}
                </dd>
                <dd className="text-muted-foreground text-xs">Share of seeded messages classified by AI</dd>
              </div>
            </dl>
            {seed.aiMisses.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Sample AI disagreements
                </div>
                <ul className="space-y-1.5 text-sm">
                  {seed.aiMisses.map((m, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      &ldquo;{m.message}&rdquo; — expected{" "}
                      <span className="text-foreground">{issueTitle(m.expected)}</span>, {aiName} said{" "}
                      <span className="text-foreground">{issueTitle(m.got)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
