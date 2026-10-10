"use client";

import { ArrowRight, BrainCircuit, CircleHelp, Database, Info, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";

interface AssistantResponse {
  answer: string;
  key_points: string[];
  referenced_issues: { id: string; issue_code: string; title: string }[];
  data_limitations: string | null;
  method: "AI" | "RULES";
  model: string | null;
  note: string | null;
}

interface Exchange {
  question: string;
  response: AssistantResponse;
  at: Date;
}

const SUGGESTED = [
  "What is our biggest customer problem this week?",
  "Which team should handle the biggest issue?",
  "Which issues are increasing fastest?",
  "What products are causing the most complaints?",
  "Which branches are most affected?",
  "What should management prioritise today?",
];

export function Assistant() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    try {
      const response = await apiRequest<AssistantResponse>("/api/assistant", { question: text });
      setHistory((h) => [{ question: text, response, at: new Date() }, ...h]);
      setQuestion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ServicePulse could not answer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <div className="relative flex-1">
                <BrainCircuit className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about complaints, emerging issues, products, branches or owning teams…"
                  className="h-10 pl-9"
                  maxLength={500}
                  disabled={busy}
                />
              </div>
              <Button type="submit" className="h-10" disabled={busy || question.trim().length < 3}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
                Ask
              </Button>
            </form>
          </CardContent>
        </Card>

        {busy && (
          <div className="bg-card text-muted-foreground ring-foreground/10 flex items-center gap-2 rounded-xl p-4 text-sm ring-1">
            <Loader2 className="size-4 animate-spin" /> Building a data snapshot from the database and preparing a
            grounded answer…
          </div>
        )}

        {history.length === 0 && !busy && (
          <div className="bg-card text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            <CircleHelp className="mx-auto mb-2 size-6" />
            Choose a suggested question or ask your own. Answers use only figures computed from this bank&apos;s data.
          </div>
        )}

        {history.map((ex) => (
          <Card key={ex.at.getTime()}>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-muted-foreground text-sm font-medium">{ex.question}</div>
                <MethodBadge method={ex.response.method} model={ex.response.model} />
              </div>
              <p className="text-lg leading-snug font-medium">{ex.response.answer}</p>
              {ex.response.key_points.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {ex.response.key_points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--series-1)]" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              {ex.response.referenced_issues.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {ex.response.referenced_issues.map((i) => (
                    <Link
                      key={i.id}
                      href={`/issues/${i.id}`}
                      className="bg-muted hover:bg-accent inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium"
                    >
                      {i.title} <ArrowRight className="size-3" />
                    </Link>
                  ))}
                </div>
              )}
              {(ex.response.data_limitations || ex.response.note) && (
                <div className="bg-muted/50 text-muted-foreground flex gap-2 rounded-lg p-2.5 text-xs">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <div>
                    {ex.response.data_limitations && <div>Data limitation: {ex.response.data_limitations}</div>}
                    {ex.response.note && <div>{ex.response.note}</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent>
            <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
              Suggested questions
            </div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  disabled={busy}
                  onClick={() => ask(q)}
                  className="ring-border hover:bg-muted rounded-lg px-3 py-2 text-left text-sm ring-1 transition disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <div className="text-foreground flex items-center gap-2 font-medium">
              <Database className="size-4" /> How answers are grounded
            </div>
            <p>
              Each question sends the model a fresh snapshot computed from the database: KPIs, issue metrics, trends,
              risk scores, root-cause hypotheses, owners, products, branches and channels.
            </p>
            <p>
              The model is instructed to quote only figures present in that snapshot and to say when data is missing.
              Referenced issues are checked against the database.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
