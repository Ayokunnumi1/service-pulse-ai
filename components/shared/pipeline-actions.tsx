"use client";

import { BrainCircuit, Loader2, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/client-api";

interface ClassifyResponse {
  processed: number;
  aiCount: number;
  rulesCount: number;
  remaining: number;
  aiAvailable: boolean;
  notes: string[];
}

/**
 * Drives /api/classify in server-sized batches until nothing is pending,
 * tracking progress. `prepare` runs first (e.g. queueing a re-classification)
 * and returns the number of interactions it queued.
 */
function useClassificationRun(initialTotal: number) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(initialTotal);

  async function run(expected: number, prepare?: () => Promise<number>) {
    setRunning(true);
    setDone(0);
    setTotal(expected);
    let ai = 0;
    let rules = 0;
    const notes = new Set<string>();
    try {
      if (prepare) {
        const queued = await prepare();
        setTotal(queued);
        if (queued === 0) {
          toast.info("Nothing to re-classify");
          return;
        }
      }
      for (let i = 0; i < 200; i++) {
        const r = await apiRequest<ClassifyResponse>("/api/classify", { limit: 60 });
        ai += r.aiCount;
        rules += r.rulesCount;
        r.notes.forEach((n) => notes.add(n));
        setDone((d) => d + r.processed);
        setTotal((t) => Math.max(t, ai + rules + r.remaining));
        if (r.remaining === 0 || r.processed === 0) break;
      }
      toast.success(`Classified ${ai + rules} interactions`, {
        description:
          ai > 0
            ? `${ai} by AI${rules ? `, ${rules} by rules fallback` : ""}. Issues and trends recalculated.`
            : `Rules fallback used (${[...notes][0] ?? "AI not configured"}). Issues and trends recalculated.`,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Classification failed");
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  return { running, done, total, run };
}

function ClassifyProgress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="bg-card ring-foreground/10 flex min-w-64 items-center gap-3 rounded-lg px-3 py-2 ring-1">
      <Loader2 className="size-4 animate-spin text-[var(--series-1)]" />
      <div className="flex-1">
        <div className="text-muted-foreground mb-1 text-xs">
          {label}…{" "}
          <span className="tabular">
            {done} / {total}
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
    </div>
  );
}

/** Classifies all pending interactions in server-sized batches with live progress. */
export function ClassifyButton({ pending, size = "default" }: { pending: number; size?: "default" | "sm" | "lg" }) {
  const { running, done, total, run } = useClassificationRun(pending);

  if (running) return <ClassifyProgress label="Classifying" done={done} total={total} />;

  return (
    <Button onClick={() => run(pending)} disabled={pending === 0} size={size}>
      <Sparkles />
      {pending > 0 ? `Classify ${pending.toLocaleString()} pending` : "All interactions classified"}
    </Button>
  );
}

/**
 * Re-classifies with AI the interactions the rules fallback handled — e.g.
 * data classified before ANTHROPIC_API_KEY was configured.
 */
export function ReclassifyButton({ rulesCount }: { rulesCount: number }) {
  const { running, done, total, run } = useClassificationRun(rulesCount);

  if (running) return <ClassifyProgress label="Re-classifying with AI" done={done} total={total} />;

  async function queue() {
    const r = await apiRequest<{ queued: number }>("/api/classify/reclassify", { scope: "RULES" });
    return r.queued;
  }

  return (
    <Button variant="outline" onClick={() => run(rulesCount, queue)} disabled={rulesCount === 0}>
      <WandSparkles />
      Re-classify {rulesCount.toLocaleString()} with AI
    </Button>
  );
}

/** Runs root-cause analysis + team recommendation for every significant issue. */
export function AnalyzeSignificantButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    let analysed = 0;
    try {
      for (let i = 0; i < 20; i++) {
        const r = await apiRequest<{ analysed: number; remaining: number }>("/api/issues/analyze-significant");
        analysed += r.analysed;
        if (r.remaining === 0 || r.analysed === 0) break;
      }
      toast.success(
        analysed > 0
          ? `Analysed ${analysed} significant issue${analysed === 1 ? "" : "s"}`
          : "All significant issues already analysed",
        { description: "Root causes and responsible-team recommendations are ready for review." },
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button onClick={run} disabled={running} variant={variant}>
      {running ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
      {running ? "Analysing issues…" : "Analyse significant issues"}
    </Button>
  );
}

export function RecomputeButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    try {
      const r = await apiRequest<{ issues: number }>("/api/issues/recompute");
      toast.success(`Recalculated ${r.issues} issue groups`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recalculation failed");
    } finally {
      setRunning(false);
    }
  }
  return (
    <Button variant="outline" onClick={run} disabled={running}>
      <RefreshCw className={running ? "animate-spin" : undefined} />
      Recalculate trends
    </Button>
  );
}
