import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RiskBadge, TrendBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { DirectoryEditor } from "@/components/teams/directory-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireBank } from "@/lib/bank-context";
import type { RiskLevel, TrendStatus } from "@/lib/constants";
import { getTeamImpact } from "@/lib/db/dashboard";
import { getDirectory, listProducts } from "@/lib/db/directory";
import { formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Teams & impact" };

export default async function TeamsPage() {
  const bank = await requireBank();
  const [impact, directory, products] = await Promise.all([
    getTeamImpact(bank.id),
    getDirectory(bank.id),
    listProducts(bank.id),
  ]);

  const byDepartment = new Map<string, typeof impact>();
  for (const t of impact) {
    byDepartment.set(t.department_name, [...(byDepartment.get(t.department_name) ?? []), t]);
  }
  const departments = [...byDepartment.entries()]
    .map(([name, teams]) => ({
      name,
      teams: teams.sort((a, b) => b.emerging_issues - a.emerging_issues || b.owned_issues - a.owned_issues),
      emerging: teams.reduce((s, t) => s + t.emerging_issues, 0),
      owned: teams.reduce((s, t) => s + t.owned_issues, 0),
    }))
    .sort((a, b) => b.emerging - a.emerging || b.owned - a.owned);
  const maxEmerging = Math.max(1, ...impact.map((t) => t.owned_issues));

  return (
    <>
      <PageHeader
        eyebrow={bank.name}
        title="Teams & impact"
        description="Where operational problems are accumulating. Each active issue counts against its assigned team, or the AI-recommended owner until a human assigns it."
      />

      <Card>
        <CardHeader>
          <CardTitle>Team impact</CardTitle>
          <CardDescription>
            Active issues owned per team; emerging = emerging, high-concern or critical growth.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          {departments.map((d) => (
            <section key={d.name} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <Building2 className="text-muted-foreground size-4" />
                  {d.name}
                </div>
                <span className="text-muted-foreground text-xs">
                  {d.emerging} emerging · {d.owned} owned
                </span>
              </div>
              <ul className="space-y-3">
                {d.teams.map((t) => (
                  <li key={t.team_id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{t.team_name}</span>
                      <span className="tabular text-muted-foreground">
                        <span className="text-foreground font-semibold">{t.emerging_issues}</span> emerging issue
                        {t.emerging_issues === 1 ? "" : "s"}
                        {t.supporting_issues > 0 && <> · supports {t.supporting_issues}</>}
                      </span>
                    </div>
                    <div className="bg-muted mt-1 flex h-2 w-full gap-0.5 rounded-full">
                      <div
                        className="h-2 rounded-full bg-[var(--series-1)]"
                        style={{ width: `${(t.emerging_issues / maxEmerging) * 100}%` }}
                      />
                      <div
                        className="h-2 rounded-full bg-[#b7d3f6]"
                        style={{ width: `${((t.owned_issues - t.emerging_issues) / maxEmerging) * 100}%` }}
                      />
                    </div>
                    {t.issues.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.issues.map((i) => (
                          <Link
                            key={`${i.id}-${i.role}`}
                            href={`/issues/${i.id}`}
                            className="bg-muted/60 hover:bg-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                          >
                            {i.title}
                            {i.role === "SECONDARY" ? (
                              <span className="text-muted-foreground">(supporting)</span>
                            ) : (
                              <>
                                <TrendBadge status={i.trend_status as TrendStatus} />
                                <RiskBadge level={i.risk_level as RiskLevel} />
                              </>
                            )}
                            {i.assigned && <span className="text-[var(--status-good)]">✓ assigned</span>}
                          </Link>
                        ))}
                      </div>
                    )}
                    {t.current_complaints > 0 && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {formatNumber(t.current_complaints)} complaints this period across owned issues
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6">
        <DirectoryEditor departments={directory} products={products.map((p) => ({ code: p.code, name: p.name }))} />
      </div>
    </>
  );
}
