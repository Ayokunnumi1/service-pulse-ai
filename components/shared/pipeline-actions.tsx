"use client";

import { BrainCircuit, Loader2, RefreshCw, Sparkles } from "lucide-react";
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

/** Classifies all pending interactions in server-sized batches with live progress. */
export function ClassifyButton({ pending, size = "default" }: { pending: number; size?: "default" | "sm" | "lg" }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(pending);

  async function run() {
    setRunning(true);
    setDone(0);
    setTotal(pending);
    let ai = 0;
    let rules = 0;
    const notes = new Set<string>();
    try {
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

  if (running) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="bg-card ring-foreground/10 flex min-w-64 items-center gap-3 rounded-lg px-3 py-2 ring-1">
        <Loader2 className="size-4 animate-spin text-[var(--series-1)]" />
        <div className="flex-1">
          <div className="text-muted-foreground mb-1 text-xs">
            Classifying…{" "}
            <span className="tabular">
              {done} / {total}
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      </div>
    );
  }

  return (
    <Button onClick={run} disabled={pending === 0} size={size}>
      <Sparkles />
      {pending > 0 ? `Classify ${pending.toLocaleString()} pending` : "All interactions classified"}
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
