export const REGIONS = [
  { id: "west", name: "West India", city: "Mumbai" },
  { id: "south", name: "South India", city: "Chennai" },
  { id: "central", name: "Central India", city: "Pune" },
  { id: "north", name: "North India", city: "Delhi" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

export interface Team {
  id: string;
  name: string;
  region: RegionId;
  index: number;
}

export const TEAMS: Team[] = REGIONS.flatMap((r, ri) =>
  "abcdef".split("").map((z, zi) => ({
    id: `${r.city.toLowerCase()}-1${z}`,
    name: `${r.city}-1${z}`,
    region: r.id,
    index: ri * 6 + zi,
  })),
);

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
);

export const regionName = (id: string) =>
  REGIONS.find((r) => r.id === id)?.name ?? id;

export const ROLES = [
  {
    id: "CEO",
    label: "CEO",
    does: "Final decisions, presents pitches and Demo Day",
  },
  { id: "CTO", label: "CTO", does: "Owns the architecture and tech choices" },
  {
    id: "SRE",
    label: "SRE",
    does: "Keeps things running, owns the error budget",
  },
  {
    id: "CFO",
    label: "CFO",
    does: "Guards the Cloud Credits and the cloud bill",
  },
  { id: "COO", label: "COO", does: "Keeps time and submits team forms" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const START_CREDITS = 1000;
