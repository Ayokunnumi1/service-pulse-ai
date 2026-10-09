"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

export interface TrendSeries {
  key: string; // data key (issue title)
  color: string;
}

function TrendTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const rows = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="bg-popover ring-foreground/10 min-w-48 rounded-lg p-2.5 text-xs shadow-lg ring-1">
      <div className="text-muted-foreground mb-1.5 font-medium">Week ending {label}</div>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular text-foreground font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Weekly complaint volume per issue group: one axis, thin lines, crosshair tooltip. */
export function TrendChart({ data, series }: { data: Record<string, number | string>[]; series: TrendSeries[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Weekly complaints by issue group">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--chart-axis)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={(props) => <TrendTooltip {...props} />}
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span className="text-muted-foreground">{value}</span>}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
