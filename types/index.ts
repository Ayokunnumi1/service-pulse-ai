import type { EvidenceLink } from "@/lib/ai/evidence";
import type { Channel, InteractionStatus, IssueStatus, RiskLevel, Severity, TrendStatus } from "@/lib/constants";
import type { RiskFactor } from "@/lib/scoring/risk";

export interface Bank {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  created_at: Date;
}

export interface BreakdownItem {
  name: string;
  count: number;
  pct: number;
}

export interface Interaction {
  id: string;
  channel: Channel;
  message: string;
  customer_reference: string | null;
  branch: string | null;
  location: string | null;
  product: string | null;
  amount: number | null;
  occurred_at: Date;
  status: InteractionStatus;
  source: "SEED" | "IMPORT";
  // classification (null until classified)
  category: string | null;
  issue: string | null;
  issue_group: string | null;
  intent: string | null;
  sentiment: string | null;
  severity: Severity | null;
  classified_product: string | null;
  systemic_issue_candidate: boolean | null;
  confidence: number | null;
  method: "AI" | "RULES" | null;
}

export interface Issue {
  id: string;
  issue_code: string;
  title: string;
  category: string;
  status: IssueStatus;
  trend_status: TrendStatus;
  risk_level: RiskLevel;
  risk_score: number;
  risk_factors: RiskFactor[];
  total_complaints: number;
  pct_of_total: number;
  current_period_count: number;
  previous_period_count: number;
  growth_pct: number | null;
  severity: Severity;
  channel_breakdown: BreakdownItem[];
  product_breakdown: BreakdownItem[];
  location_breakdown: BreakdownItem[];
  branch_breakdown: BreakdownItem[];
  financial_impact: number | null;
  period_days: number;
  period_end: Date | null;
  first_seen_at: Date | null;
  last_seen_at: Date | null;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  assigned_department_name: string | null;
  assigned_at: Date | null;
  assignment_source: "AI_ACCEPTED" | "MANUAL_OVERRIDE" | null;
  resolved_at: Date | null;
  metrics_updated_at: Date | null;
  // latest analysis summary (joined)
  analysis_id: string | null;
  recommended_team_name: string | null;
  recommended_department_name: string | null;
  ownership_status: OwnershipStatus | null;
}

export type OwnershipStatus = "RECOMMENDED" | "NO_CLEAR_OWNER" | "REJECTED_INVALID_TEAM";

export interface SecondaryTeam {
  team_id: string;
  team_name: string;
  reason: string;
}

export interface IssueAnalysis {
  id: string;
  issue_id: string;
  method: "AI" | "RULES";
  model: string | null;
  observed_pattern: string;
  likely_root_cause: string;
  root_cause_status: "LIKELY" | "POSSIBLE" | "REQUIRES_INVESTIGATION";
  root_cause_confidence: number;
  alternative_causes: { description: string; likelihood: string }[];
  affected_systems: string[];
  recommended_investigation: string[];
  management_insight: string | null;
  ownership_status: OwnershipStatus;
  primary_department_id: string | null;
  primary_department_name: string | null;
  primary_team_id: string | null;
  primary_team_name: string | null;
  primary_team_confidence: number | null;
  secondary_teams: SecondaryTeam[];
  ownership_reason: string | null;
  recommended_action: string;
  validation_notes: string[];
  evidence: EvidenceLink[];
  created_at: Date;
}

export interface IssueNote {
  id: string;
  author: string;
  note: string;
  created_at: Date;
}

export interface AuditEntry {
  id: string;
  issue_id: string | null;
  issue_title: string | null;
  event_type: string;
  actor: string;
  method: string | null;
  model: string | null;
  input_data: unknown;
  detected_issue: string | null;
  root_cause: string | null;
  recommended_team_name: string | null;
  confidence: number | null;
  assigned_team_name: string | null;
  human_override: boolean | null;
  final_status: string | null;
  details: unknown;
  created_at: Date;
}

export interface DirectoryTeam {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  department_name: string;
  responsibilities: { id: string; responsibility: string }[];
  products: { code: string; name: string }[];
  systems: { name: string; description: string | null }[];
}

export interface DirectoryDepartment {
  id: string;
  name: string;
  description: string | null;
  teams: DirectoryTeam[];
}
