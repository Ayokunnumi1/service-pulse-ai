import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InteractionFilters } from "@/components/complaints/filters";
import { ImportDialog } from "@/components/complaints/import-dialog";
import { MethodBadge, SeverityBadge } from "@/components/shared/badges";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { ClassifyButton } from "@/components/shared/pipeline-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireBank } from "@/lib/bank-context";
import {
  CHANNEL_LABELS,
  CHANNELS,
  INTENTS,
  INTERACTION_STATUSES,
  SEVERITIES,
  humanize,
  issueTitle,
} from "@/lib/constants";
import { getPendingCount, listInteractions, listIssueGroupsInUse, parseFilters } from "@/lib/db/interactions";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Customer interactions" };

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bank = await requireBank();
  const params = await searchParams;
  const filters = parseFilters(params);
  const [result, pending, groups] = await Promise.all([
    listInteractions(bank.id, filters),
    getPendingCount(bank.id),
    listIssueGroupsInUse(bank.id),
  ]);

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page") next.set(k, v);
    next.set("page", String(page));
    return `/complaints?${next.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="Customer interactions"
        description="Every interaction from branches, contact centre, email, mobile app, USSD, WhatsApp, social media and web — with its AI classification and normalised issue group."
        actions={
          <>
            <ImportDialog />
            {pending > 0 && <ClassifyButton pending={pending} />}
          </>
        }
      />

      <div className="mb-4">
        <Suspense>
          <InteractionFilters
            channels={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))}
            issueGroups={groups.map((g) => ({ value: g, label: issueTitle(g) }))}
            intents={INTENTS.map((i) => ({ value: i, label: humanize(i) }))}
            severities={SEVERITIES.map((s) => ({ value: s, label: humanize(s) }))}
            statuses={INTERACTION_STATUSES.map((s) => ({
              value: s,
              label: s === "PENDING" ? "Awaiting classification" : humanize(s),
            }))}
          />
        </Suspense>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState icon={<Inbox className="size-8" />} title="No interactions match">
          Adjust the filters, import a CSV/JSON file, or run <code>npm run db:seed</code>.
        </EmptyState>
      ) : (
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-[38%] pl-4">Customer message</TableHead>
                  <TableHead>Channel / location</TableHead>
                  <TableHead>Issue group (normalised)</TableHead>
                  <TableHead>Intent · sentiment</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="pr-4">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.id} className="align-top">
                    <TableCell className="pl-4 whitespace-normal">
                      <p className="line-clamp-3 text-sm">{r.message}</p>
                      <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 text-xs">
                        {r.customer_reference && <span>{r.customer_reference}</span>}
                        {r.product && <span>Product: {r.product}</span>}
                        {r.amount !== null && <span>{formatMoney(r.amount, bank.currency)}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{CHANNEL_LABELS[r.channel] ?? r.channel}</div>
                      <div className="text-muted-foreground text-xs">
                        {[r.branch, r.location].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-normal">
                      {r.issue_group ? (
                        <>
                          <Link href={`/complaints?issue=${r.issue_group}`} className="font-medium hover:underline">
                            {issueTitle(r.issue_group)}
                          </Link>
                          <div className="text-muted-foreground font-mono text-[11px]">{r.issue}</div>
                        </>
                      ) : (
                        <Badge variant="outline">Awaiting classification</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.intent ? (
                        <>
                          <div>{humanize(r.intent)}</div>
                          <div className="text-muted-foreground text-xs">{humanize(r.sentiment)}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={r.severity} />
                    </TableCell>
                    <TableCell>
                      {r.confidence !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="tabular text-sm">{Math.round(r.confidence * 100)}%</span>
                          <MethodBadge method={r.method} />
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-4 text-xs">
                      {formatDateTime(r.occurred_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-3 text-sm">
            <span>
              {formatNumber(result.total)} interactions · page {result.page} of {result.pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={pageHref(Math.max(1, result.page - 1))}
                  aria-disabled={result.page <= 1}
                  className={result.page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <ChevronLeft /> Previous
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={pageHref(Math.min(result.pageCount, result.page + 1))}
                  aria-disabled={result.page >= result.pageCount}
                  className={result.page >= result.pageCount ? "pointer-events-none opacity-50" : ""}
                >
                  Next <ChevronRight />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
