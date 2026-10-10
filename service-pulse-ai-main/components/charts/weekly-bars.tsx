"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Weekly volume for one issue; the current period is emphasised, earlier weeks recede. */
export function WeeklyBars({ data }: { data: { label: string; count: number; current: boolean }[] }) {
  return (
    <div className="h-48 w-full" role="img" aria-label="Weekly complaint volume">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -20 }} barCategoryGap={4}>
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
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="bg-popover ring-foreground/10 rounded-lg px-2.5 py-1.5 text-xs shadow-lg ring-1">
                  <div className="tabular text-sm font-semibold">{payload[0]!.value} complaints</div>
                  <div className="text-muted-foreground">Week ending {label}</div>
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            label={{ position: "top", fontSize: 11, fill: "var(--chart-axis)" }}
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.current ? "var(--series-1)" : "#b7d3f6"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
