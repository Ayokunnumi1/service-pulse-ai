import { describe, expect, it } from "vitest";
import { recommendTeamWithRules } from "@/lib/ai/rules/team-matcher";
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
