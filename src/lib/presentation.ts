import { ACTIVITY_BY_ID } from "../content/activities";

export const LABELS: Record<string, string> = {
  provider: "Cloud provider",
  region: "Region / zones",
  flow: "Request flow",
  notes: "Design reasoning",
  loadbalancer: "Load balancer",
  multiAZ: "Multiple availability zones",
  autoscaling: "Autoscaling",
  web: "Web application",
  payment: "Payment service",
  database: "Database",
  cdn: "Content delivery network",
  waf: "Web application firewall",
  queue: "Message queue",
  cache: "Cache",
  fallback: "Payment fallback",
  monitoring: "Monitoring",
  vault: "Secret vault",
  components: "Architecture components",
  order: "Timeline order",
  marks: "Bingo selections",
  killer: "Root cause",
  weapon: "Failure mechanism",
  evidence: "Evidence",
  fixes: "Recovery actions",
  rationale: "Reasoning",
  choices: "Decisions",
  answers: "Answers",
  strategy: "Strategy",
  rounds: "Rounds",
};
export const componentLabel = (id: string) =>
  LABELS[id] ?? id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
export const activityTitle = (id: string) =>
  ACTIVITY_BY_ID[id]?.title ??
  {
    "network-linkedin": "LinkedIn network",
    "network-github": "GitHub developer circle",
    "network-x": "X workshop community",
  }[id] ??
  componentLabel(id);
