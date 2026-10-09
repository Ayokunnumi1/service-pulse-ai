/**
 * Demo incident scenarios (client-safe metadata). Message templates live in
 * `lib/simulation/incident.ts` on the server. Simulated interactions are
 * tagged with a `SIM-` customer reference so they can be removed again.
 */

export const INCIDENT_SCENARIOS = [
  {
    key: "salary_credit",
    title: "Salary payments not credited",
    description:
      "Employers' bulk salary payments are debited but staff accounts are not credited — a problem ServicePulse has never seen before.",
  },
  {
    key: "duplicate_debit",
    title: "Duplicate card debits",
    description: "POS and online card payments are charged twice — a sudden spike on top of an existing issue.",
  },
  {
    key: "app_crash",
    title: "Mobile app crashes after update",
    description: "The latest app release closes on launch or when opening transfers, across Android and iOS.",
  },
] as const;

export type IncidentScenarioKey = (typeof INCIDENT_SCENARIOS)[number]["key"];

export const INCIDENT_SCENARIO_KEYS = INCIDENT_SCENARIOS.map((s) => s.key) as [
  IncidentScenarioKey,
  ...IncidentScenarioKey[],
];

export const SIMULATION_REF_PREFIX = "SIM-";
