export const DEMO_URL =
  "https://chaicart-workshop-vh-20261003.azurewebsites.net/";
export const WORKSHOP_URL =
  "https://theharithsa.github.io/chaicart-cloud-workshop/";
export const HASHTAG = "#ChaiCartCloudWorkshop";
export const PROFILES = [
  {
    id: "linkedin",
    title: "LinkedIn network",
    day: 1,
    url: "https://www.linkedin.com/in/theharithsa/",
    task: "Create or improve your profile; connect with workshop peers and Vishruth.",
  },
  {
    id: "github",
    title: "GitHub developer circle",
    day: 1,
    url: "https://github.com/theharithsa",
    task: "Create or improve your profile; follow workshop peers and theharithsa; discuss a project idea.",
  },
  {
    id: "x",
    title: "X learning circle",
    day: 2,
    url: "https://x.com/theharithsa",
    task: "Create or improve your profile, find workshop peers and share a takeaway. Optional posts/photos throughout Day2 use #ChaiCartCloudWorkshop.",
  },
] as const;
export const AGENDAS = [
  {
    day: 1,
    title: "Build ChaiCart",
    blocks: [
      "09:30–11:00 · LinkedIn, cloud fundamentals, Human Timeline and service sorting",
      "11:15–12:30 · Deployment models, providers, regions and Shark Tank",
      "13:15–14:45 · GitHub, Bingo, VMs/containers and digital architecture",
      "15:00–17:00 · Human Kitchen, gallery, quiz and reflection",
    ],
  },
  {
    day: 2,
    title: "Keep ChaiCart alive",
    blocks: [
      "09:30–10:55 · X kickoff, reliability, downtime and Who Killed Checkout?",
      "11:15–12:40 · Observability Treasure Hunt and Error Budget Poker",
      "13:25–15:00 · Postmortem, Digital Delivery Factory, DevOps, security and Bill Shock",
      "15:10–17:00 · Follow the Order, careers, quiz, Demo Day and awards",
      "All day · Optional X posts/photos; send your best post link before final awards",
    ],
  },
];
export const SCORE_RUBRICS: Record<string, { max: number; help: string }> = {
  "network-linkedin": {
    max: 100,
    help: "All five teammates complete LinkedIn; +100 once.",
  },
  "network-github": {
    max: 100,
    help: "All five teammates complete GitHub; +100 once.",
  },
  "network-x": {
    max: 100,
    help: "All five complete X profile/peer/takeaway steps; public posting optional; +100 once.",
  },
  timeline: {
    max: 50,
    help: "First correct team per region, confirmed server timestamp: +50.",
  },
  "service-sort": { max: 100, help: "+5 per correct card, max100." },
  bingo: {
    max: 30,
    help: "Facilitator checks the first three valid claims in the room: +30.",
  },
  "deploy-debate": { max: 30, help: "Convincing defence: +30." },
  "shark-pitch": {
    max: 50,
    help: "Regional winner +50; facilitator overall bonus +100.",
  },
  architecture: {
    max: 50,
    help: "Regional best +50; facilitator overall bonus +100.",
  },
  kitchen: { max: 100, help: "+20 per volunteer from this team." },
  gallery: {
    max: 50,
    help: "Facilitator selects four best notes in the room: +50 each.",
  },
  downtime: {
    max: 80,
    help: "Closest team per row in region: +20. Ties share the award.",
  },
  "treasure-hunt": {
    max: 150,
    help: "Review question answers and proof, up to150; reflection bonus awarded separately.",
  },
  postmortem: {
    max: 40,
    help: "Regional best +40; facilitator overall bonus +75.",
  },
  factory: {
    max: 50,
    help: "Most successful round2 releases per region +50; ties: fewer failures then lower lead time.",
  },
};
