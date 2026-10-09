"use client";

import { BrainCircuit, CheckCircle2, Loader2, RotateCcw, Search, UserRoundCheck, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client-api";
import type { IssueStatus } from "@/lib/constants";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

export function AnalyzeIssueButton({ issueId, hasAnalysis }: { issueId: string; hasAnalysis: boolean }) {
  const { busy, run } = useAction();
  return (
    <Button
      variant={hasAnalysis ? "outline" : "default"}
      disabled={busy !== null}
      onClick={() =>
        run(
          "analyze",
          () => apiRequest(`/api/issues/${issueId}/analyze`),
          "Root-cause analysis and team recommendation updated",
        )
      }
    >
      {busy ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
      {busy ? "Analysing…" : hasAnalysis ? "Re-run AI analysis" : "Run AI analysis"}
    </Button>
  );
}

export interface TeamOption {
  id: string;
  name: string;
  department_name: string;
}

export function AssignmentControls({
  issueId,
  analysisId,
  canAccept,
  recommendedTeamName,
  assignedTeamId,
  teams,
}: {
  issueId: string;
  analysisId: string | null;
  canAccept: boolean;
  recommendedTeamName: string | null;
  assignedTeamId: string | null;
  teams: TeamOption[];
}) {
  const { busy, run } = useAction();
  const [overriding, setOverriding] = useState(false);
  // With no recommendation to accept and no owner yet, the manual form is the only path.
  const showForm = overriding || (!canAccept && !assignedTeamId);
  const [teamId, setTeamId] = useState<string>("");
  const [reason, setReason] = useState("");

  const departments = [...new Set(teams.map((t) => t.department_name))];

  return (
    <div className="space-y-3">
      {canAccept && analysisId && !overriding && (
        <div className="flex flex-col gap-2">
          <Button
            disabled={busy !== null}
            onClick={() =>
              run(
                "accept",
                () => apiRequest(`/api/issues/${issueId}/assign`, { mode: "accept", analysisId }),
                `Issue assigned to ${recommendedTeamName}`,
              )
            }
          >
            {busy === "accept" ? <Loader2 className="animate-spin" /> : <UserRoundCheck />}
            Accept recommendation &amp; assign
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOverriding(true)}>
            <UserRoundCog /> Assign a different team (override)
          </Button>
        </div>
      )}

      {!canAccept && assignedTeamId && !overriding && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setOverriding(true)}>
          <UserRoundCog /> Reassign to another team
        </Button>
      )}

      {showForm && (
        <form
          className="bg-muted/50 space-y-3 rounded-lg p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(
              "override",
              () => apiRequest(`/api/issues/${issueId}/assign`, { mode: "override", teamId, reason }),
              "Issue assigned (human override recorded in audit log)",
            );
            if (ok) {
              setReason("");
              setTeamId("");
              setOverriding(false);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="team">Assign to team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="team" className="bg-card w-full">
                <SelectValue placeholder="Choose a team from the directory" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectGroup key={d}>
                    <SelectLabel>{d}</SelectLabel>
                    {teams
                      .filter((t) => t.department_name === d)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id} disabled={t.id === assignedTeamId}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">
              Reason {canAccept ? "for overriding the recommendation" : "for this assignment"}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              className="bg-card"
              placeholder="e.g. Incident already open with this team"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!teamId || reason.trim().length < 3 || busy !== null}>
              {busy === "override" ? <Loader2 className="animate-spin" /> : <UserRoundCog />}
              Assign team
            </Button>
            {overriding && (
              <Button type="button" variant="ghost" onClick={() => setOverriding(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export function StatusControls({
  issueId,
  status,
  assigned,
}: {
  issueId: string;
  status: IssueStatus;
  assigned: boolean;
}) {
  const { busy, run } = useAction();
  const set = (next: IssueStatus, message: string) =>
    run(next, () => apiRequest(`/api/issues/${issueId}/status`, { status: next }), message);

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "INVESTIGATING" && status !== "RESOLVED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={!assigned || busy !== null}
          onClick={() => set("INVESTIGATING", "Marked as investigating")}
        >
          {busy === "INVESTIGATING" ? <Loader2 className="animate-spin" /> : <Search />} Mark investigating
        </Button>
      )}
      {status !== "RESOLVED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => set("RESOLVED", "Issue marked resolved")}
        >
          {busy === "RESOLVED" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark resolved
        </Button>
      )}
      {status === "RESOLVED" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => set(assigned ? "ASSIGNED" : "OPEN", "Issue reopened")}
        >
          <RotateCcw /> Reopen
        </Button>
      )}
      {!assigned && status !== "RESOLVED" && (
        <p className="text-muted-foreground w-full text-xs">Assign a team before moving to investigation.</p>
      )}
    </div>
  );
}

export function NoteForm({ issueId }: { issueId: string }) {
  const { busy, run } = useAction();
  const [note, setNote] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run("note", () => apiRequest(`/api/issues/${issueId}/notes`, { note }), "Note added")) setNote("");
      }}
    >
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Add an internal note for the investigating teams…"
      />
      <Button type="submit" size="sm" disabled={!note.trim() || busy !== null}>
        {busy && <Loader2 className="animate-spin" />} Add note
      </Button>
    </form>
  );
}
