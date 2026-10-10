import type { TeamRecommendationResult } from "@/lib/validation/ai";

/**
 * Enforces "do not hallucinate team ownership": every team the model
 * returns must exist in the bank's directory (by id, with a matching name).
 * Any violation rejects the whole recommendation → manual assignment.
 * Names and departments shown to users always come from the database.
 */

export interface DirectoryEntry {
  team_id: string;
  team_name: string;
  department_id: string;
  department: string;
}

export type ValidatedOwnership =
  | {
      status: "RECOMMENDED";
      primary: DirectoryEntry & { confidence: number };
      secondary: (DirectoryEntry & { reason: string })[];
      notes: string[];
    }
  | { status: "NO_CLEAR_OWNER" | "REJECTED_INVALID_TEAM"; primary: null; secondary: []; notes: string[] };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function validateTeamRecommendation(
  rec: TeamRecommendationResult,
  directory: DirectoryEntry[],
): ValidatedOwnership {
  const byId = new Map(directory.map((d) => [d.team_id, d]));
  const notes: string[] = [];

  if (rec.ownership_status === "NO_CLEAR_OWNER" || !rec.primary_team) {
    return {
      status: "NO_CLEAR_OWNER",
      primary: null,
      secondary: [],
      notes: ["No team in the directory has responsibilities covering this issue."],
    };
  }

  const reject = (reason: string): ValidatedOwnership => ({
    status: "REJECTED_INVALID_TEAM",
    primary: null,
    secondary: [],
    notes: [...notes, reason, "Recommendation rejected — manual assignment required."],
  });

  const primary = byId.get(rec.primary_team.team_id);
  if (!primary) return reject(`Primary team id "${rec.primary_team.team_id}" does not exist in this bank's directory.`);
  if (!same(primary.team_name, rec.primary_team.team_name)) {
    return reject(
      `Primary team name "${rec.primary_team.team_name}" does not match directory record "${primary.team_name}".`,
    );
  }
  if (!same(primary.department, rec.primary_team.department)) {
    notes.push(
      `Department corrected from "${rec.primary_team.department}" to directory value "${primary.department}".`,
    );
  }

  const secondary: (DirectoryEntry & { reason: string })[] = [];
  for (const s of rec.secondary_teams) {
    const team = byId.get(s.team_id);
    if (!team) return reject(`Secondary team id "${s.team_id}" does not exist in this bank's directory.`);
    if (!same(team.team_name, s.team_name)) {
      return reject(`Secondary team name "${s.team_name}" does not match directory record "${team.team_name}".`);
    }
    if (team.team_id === primary.team_id || secondary.some((x) => x.team_id === team.team_id)) {
      notes.push(`Duplicate secondary team "${team.team_name}" removed.`);
      continue;
    }
    secondary.push({ ...team, reason: s.reason });
  }

  return {
    status: "RECOMMENDED",
    primary: { ...primary, confidence: rec.primary_team.confidence },
    secondary,
    notes,
  };
}
