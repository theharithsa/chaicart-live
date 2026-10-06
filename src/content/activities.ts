import paperless from "./paperless.json";
export type Field =
  | { id: string; type: "text" | "textarea"; label: string; required?: boolean }
  | {
      id: string;
      type: "number";
      label: string;
      min?: number;
      max?: number;
      required?: boolean;
    }
  | {
      id: string;
      type: "select";
      label: string;
      options: string[];
      required?: boolean;
    }
  | { id: string; type: "scale"; label: string; required?: boolean }
  | {
      id: string;
      type: "checks";
      label: string;
      options: { id: string; label: string }[];
    };

interface Base {
  id: string;
  title: string;
  day: 1 | 2;
  /** Where this activity appears in the slide decks, for the facilitator. */
  slides: string;
  intro?: string;
}

export interface QuizActivity extends Base {
  kind: "quiz";
  /** Polls are not scored; quizzes award `points` per question, Cloud or Not scores individuals; other quizzes use one team answer. */
  mode: "quiz" | "poll";
  scope?: "individual" | "team";
  points: number;
  questions: { q: string; options: string[] }[];
}

export interface FormActivity extends Base {
  kind: "form";
  scope: "team" | "individual";
  fields: Field[];
  /** Shown to each team based on its position, e.g. one scenario per team. */
  variants?: { title: string; body: string }[];
  creditsField?: string;
  regionMax?: { field: string; award: number };
}

export interface VoteActivity extends Base {
  kind: "vote";
  award: number;
}

export interface SimpleActivity extends Base {
  kind: "mystery" | "budget" | "billshock" | "studio";
}

export type Activity =
  QuizActivity | FormActivity | VoteActivity | SimpleActivity;

const CLOUD_OPTIONS = ["Cloud", "Not cloud", "It depends"];

export const ACTIVITIES: Activity[] = [
  {
    id: "timeline",
    title: "Human Timeline",
    day: 1,
    slides: "Day1 · Timeline",
    kind: "studio",
    intro:
      "Reorder the events from oldest to newest. No talking for the first two minutes; COO submits when ready.",
  },
  {
    id: "service-sort",
    title: "Service Model Sort",
    day: 1,
    slides: "Day1 · Service models",
    kind: "studio",
    intro: "Classify each card as IaaS, PaaS or SaaS. +5 per correct card.",
  },
  {
    id: "bingo",
    title: "Cloud Bingo",
    day: 1,
    slides: "Day1 · Bingo",
    kind: "studio",
    intro:
      "Mark a term when the facilitator calls its clue. Complete a row, column or diagonal and submit a claim.",
  },
  {
    id: "shark-pitch",
    title: "Cloud Shark Tank: pitch brief",
    day: 1,
    slides: "Day1 · Shark Tank",
    kind: "form",
    scope: "team",
    fields: [
      {
        id: "pitch",
        type: "textarea",
        label: "Our cloud choice, business value and 60-second pitch",
        required: true,
      },
    ],
  },
  {
    id: "kitchen",
    title: "Human Kitchen",
    day: 1,
    slides: "Day1 · Human Kitchen",
    kind: "studio",
    intro:
      "Volunteers use station cards on phones. Follow the token, record handoffs and compare chaos with the improved round.",
  },
  {
    id: "gallery",
    title: "Gallery Walk",
    day: 1,
    slides: "Day1 · Gallery",
    kind: "studio",
    intro:
      "Browse cases, discuss their questions and leave useful feedback. The facilitator awards four best notes.",
  },
  {
    id: "follow-order",
    title: "Follow the Order",
    day: 2,
    slides: "Day2 · Business systems",
    kind: "studio",
    intro:
      "Seven volunteers follow a digital order through business systems. Compare a blocked ERP with queued recovery.",
  },

  {
    id: "cloud-or-not",
    title: "Cloud or Not?",
    day: 1,
    slides: "Workshop activity",
    kind: "quiz",
    mode: "quiz",
    scope: "individual",
    points: 100,
    intro:
      "Answer individually. Each correct answer earns 100 credits for you and adds 100 to your team.",
    questions: [
      "Gmail",
      "Pen drive",
      "Netflix",
      "UPI payment",
      "Excel on your laptop",
      "ChatGPT",
      "Phone calculator",
      "Google Photos backup",
    ].map((q) => ({ q, options: CLOUD_OPTIONS })),
  },
  {
    id: "deploy-debate",
    title: "Where Should They Live?",
    day: 1,
    slides: "Workshop activity",
    kind: "form",
    scope: "team",
    intro:
      "Read your scenario, decide as a team, and give your reasons. You may be picked to defend it in 60 seconds.",
    variants: [
      {
        title: "A large Indian bank",
        body: "Core banking on 20-year-old systems. Crores of customers. RBI regulated. Wants a modern mobile app and AI fraud detection.",
      },
      {
        title: "OTT cricket startup",
        body: "Launching a live-streaming app in 3 months. Traffic is near zero on normal days and explodes during matches.",
      },
      {
        title: "Multi-city hospital chain",
        body: "Patient records, MRI machines in every hospital, wants AI to read scans. Health data is highly sensitive.",
      },
      {
        title: "State government portal",
        body: "Land records, certificates and scholarships for 5 crore citizens. Must follow government cloud guidelines.",
      },
      {
        title: "Global e-commerce company",
        body: "Sells in 30 countries. The board worries about depending on one vendor. Some countries require local data storage.",
      },
      {
        title: "Defence research lab",
        body: "Top-secret designs. No internet connectivity allowed for core systems.",
      },
      {
        title: "College fest website",
        body: "Needed for 3 weeks: registrations, schedule, live leaderboard. Budget: almost zero.",
      },
      {
        title: "Smart car factory",
        body: "Robots on the assembly line need responses in under 10 ms. Management wants global analytics dashboards.",
      },
    ],
    fields: [
      {
        id: "model",
        type: "select",
        label: "Our deployment model",
        options: [
          "Public cloud",
          "Private cloud",
          "Hybrid cloud",
          "Multi-cloud",
          "Government / community cloud",
        ],
        required: true,
      },
      {
        id: "reason",
        type: "textarea",
        label: "Why? (compliance, latency, cost, scale, skills, lock-in)",
        required: true,
      },
    ],
  },
  {
    id: "shark-vote",
    title: "Shark Tank: region vote",
    day: 1,
    slides: "Workshop activity",
    kind: "vote",
    award: 50,
    intro:
      "Vote for the best pitch in your region. You cannot vote for your own team. One vote per team.",
  },
  {
    id: "architecture",
    title: "Architecture Lego: digital design",
    day: 1,
    slides: "Day1 · Architecture Lego",
    kind: "studio",
    intro:
      "Build your design on phones. Freeze it before Day2: Poker and Bill Shock use this design.",
  },
  {
    id: "quiz-day1",
    title: "Day 1 recap quiz",
    day: 1,
    slides: "Workshop activity",
    kind: "quiz",
    mode: "quiz",
    points: 10,
    questions: [
      {
        q: "Which is NOT one of NIST's 5 essential cloud characteristics?",
        options: [
          "On-demand self-service",
          "Rapid elasticity",
          "Free of cost",
          "Measured service",
        ],
      },
      {
        q: "You rent a VM, then install and patch the OS and your app yourself. Which model?",
        options: ["SaaS", "PaaS", "IaaS", "On-premises"],
      },
      {
        q: "Azure App Service, where you upload code and it runs, is…",
        options: ["IaaS", "PaaS", "SaaS", "FaaS only"],
      },
      {
        q: "A hospital keeps patient records on-prem but uses public cloud AI to analyse scans. That is…",
        options: [
          "Public cloud",
          "Private cloud",
          "Hybrid cloud",
          "Community cloud",
        ],
      },
      {
        q: "Containers share which part of the host with each other?",
        options: [
          "The hypervisor",
          "The operating system kernel",
          "The guest OS",
          "The BIOS",
        ],
      },
      {
        q: "Which tool orchestrates thousands of containers: restarts, scales, schedules?",
        options: ["Docker Hub", "Kubernetes", "Terraform", "Jenkins"],
      },
      {
        q: "Which component spreads incoming traffic across multiple servers?",
        options: ["CDN", "Load balancer", "DNS", "Message queue"],
      },
      {
        q: "In which year did AWS launch S3 and EC2?",
        options: ["2001", "2006", "2010", "2014"],
      },
      {
        q: "Diwali sale: 50× traffic for a few hours. The BEST way to absorb order bursts without losing them?",
        options: [
          "Bigger single server",
          "Message queue + autoscaling workers",
          "Turn off the database",
          "Email orders to the kitchen",
        ],
      },
      {
        q: "In the Human Kitchen game, the order ticket with each station's time was an example of…",
        options: ["A metric", "A log", "A distributed trace", "A backup"],
      },
    ],
  },
  {
    id: "downtime",
    title: "Guess the Downtime",
    day: 2,
    slides: "Day2 · Guess the Downtime",
    kind: "form",
    scope: "team",
    intro:
      "Estimate annual downtime in minutes. Closest team per row in each region gets +20; ties share the award.",
    fields: [99, 99.9, 99.99, 99.999].map((n, i) => ({
      id: `guess${i}`,
      type: "number",
      label: `${n}% availability: annual downtime (minutes)`,
      min: 0,
      max: 525600,
      required: true,
    })),
  },
  {
    id: "mystery",
    title: "Who Killed Checkout?",
    day: 2,
    slides: "Workshop activity",
    kind: "mystery",
    intro:
      "Study the evidence, then submit one accusation per team. You can submit only once.",
  },
  {
    id: "treasure-hunt",
    title: "Observability Treasure Hunt",
    day: 2,
    slides: "Workshop activity",
    kind: "form",
    scope: "team",
    intro:
      "Submit your answers and evidence on your phone. Your captain reviews the work and awards up to 150 credits.",
    fields: [
      ...paperless.questions.flatMap((q) => [
        {
          id: q.id,
          type: "textarea" as const,
          label: `${q.label} (${q.points} points)`,
        },
        {
          id: `${q.id}proof`,
          type: "text" as const,
          label: "Proof: number, service name or link",
        },
      ]),
      {
        id: "reflection",
        type: "textarea",
        label: "What could you find faster with a query?",
      },
    ],
  },
  {
    id: "budget",
    title: "Error Budget Poker",
    day: 2,
    slides: "Workshop activity",
    kind: "budget",
    intro:
      "Your team starts the month with 43 minutes of error budget. Decide each card as it is revealed. Choices are final.",
  },
  {
    id: "postmortem",
    title: "Blameless postmortem",
    day: 2,
    slides: "Workshop activity",
    kind: "form",
    scope: "team",
    intro: "Ask “what” and “how”, never “who”.",
    fields: [
      {
        id: "summary",
        type: "textarea",
        label: "Summary (2 lines)",
        required: true,
      },
      {
        id: "impact",
        type: "textarea",
        label: "Impact: users, money, minutes",
        required: true,
      },
      {
        id: "timeline",
        type: "textarea",
        label: "Timeline (08:58 → recovery)",
        required: true,
      },
      {
        id: "rootCause",
        type: "textarea",
        label: "Root cause and contributing factors",
        required: true,
      },
      { id: "wentWell", type: "textarea", label: "What went well" },
      {
        id: "actions",
        type: "textarea",
        label: "Action items (owner role + when)",
        required: true,
      },
    ],
  },
  {
    id: "factory",
    title: "Digital Delivery Factory",
    day: 2,
    slides: "Day2 · Digital Delivery Factory",
    kind: "studio",
    intro:
      "Compare sequential work with a team pipeline. Track successful releases, lead time, failed changes and recovery.",
  },
  {
    id: "billshock",
    title: "Cloud Bill Shock",
    day: 2,
    slides: "Workshop activity",
    kind: "billshock",
    intro:
      "The month-end bill has arrived. For every loss, pick the control that would have prevented it to get half back.",
  },
  {
    id: "plan",
    title: "My 90-day cloud plan",
    day: 2,
    slides: "Workshop activity",
    kind: "form",
    scope: "individual",
    fields: [
      {
        id: "role",
        type: "select",
        label: "Target role",
        options: [
          "Cloud Architect",
          "DevOps Engineer",
          "Site Reliability Engineer",
          "Platform Engineer",
          "Cloud Security Engineer",
          "FinOps Analyst",
          "Observability Engineer",
          "AI / MLOps Engineer",
        ],
        required: true,
      },
      { id: "d30", type: "textarea", label: "Days 1–30", required: true },
      { id: "d60", type: "textarea", label: "Days 31–60", required: true },
      {
        id: "d90",
        type: "textarea",
        label: "Days 61–90 (certificate or project)",
        required: true,
      },
    ],
  },
  {
    id: "demo-vote",
    title: "Demo Day: region vote",
    day: 2,
    slides: "Workshop activity",
    kind: "vote",
    award: 0,
    intro:
      "Vote for the startup that should represent your region in the grand final. Not your own team.",
  },
  {
    id: "quiz-day2",
    title: "Day 2 recap quiz",
    day: 2,
    slides: "Workshop activity",
    kind: "quiz",
    mode: "quiz",
    points: 10,
    questions: [
      {
        q: "99.9% availability over a month allows roughly how much downtime?",
        options: ["4 minutes", "43 minutes", "7 hours", "3.6 days"],
      },
      {
        q: "SLO stands for…",
        options: [
          "Service Level Objective",
          "System Load Output",
          "Standard Latency Option",
          "Service Licence Order",
        ],
      },
      {
        q: "Which is NOT one of Google's 4 golden signals?",
        options: ["Latency", "Traffic", "Revenue", "Saturation"],
      },
      {
        q: "In “Who Killed Checkout?”, what was the weapon?",
        options: [
          "Full disk",
          "Slow payment gateway",
          "Database connection pool exhaustion",
          "Cache misses",
        ],
      },
      {
        q: "With IaaS, who patches the guest operating system?",
        options: [
          "Cloud provider",
          "The customer",
          "Nobody",
          "The hardware vendor",
        ],
      },
      {
        q: "Releasing a new version to 5% of users first and watching metrics is called…",
        options: ["Big bang", "Blue-green", "Canary", "Waterfall"],
      },
      {
        q: "Which is NOT a DORA metric?",
        options: [
          "Deployment frequency",
          "Lines of code written",
          "Change failure rate",
          "Lead time for changes",
        ],
      },
      {
        q: "Cheapest compute for interruptible nightly batch jobs?",
        options: [
          "Reserved instances",
          "Spot VMs",
          "Dedicated hosts",
          "Bigger VMs",
        ],
      },
      {
        q: "Which business system manages customers, leads and loyalty?",
        options: ["ERP", "CRM", "HCM", "SCM"],
      },
      {
        q: "A blameless postmortem focuses on…",
        options: [
          "Finding who to fire",
          "Systems and processes that allowed the failure",
          "Hiding the incident",
          "Blaming the vendor",
        ],
      },
    ],
  },
];

const SURVEY_TOPICS = [
  "IaaS / PaaS / SaaS",
  "Deployment models",
  "VMs and containers",
  "Cloud architecture and microservices",
  "Observability: logs, metrics, traces",
  "SRE: SLOs and error budgets",
  "DevOps and CI/CD",
  "Cloud security and cost",
  "Business systems (ERP, CRM…)",
  "Cloud career paths",
];

ACTIVITIES.unshift({
  id: "survey-pre",
  title: "Pre-workshop survey",
  day: 1,
  slides: "Day 1 · before slide 1",
  kind: "form",
  scope: "individual",
  intro:
    "Anonymous to other students. Rate your confidence: 1 = no idea, 5 = could teach it.",
  fields: [
    ...SURVEY_TOPICS.map((t, i) => ({
      id: `c${i}`,
      type: "scale" as const,
      label: t,
      required: true,
    })),
    {
      id: "hope",
      type: "textarea",
      label: "The one thing you want to walk away with",
    },
    {
      id: "word",
      type: "text",
      label: "One word that comes to mind when you hear “cloud”",
    },
  ],
});

ACTIVITIES.push({
  id: "survey-post",
  title: "Post-workshop feedback",
  day: 2,
  slides: "Workshop activity",
  kind: "form",
  scope: "individual",
  intro: "Be honest. It is a blameless postmortem for the workshop.",
  fields: [
    ...SURVEY_TOPICS.map((t, i) => ({
      id: `c${i}`,
      type: "scale" as const,
      label: t,
      required: true,
    })),
    {
      id: "nps",
      type: "number",
      label: "How likely are you to recommend this workshop? (0–10)",
      min: 0,
      max: 10,
      required: true,
    },
    {
      id: "learned",
      type: "textarea",
      label: "The most useful thing you learned",
    },
    { id: "improve", type: "textarea", label: "One thing to improve" },
  ],
});

export const ACTIVITY_BY_ID: Record<string, Activity> = Object.fromEntries(
  ACTIVITIES.map((a) => [a.id, a]),
);

const WORKSHOP_ORDER = [
  "survey-pre",
  "network-linkedin",
  "cloud-or-not",
  "timeline",
  "service-sort",
  "deploy-debate",
  "shark-pitch",
  "shark-vote",
  "network-github",
  "bingo",
  "architecture",
  "kitchen",
  "gallery",
  "quiz-day1",
  "network-x",
  "downtime",
  "mystery",
  "treasure-hunt",
  "budget",
  "postmortem",
  "factory",
  "billshock",
  "follow-order",
  "plan",
  "quiz-day2",
  "demo-vote",
  "survey-post",
];
ACTIVITIES.sort(
  (a, b) => WORKSHOP_ORDER.indexOf(a.id) - WORKSHOP_ORDER.indexOf(b.id),
);
