import type { RiskLevel } from "@/lib/constants";
import { RISK_LEVEL_THRESHOLDS, type RiskFactor } from "@/lib/scoring/risk";

export function RiskBreakdown({ factors, score, level }: { factors: RiskFactor[]; score: number; level: RiskLevel }) {
  const available = factors.filter((f) => f.available);
  const totalWeight = available.reduce((s, f) => s + f.weight, 0);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="py-2 pr-3 font-medium">Factor</th>
              <th className="py-2 pr-3 font-medium">Evidence</th>
              <th className="py-2 pr-3 text-right font-medium">Weight</th>
              <th className="py-2 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.key} className={`border-b last:border-0 ${f.available ? "" : "text-muted-foreground"}`}>
                <td className="py-2 pr-3 font-medium whitespace-nowrap">{f.label}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-muted h-1.5 w-16 shrink-0 rounded-full">
                      <div
                        className="h-1.5 rounded-full bg-[var(--series-1)]"
                        style={{ width: `${Math.round(f.value * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs">{f.detail}</span>
                  </div>
                </td>
                <td className="tabular py-2 pr-3 text-right">
                  {f.available ? `${Math.round((f.weight / totalWeight) * 100)}%` : "—"}
                </td>
                <td className="tabular py-2 text-right font-medium">{f.available ? f.points.toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-sm font-medium">
                Risk score
              </td>
              <td className="tabular pt-3 text-right text-base font-semibold">{score}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Levels: {RISK_LEVEL_THRESHOLDS.map((t) => `${t.level} ≥ ${t.min}`).join(" · ")}. This issue is{" "}
        <strong>{level}</strong>.
      </p>
    </div>
  );
}
