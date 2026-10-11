import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/lib/ai/assistant";
import { briefingWithRules } from "@/lib/ai/briefing";

type IssueRow = Snapshot["issues_ranked_by_risk"][number];

const issue = (over: Partial<IssueRow>): IssueRow =>
  ({
    issue_code: "TRANSFER_PROCESSING_FAILURE",
    title: "Transfer Processing Failure",
    status: "OPEN",
    trend: "Stable",
    growth_pct: 0,
    current_period_complaints: 8,
    previous_period_complaints: 8,
    total_complaints: 55,
    pct_of_all_complaints: 28.2,
    risk_level: "MEDIUM",
    risk_score: 53,
    severity: "HIGH",
    top_channels: [],
    top_products: [],
    top_locations: [],
    top_branches: [],
    likely_root_cause: "Not yet analysed",
    root_cause_confidence_pct: null,
    recommended_action: null,
    recommended_team: null,
    recommended_department: null,
    ownership_status: null,
    assigned_team: null,
    ...over,
  }) as IssueRow;

const snapshot = (issues: IssueRow[], unclassified = 0) =>
  ({ issues_ranked_by_risk: issues, totals: { unclassified_interactions: unclassified } }) as unknown as Snapshot;

describe("today's briefing (rules fallback)", () => {
  const b = briefingWithRules(
    snapshot(
      [
        issue({}),
        issue({
          issue_code: "USSD_SERVICE_FAILURE",
          title: "USSD Service Failure",
          trend: "Critical",
          growth_pct: 133.3,
          current_period_complaints: 14,
          risk_level: "CRITICAL",
          risk_score: 81,
          top_locations: ["Owerri 28.6%"],
          likely_root_cause: "Likely: Telco gateway instability",
          recommended_team: "Infrastructure & Networks",
        }),
        issue({
          issue_code: "BRANCH_SERVICE_DELAY",
          title: "Branch Service Delay",
          trend: "High concern",
          growth_pct: 100,
          risk_level: "HIGH",
          risk_score: 56,
        }),
      ],
      12,
    ),
  );

  it("leads with the most urgent issue and uses only snapshot figures", () => {
    expect(b.headline).toContain("USSD Service Failure");
    expect(b.points.map((p) => p.issue_codes[0])).toEqual([
      "USSD_SERVICE_FAILURE",
      "BRANCH_SERVICE_DELAY",
      "TRANSFER_PROCESSING_FAILURE",
    ]);
    expect(b.points[0]!.detail).toContain("14 complaints");
    expect(b.points[0]!.detail).toContain("+133.3%");
    expect(b.points[0]!.detail).toContain("Owerri 28.6%");
    expect(b.points[0]!.detail).toContain("Likely: Telco gateway instability.".replace("Likely: ", "Likely cause: "));
    expect(b.points[0]!.detail).not.toContain("..");
  });

  it("names owners, flags unowned issues and reports data gaps", () => {
    expect(b.points[0]!.detail).toContain("Infrastructure & Networks (recommended)");
    expect(b.points[1]!.detail).toContain("No owner assigned yet");
    expect(b.recommended_focus).toContain("assign an owner to Branch Service Delay");
    expect(b.data_limitations).toContain("12 interactions are not yet classified");
  });

  it("handles a bank with no issues", () => {
    expect(briefingWithRules(snapshot([], 270)).points).toEqual([]);
  });
});
