import { NO_CLEAR_OWNER } from "@/lib/constants";
import type { TeamRecommendationResult } from "@/lib/validation/ai";
import type { DirectoryTeamForPrompt } from "@/prompts/team-recommendation";
import { ROOT_CAUSE_LIBRARY, recommendedActionFor } from "./root-cause";

/**
 * Deterministic team matcher used when the AI is unavailable. Scores every
 * team in the bank's directory against the issue's ownership keywords and
 * the products it affects. It can only ever return teams from the directory.
 */

const PRIMARY_MIN_SCORE = 3;
const SECONDARY_MIN_SCORE = 3;

function keywordsFor(issueCode: string): [RegExp, number][] {
  const known = ROOT_CAUSE_LIBRARY[issueCode]?.ownerKeywords;
  if (known) return known;
  // Unknown (AI-created) groups: use the words of the code itself.
  return issueCode
    .toLowerCase()
    .split("_")
    .filter((w) => w.length > 3 && !["failure", "issue", "request", "problem"].includes(w))
    .map((w) => [new RegExp(`\\b${w.replace(/[^a-z0-9]/g, "")}`), 1] as [RegExp, number]);
}

export interface TeamScore {
  team: DirectoryTeamForPrompt;
  score: number;
  matched: string[];
}

export function scoreTeams(issueCode: string, topProducts: string[], directory: DirectoryTeamForPrompt[]): TeamScore[] {
  const keywords = keywordsFor(issueCode);
  return directory
    .map((team) => {
      const text = [...team.responsibilities, ...team.systems_owned].join(" | ").toLowerCase();
      const matched: string[] = [];
      let score = 0;
      for (const [re, weight] of keywords) {
        if (re.test(text)) {
          score += weight;
          matched.push(re.source.replace(/\\b/g, ""));
        }
      }
      const productOverlap = team.products_owned.filter((p) => topProducts.includes(p));
      if (productOverlap.length > 0 && score > 0) {
        score += 1;
        matched.push(`owns ${productOverlap.join(", ")}`);
      }
      return { team, score, matched };
    })
    .sort((a, b) => b.score - a.score);
}

export function recommendTeamWithRules(
  issueCode: string,
  topProducts: string[],
  directory: DirectoryTeamForPrompt[],
): TeamRecommendationResult {
  const ranked = scoreTeams(issueCode, topProducts, directory);
  const best = ranked[0];

  if (!best || best.score < PRIMARY_MIN_SCORE) {
    return {
      ownership_status: "NO_CLEAR_OWNER",
      primary_team: null,
      secondary_teams: [],
      reason: `${NO_CLEAR_OWNER}: no team in the directory lists responsibilities that cover this issue.`,
      recommended_action: "Manual assignment required.",
    };
  }

  const runnerUp = ranked[1];
  const margin = runnerUp ? (best.score - runnerUp.score) / best.score : 1;
  const confidence = Math.min(0.9, 0.45 + 0.04 * best.score) * (0.75 + 0.25 * Math.min(1, margin * 2));

  const secondary = ranked
    .slice(1)
    .filter((s) => s.score >= SECONDARY_MIN_SCORE && s.score >= best.score * 0.3)
    .slice(0, 2);

  return {
    ownership_status: "RECOMMENDED",
    primary_team: {
      team_id: best.team.team_id,
      team_name: best.team.team_name,
      department: best.team.department,
      confidence: Math.round(confidence * 100) / 100,
    },
    secondary_teams: secondary.map((s) => ({
      team_id: s.team.team_id,
      team_name: s.team.team_name,
      reason: `Responsibilities include: ${s.team.responsibilities.slice(0, 3).join(", ")}.`,
    })),
    reason:
      `${best.team.team_name} (${best.team.department}) has the strongest responsibility match: ` +
      `${best.team.responsibilities.slice(0, 4).join(", ")}.` +
      (secondary.length ? ` ${secondary.map((s) => s.team.team_name).join(" and ")} should assist.` : ""),
    recommended_action: recommendedActionFor(issueCode),
  };
}
