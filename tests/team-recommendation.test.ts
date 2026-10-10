import { describe, expect, it } from "vitest";
import { recommendFromPrecedent, recommendTeamWithRules } from "@/lib/ai/rules/team-matcher";
import { feedbackStats, humanOwnerFor, selectPrecedents, type RoutingDecision } from "@/lib/ai/feedback";
import { validateTeamRecommendation, type DirectoryEntry } from "@/lib/ai/team-validation";
import { HARBOURLINE, KESTREL, type SeedBank } from "@/data/seed/organisation";
import type { DirectoryTeamForPrompt } from "@/prompts/team-recommendation";

function directoryFor(bank: SeedBank): DirectoryTeamForPrompt[] {
  return bank.departments.flatMap((d) =>
    d.teams.map((t) => ({
      team_id: `${bank.slug}:${t.name}`,
      team_name: t.name,
      department: d.name,
      responsibilities: t.responsibilities,
      products_owned: t.products,
      systems_owned: bank.systems.filter((s) => s.ownerTeam === t.name).map((s) => s.name),
    })),
  );
}

const entries = (dir: DirectoryTeamForPrompt[]): DirectoryEntry[] =>
  dir.map((d) => ({
    team_id: d.team_id,
    team_name: d.team_name,
    department: d.department,
    department_id: `dept:${d.department}`,
  }));

describe("team recommendation guardrails (no hallucinated ownership)", () => {
  const dir = directoryFor(KESTREL);
  const backend = dir.find((d) => d.team_name === "Backend Team")!;
  const payments = dir.find((d) => d.team_name === "Payments Operations")!;

  const valid = {
    ownership_status: "RECOMMENDED" as const,
    primary_team: {
      team_id: backend.team_id,
      team_name: "Backend Team",
      department: "IT Department",
      confidence: 0.89,
    },
    secondary_teams: [
      { team_id: payments.team_id, team_name: "Payments Operations", reason: "Transaction reconciliation" },
    ],
    reason: "Transaction processing",
    recommended_action: "Investigate",
    precedent_used: false,
  };

  it("accepts teams that exist in the directory and takes names from the directory", () => {
    const r = validateTeamRecommendation(valid, entries(dir));
    expect(r.status).toBe("RECOMMENDED");
    expect(r.primary?.team_name).toBe("Backend Team");
    expect(r.secondary.map((s) => s.team_name)).toEqual(["Payments Operations"]);
  });

  it("rejects an invented primary team id → manual assignment", () => {
    const r = validateTeamRecommendation(
      {
        ...valid,
        primary_team: { ...valid.primary_team, team_id: "made-up-id", team_name: "Payments Engineering Squad" },
      },
      entries(dir),
    );
    expect(r.status).toBe("REJECTED_INVALID_TEAM");
    expect(r.primary).toBeNull();
  });

  it("rejects a real id paired with an invented name", () => {
    const r = validateTeamRecommendation(
      { ...valid, primary_team: { ...valid.primary_team, team_name: "Core Platform Team" } },
      entries(dir),
    );
    expect(r.status).toBe("REJECTED_INVALID_TEAM");
  });

  it("rejects an invented secondary team", () => {
    const r = validateTeamRecommendation(
      { ...valid, secondary_teams: [{ team_id: "ghost", team_name: "Ghost Team", reason: "x" }] },
      entries(dir),
    );
    expect(r.status).toBe("REJECTED_INVALID_TEAM");
  });

  it("rejects a team from another bank's directory", () => {
    const other = directoryFor(HARBOURLINE).find((d) => d.team_name === "Core Banking Team")!;
    const r = validateTeamRecommendation(
      {
        ...valid,
        primary_team: {
          team_id: other.team_id,
          team_name: other.team_name,
          department: other.department,
          confidence: 0.9,
        },
      },
      entries(dir),
    );
    expect(r.status).toBe("REJECTED_INVALID_TEAM");
  });

  it("passes NO_CLEAR_OWNER through", () => {
    const r = validateTeamRecommendation(
      { ...valid, ownership_status: "NO_CLEAR_OWNER", primary_team: null, secondary_teams: [] },
      entries(dir),
    );
    expect(r.status).toBe("NO_CLEAR_OWNER");
  });
});

describe("rules-based team matcher (AI fallback)", () => {
  it("routes transfer failures to Backend Team with Payments Operations assisting (spec example)", () => {
    const r = recommendTeamWithRules(
      "TRANSFER_PROCESSING_FAILURE",
      ["MOBILE_BANKING", "USSD_BANKING"],
      directoryFor(KESTREL),
    );
    expect(r.primary_team?.team_name).toBe("Backend Team");
    expect(r.primary_team?.department).toBe("IT Department");
    expect(r.secondary_teams.map((s) => s.team_name)).toContain("Payments Operations");
  });

  it.each([
    ["MOBILE_APP_AUTHENTICATION", "Mobile Team"],
    ["CARD_PAYMENT_FAILURE", "POS Support Team"],
    ["ATM_WITHDRAWAL_FAILURE", "Card Operations"],
    ["BRANCH_SERVICE_DELAY", "Branch Operations"],
    ["USSD_SERVICE_FAILURE", "Digital Channels Team"],
    ["SUSPECTED_FRAUD", "Security Team"],
  ])("%s → %s", (code, team) => {
    expect(recommendTeamWithRules(code, [], directoryFor(KESTREL)).primary_team?.team_name).toBe(team);
  });

  it("returns NO_CLEAR_OWNER when no team's responsibilities cover the issue", () => {
    const r = recommendTeamWithRules("BRANCH_SERVICE_DELAY", ["BRANCH_SERVICES"], directoryFor(HARBOURLINE));
    expect(r.ownership_status).toBe("NO_CLEAR_OWNER");
    expect(r.recommended_action).toBe("Manual assignment required.");
  });

  it("only ever returns teams from the supplied directory", () => {
    const dir = directoryFor(HARBOURLINE);
    const ids = new Set(dir.map((d) => d.team_id));
    for (const code of [
      "TRANSFER_PROCESSING_FAILURE",
      "USSD_SERVICE_FAILURE",
      "ATM_WITHDRAWAL_FAILURE",
      "SOME_NEW_ISSUE",
    ]) {
      const r = recommendTeamWithRules(code, [], dir);
      if (r.primary_team) expect(ids.has(r.primary_team.team_id)).toBe(true);
      for (const s of r.secondary_teams) expect(ids.has(s.team_id)).toBe(true);
    }
  });
});

describe("human feedback loop", () => {
  const decision = (over: Partial<RoutingDecision>): RoutingDecision => ({
    issueId: "i1",
    issueCode: "USSD_SERVICE_FAILURE",
    issueTitle: "USSD Service Failure",
    rootCause: null,
    kind: "CORRECTION",
    recommendedTeamName: "Digital Team",
    assignedTeamId: "t1",
    assignedTeamName: "Infrastructure & Networks",
    reason: "Telco gateway outage, not the app",
    actor: "Demo User",
    decidedAt: new Date("2026-10-08T10:00:00Z"),
    ...over,
  });

  const decisions = [
    decision({ issueId: "a", issueCode: "CARD_PAYMENT_FAILURE", kind: "CONFIRMED" }),
    decision({ issueId: "b", issueCode: "ATM_WITHDRAWAL_FAILURE", kind: "MANUAL", recommendedTeamName: null }),
    decision({ issueId: "c" }),
  ];

  it("puts precedents for the same issue group first and skips unrelated confirmations", () => {
    const p = selectPrecedents(decisions, "USSD_SERVICE_FAILURE");
    expect(p.map((d) => d.issueId)).toEqual(["c", "b"]);
  });

  it("uses a human correction as the owner, but not a plain confirmation", () => {
    expect(humanOwnerFor(decisions, "USSD_SERVICE_FAILURE")?.issueId).toBe("c");
    expect(humanOwnerFor(decisions, "CARD_PAYMENT_FAILURE")).toBeNull();
  });

  it("keeps the lesson when the corrected recommendation is later accepted", () => {
    const history = [
      decision({ issueId: "c", kind: "CONFIRMED", recommendedTeamName: "Infrastructure & Networks", reason: null }),
      decision({ issueId: "c" }), // earlier correction Digital Team -> Infrastructure
    ];
    expect(humanOwnerFor(history, "USSD_SERVICE_FAILURE")?.reason).toBe("Telco gateway outage, not the app");
    // A later reassignment to a different team supersedes the lesson.
    const reassigned = [decision({ issueId: "c", kind: "CONFIRMED", assignedTeamId: "t9" }), ...history];
    expect(humanOwnerFor(reassigned, "USSD_SERVICE_FAILURE")).toBeNull();
  });

  it("measures how often managers accept the AI's team", () => {
    expect(feedbackStats(decisions)).toEqual({
      decisions: 3,
      confirmed: 1,
      corrected: 1,
      manual: 1,
      acceptanceRate: 0.5,
    });
  });

  it("rules fallback follows a correction only to a team that still exists", () => {
    const dir = directoryFor(HARBOURLINE);
    const infra = dir.find((d) => d.team_name.startsWith("Infrastructure"))!;
    const rec = recommendFromPrecedent("USSD_SERVICE_FAILURE", ["USSD_BANKING"], dir, {
      assignedTeamId: infra.team_id,
      reason: "Telco gateway outage",
      decidedAt: new Date("2026-10-08T10:00:00Z"),
    });
    expect(rec?.primary_team?.team_id).toBe(infra.team_id);
    expect(rec?.precedent_used).toBe(true);
    expect(rec?.reason).toContain("Telco gateway outage");
    expect(validateTeamRecommendation(rec!, entries(dir)).status).toBe("RECOMMENDED");

    const gone = recommendFromPrecedent("USSD_SERVICE_FAILURE", [], dir, {
      assignedTeamId: "deleted-team",
      reason: null,
      decidedAt: new Date(),
    });
    expect(gone).toBeNull();
  });
});
