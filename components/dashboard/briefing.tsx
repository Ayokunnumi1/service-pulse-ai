"use client";

import { Loader2, Newspaper, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client-api";

export function GenerateBriefingButton({ hasBriefing, stale }: { hasBriefing: boolean; stale: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    try {
      const r = await apiRequest<{ method: "AI" | "RULES"; note: string | null }>("/api/briefing");
      if (r.note) toast.info("Briefing updated", { description: r.note });
      else toast.success("Briefing updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate the briefing");
    } finally {
      setRunning(false);
    }
  }
  return (
    <Button size="sm" variant={hasBriefing && !stale ? "ghost" : "default"} onClick={run} disabled={running}>
      {running ? <Loader2 className="animate-spin" /> : hasBriefing ? <RefreshCw /> : <Newspaper />}
      {running ? "Writing briefing…" : hasBriefing ? "Refresh" : "Generate today's briefing"}
    </Button>
  );
}
