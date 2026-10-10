import Link from "next/link";
import { formatNumber } from "@/lib/utils/format";

export interface BarItem {
  name: string;
  value: number;
  secondary?: string; // e.g. "12 this week" or "44%"
  href?: string;
}

/**
 * Horizontal single-series bar list (one colour for every bar — categories
 * are nominal). Values are labelled at the bar end, so nothing is hover-gated.
 */
export function BarList({
  items,
  emptyLabel = "No data yet",
  max,
}: {
  items: BarItem[];
  emptyLabel?: string;
  max?: number;
}) {
  if (items.length === 0) return <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const row = (
          <div
            className="group"
            title={`${item.name}: ${formatNumber(item.value)}${item.secondary ? ` (${item.secondary})` : ""}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate group-hover:underline">{item.name}</span>
              <span className="tabular shrink-0 font-medium">
                {formatNumber(item.value)}
                {item.secondary && <span className="text-muted-foreground ml-1.5 font-normal">{item.secondary}</span>}
              </span>
            </div>
            <div className="bg-muted h-2 w-full rounded-full">
              <div
                className="h-2 rounded-full bg-[var(--series-1)] transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(2, (item.value / top) * 100)}%` }}
              />
            </div>
          </div>
        );
        return <li key={item.name}>{item.href ? <Link href={item.href}>{row}</Link> : row}</li>;
      })}
    </ul>
  );
}
