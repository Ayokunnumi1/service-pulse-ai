import {
  CheckCircle2,
  Circle,
  CircleDot,
  Cpu,
  Eye,
  Minus,
  OctagonAlert,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType } from "react";
import { TREND_LABELS, humanize, type IssueStatus, type RiskLevel, type TrendStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Status chips. Status colours are reserved for state and always ship with
 * an icon + text label, never colour alone. Text stays in ink tokens.
 */
type Tone = "critical" | "serious" | "warning" | "good" | "neutral" | "info";

const TONE: Record<Tone, { chip: string; icon: string }> = {
  critical: {
    chip: "bg-[color-mix(in_oklch,var(--status-critical)_12%,white)] ring-[color-mix(in_oklch,var(--status-critical)_35%,white)]",
    icon: "text-[var(--status-critical)]",
  },
  serious: {
    chip: "bg-[color-mix(in_oklch,var(--status-serious)_14%,white)] ring-[color-mix(in_oklch,var(--status-serious)_40%,white)]",
    icon: "text-[var(--status-serious)]",
  },
  warning: {
    chip: "bg-[color-mix(in_oklch,var(--status-warning)_16%,white)] ring-[color-mix(in_oklch,var(--status-warning)_45%,white)]",
    icon: "text-[#b07800]",
  },
  good: {
    chip: "bg-[color-mix(in_oklch,var(--status-good)_10%,white)] ring-[color-mix(in_oklch,var(--status-good)_30%,white)]",
    icon: "text-[var(--status-good)]",
  },
  neutral: { chip: "bg-muted ring-border", icon: "text-muted-foreground" },
  info: {
    chip: "bg-[color-mix(in_oklch,var(--series-1)_10%,white)] ring-[color-mix(in_oklch,var(--series-1)_30%,white)]",
    icon: "text-[var(--series-1)]",
  },
};

function Chip({
  tone,
  icon: Icon,
  children,
  className,
  title,
}: {
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "text-foreground inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE[tone].chip,
        className,
      )}
    >
      <Icon className={cn("size-3.5", TONE[tone].icon)} aria-hidden />
      {children}
    </span>
  );
}

const RISK_TONE: Record<RiskLevel, Tone> = { CRITICAL: "critical", HIGH: "serious", MEDIUM: "warning", LOW: "good" };
const RISK_ICON: Record<RiskLevel, ComponentType<{ className?: string }>> = {
  CRITICAL: OctagonAlert,
  HIGH: TriangleAlert,
  MEDIUM: CircleDot,
  LOW: CheckCircle2,
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <Chip
      tone={RISK_TONE[level]}
      icon={RISK_ICON[level]}
      title={score !== undefined ? `Risk score ${score}/100` : undefined}
    >
      {humanize(level)}
      {score !== undefined && <span className="tabular text-muted-foreground">· {score}</span>}
    </Chip>
  );
}

const TREND_TONE: Record<TrendStatus, Tone> = {
  CRITICAL: "critical",
  HIGH_CONCERN: "serious",
  EMERGING: "warning",
  WATCH: "info",
  STABLE: "neutral",
};
const TREND_ICON: Record<TrendStatus, ComponentType<{ className?: string }>> = {
  CRITICAL: TrendingUp,
  HIGH_CONCERN: TrendingUp,
  EMERGING: TrendingUp,
  WATCH: Eye,
  STABLE: Minus,
};

export function TrendBadge({ status }: { status: TrendStatus }) {
  return (
    <Chip tone={TREND_TONE[status]} icon={TREND_ICON[status]}>
      {TREND_LABELS[status]}
    </Chip>
  );
}

const STATUS_TONE: Record<IssueStatus, Tone> = {
  OPEN: "neutral",
  ASSIGNED: "info",
  INVESTIGATING: "warning",
  RESOLVED: "good",
};
const STATUS_ICON: Record<IssueStatus, ComponentType<{ className?: string }>> = {
  OPEN: Circle,
  ASSIGNED: CircleDot,
  INVESTIGATING: Search,
  RESOLVED: CheckCircle2,
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return (
    <Chip tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>
      {humanize(status)}
    </Chip>
  );
}

const SEVERITY_TONE: Record<string, Tone> = {
  CRITICAL: "critical",
  HIGH: "serious",
  MEDIUM: "warning",
  LOW: "neutral",
};

export function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span className="text-muted-foreground">—</span>;
  const tone = SEVERITY_TONE[severity] ?? "neutral";
  return (
    <Chip tone={tone} icon={tone === "critical" ? OctagonAlert : tone === "serious" ? TriangleAlert : CircleDot}>
      {humanize(severity)}
    </Chip>
  );
}

/** Shows whether a result came from the AI model or the deterministic fallback. */
export function MethodBadge({ method, model }: { method: "AI" | "RULES" | null; model?: string | null }) {
  if (!method) return null;
  return method === "AI" ? (
    <Chip tone="info" icon={Sparkles} title={model ? `Model: ${model}` : undefined}>
      AI
    </Chip>
  ) : (
    <Chip tone="neutral" icon={Cpu} title="Deterministic rules fallback (AI unavailable)">
      Rules
    </Chip>
  );
}

export function ConfidenceMeter({ value, label = "Confidence" }: { value: number | null; label?: string }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" aria-label={`${label} ${pct}%`}>
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular text-sm font-medium">{pct}%</span>
    </div>
  );
}
