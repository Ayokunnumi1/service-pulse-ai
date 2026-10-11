"use client";

import { ArrowRight, CircleCheck, Circle, Eraser, Loader2, Siren } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { RiskBadge, TrendBadge } from "@/components/shared/badges";
import { describeMerges, type ConsolidationResponse } from "@/components/shared/pipeline-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/client-api";
import type { RiskLevel, TrendStatus } from "@/lib/constants";
import { INCIDENT_SCENARIOS, type IncidentScenarioKey } from "@/lib/simulation/scenarios";
import { cn } from "@/lib/utils";

interface LocatedIssue {
  id: string;
  issue_code: string;
  title: string;
  count: number;
  trend_status: TrendStatus;
  risk_level: RiskLevel;
  risk_score: number;
}

interface SimulateResponse {
  batchId: string;
  injected: number;
  interactionIds: string[];
  aiCount: number;
  rulesCount: number;
  notes: string[];
  issues: LocatedIssue[];
}

interface AnalyzeResponse {
  method: "AI" | "RULES";
  ownershipStatus: "RECOMMENDED" | "NO_CLEAR_OWNER" | "REJECTED_INVALID_TEAM";
}

type Phase = "pick" | "classifying" | "consolidating" | "analysing" | "done";

const COUNT = 28;

/**
 * Live demo of the full pipeline: inject a burst of complaints about one
 * incident → classify & normalise → trend/risk detection → root cause and
 * responsible-team recommendation → open the investigation page.
 */
export function SimulateIncidentDialog({
  aiEnabled,
  simulatedCount,
  classifier,
  analyst,
}: {
  aiEnabled: boolean;
  simulatedCount: number;
  /** Display names of the fast/deep models, e.g. "Claude Haiku" — "rules engine" without AI. */
  classifier: string;
  analyst: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<IncidentScenarioKey>(INCIDENT_SCENARIOS[0].key);
  const [phase, setPhase] = useState<Phase>("pick");
  const [sim, setSim] = useState<SimulateResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [consolidation, setConsolidation] = useState<ConsolidationResponse | null>(null);
  const [clearing, setClearing] = useState(false);

  const main = sim?.issues[0] ?? null;
  const running = phase === "classifying" || phase === "consolidating" || phase === "analysing";

  function reset() {
    setPhase("pick");
    setSim(null);
    setAnalysis(null);
    setConsolidation(null);
  }

  async function run() {
    setPhase("classifying");
    setSim(null);
    setAnalysis(null);
    setConsolidation(null);
    let injected = false;
    try {
      const r = await apiRequest<SimulateResponse>("/api/simulate", { scenario, count: COUNT });
      injected = true;
      setSim(r);
      let issues = r.issues;
      if (r.aiCount > 0) {
        // The AI may have split the incident across new, near-duplicate groups — merge them.
        setPhase("consolidating");
        const c = await apiRequest<ConsolidationResponse>("/api/issues/consolidate");
        setConsolidation(c);
        if (c.merges.length > 0) {
          issues = (
            await apiRequest<{ issues: LocatedIssue[] }>("/api/simulate/locate", {
              interactionIds: r.interactionIds,
            })
          ).issues;
          setSim({ ...r, issues });
        }
      }
      const top = issues[0];
      if (!top) {
        toast.warning("No complaint issue was detected for the simulated messages.");
        setPhase("done");
        router.refresh();
        return;
      }
      setPhase("analysing");
      const a = await apiRequest<AnalyzeResponse>(`/api/issues/${top.id}/analyze`);
      setAnalysis(a);
      setPhase("done");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simulation failed");
      setPhase(injected ? "done" : "pick");
      router.refresh();
    }
  }

  async function clearSimulated() {
    setClearing(true);
    try {
      const r = await apiRequest<{ removed: number }>("/api/simulate", undefined, "DELETE");
      toast.success(`Removed ${r.removed} simulated interaction${r.removed === 1 ? "" : "s"}`, {
        description: "Issues and trends recalculated.",
      });
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove simulated data");
    } finally {
      setClearing(false);
    }
  }

  const steps: { label: string; state: "todo" | "active" | "done" }[] = [
    {
      label: `Inject ${COUNT} complaints from different channels and phrasings`,
      state: phase === "pick" ? "todo" : "done",
    },
    {
      label: `Classify and normalise into issue groups (${classifier}), recalculate trends and risk`,
      state: phase === "classifying" ? "active" : phase === "pick" ? "todo" : "done",
    },
    ...(aiEnabled
      ? [
          {
            label: `Merge near-duplicate issue groups into one problem (${analyst})`,
            state:
              phase === "consolidating"
                ? ("active" as const)
                : (phase === "analysing" || phase === "done") && consolidation
                  ? ("done" as const)
                  : ("todo" as const),
          },
        ]
      : []),
    {
      label: `Root-cause hypothesis and responsible-team recommendation (${analyst})`,
      state: phase === "analysing" ? "active" : phase === "done" && analysis ? "done" : "todo",
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (running) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Siren /> Simulate incident
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Simulate an operational incident</DialogTitle>
          <DialogDescription>
            Injects a burst of synthetic customer complaints into the current period and runs them through the full
            ServicePulse pipeline. Simulated records are tagged <code>SIM-</code> and can be removed at any time.
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" ? (
          <div className="grid gap-2" role="radiogroup" aria-label="Incident scenario">
            {INCIDENT_SCENARIOS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={scenario === s.key}
                onClick={() => setScenario(s.key)}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors",
                  scenario === s.key
                    ? "border-(--series-1) bg-(--series-1)/5 ring-1 ring-(--series-1)"
                    : "hover:bg-muted/50",
                )}
              >
                <div className="font-medium">{s.title}</div>
                <div className="text-muted-foreground mt-0.5 text-xs">{s.description}</div>
              </button>
            ))}
          </div>
        ) : (
          <ol className="space-y-2.5 text-sm">
            {steps.map((s) => (
              <li key={s.label} className="flex items-start gap-2.5">
                {s.state === "done" ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : s.state === "active" ? (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-(--series-1)" />
                ) : (
                  <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                )}
                <span className={s.state === "todo" ? "text-muted-foreground" : undefined}>{s.label}</span>
              </li>
            ))}
          </ol>
        )}

        {sim && (
          <div className="bg-muted/60 space-y-2 rounded-lg p-3 text-sm">
            <div className="text-muted-foreground text-xs">
              Batch SIM-{sim.batchId}: {sim.injected} complaints · {sim.aiCount} classified by AI
              {sim.rulesCount > 0 && `, ${sim.rulesCount} by rules fallback`}
            </div>
            {main && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{main.title}</span>
                  <TrendBadge status={main.trend_status} />
                  <RiskBadge level={main.risk_level} score={main.risk_score} />
                </div>
                <div className="text-muted-foreground text-xs">
                  {main.count} of {sim.injected} complaints normalised into <code>{main.issue_code}</code>
                  {sim.issues.length > 1 &&
                    ` · also: ${sim.issues
                      .slice(1, 3)
                      .map((i) => `${i.title} (${i.count})`)
                      .join(", ")}`}
                </div>
                {analysis && (
                  <div className="text-xs">
                    {analysis.ownershipStatus === "RECOMMENDED"
                      ? "Root cause and responsible team recommended — ready for review."
                      : "Root cause drafted — no clear owner in the directory, manual assignment required."}
                  </div>
                )}
              </>
            )}
            {consolidation && consolidation.merges.length > 0 && (
              <div className="text-xs">Merged: {describeMerges(consolidation)}</div>
            )}
            {sim.notes[0] && <div className="text-muted-foreground text-xs">{sim.notes[0]}</div>}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={clearSimulated}
            disabled={running || clearing || (simulatedCount === 0 && !sim)}
            title="Delete all SIM- interactions for this bank"
          >
            {clearing ? <Loader2 className="animate-spin" /> : <Eraser />}
            Remove simulated data
          </Button>
          <div className="flex gap-2">
            {phase === "done" && main ? (
              <Button
                onClick={() => {
                  setOpen(false);
                  router.push(`/issues/${main.id}`);
                }}
              >
                Open investigation <ArrowRight />
              </Button>
            ) : (
              <Button onClick={run} disabled={running}>
                {running ? <Loader2 className="animate-spin" /> : <Siren />}
                {running ? "Running pipeline…" : "Run simulation"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
