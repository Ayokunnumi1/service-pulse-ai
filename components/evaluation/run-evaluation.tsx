"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";

interface RunResponse {
  ai: { n: number; correct: number; accuracy: number | null };
  rules: { n: number; correct: number; accuracy: number | null };
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 1000) / 10}%`);

export function RunEvaluationButton({ aiEnabled, hasRun }: { aiEnabled: boolean; hasRun: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const r = await apiRequest<RunResponse>("/api/evaluation/run");
      toast.success(`AI accuracy ${pct(r.ai.accuracy)} vs rules ${pct(r.rules.accuracy)}`, {
        description:
          r.ai.n < r.rules.n
            ? `${r.rules.n - r.ai.n} item(s) could not be scored by the AI and are excluded.`
            : `${r.ai.correct} of ${r.ai.n} held-out messages normalised correctly.`,
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      onClick={run}
      disabled={running || !aiEnabled}
      title={aiEnabled ? undefined : "Set ANTHROPIC_API_KEY or GEMINI_API_KEY first"}
    >
      {running ? <Loader2 className="animate-spin" /> : <FlaskConical />}
      {running ? "Evaluating…" : hasRun ? "Re-run AI evaluation" : "Run AI evaluation"}
    </Button>
  );
}
