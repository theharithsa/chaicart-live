// Seed source only. Never import this module from browser code.

export const QUIZ_KEYS: Record<string, { answer: number; why: string }[]> = {
  "cloud-or-not": [
    {
      answer: 0,
      why: "Gmail runs entirely in Google’s data centres. You only own a browser.",
    },
    { answer: 1, why: "Local hardware, no network, no shared pool." },
    { answer: 0, why: "Streamed from the cloud: Netflix runs on AWS." },
    {
      answer: 0,
      why: "Cloud-like: NPCI runs a private, regulated platform connecting banks and apps through APIs.",
    },
    {
      answer: 2,
      why: "A local file is not cloud. AutoSave to OneDrive or co-editing is SaaS.",
    },
    { answer: 0, why: "GenAI runs on huge cloud GPU clusters." },
    { answer: 1, why: "Runs only on your phone." },
    {
      answer: 0,
      why: "Your photos live in Google’s storage, available on every device.",
    },
  ],
  "quiz-day1": [
    {
      answer: 2,
      why: "Cloud is pay-as-you-go, not free. The five: on-demand self-service, broad network access, resource pooling, rapid elasticity, measured service.",
    },
    {
      answer: 2,
      why: "IaaS: the provider gives you infrastructure; you manage the OS and above.",
    },
    {
      answer: 1,
      why: "PaaS: you bring code, the platform runs and scales it.",
    },
    {
      answer: 2,
      why: "Hybrid: private or on-premises combined with public cloud.",
    },
    {
      answer: 1,
      why: "Containers share the host kernel, which is why they are light and fast.",
    },
    { answer: 1, why: "Kubernetes: the orchestra conductor of containers." },
    {
      answer: 1,
      why: "The load balancer. A CDN caches content near users; DNS resolves names.",
    },
    { answer: 1, why: "2006. Azure became generally available in 2010." },
    { answer: 1, why: "Queues absorb bursts; autoscaling workers drain them." },
    {
      answer: 2,
      why: "One request followed across services: a distributed trace.",
    },
  ],
  downtime: [
    { answer: 1, why: "99% = 3.65 days per year (about 7.3 hours per month)." },
    {
      answer: 2,
      why: "99.9% = 8.76 hours per year (about 43.8 minutes per month).",
    },
    {
      answer: 0,
      why: "99.99% = 52.6 minutes per year (about 4.4 minutes per month).",
    },
    {
      answer: 1,
      why: "99.999% = 5.26 minutes per year (about 26 seconds per month).",
    },
  ],
  "quiz-day2": [
    { answer: 1, why: "About 43.8 minutes per month." },
    {
      answer: 0,
      why: "SLI = what you measure, SLO = your target, SLA = promise with penalties.",
    },
    { answer: 2, why: "Latency, Traffic, Errors, Saturation." },
    {
      answer: 2,
      why: "Pool cut from 50 to 5, then 3× traffic: requests timed out after 30 seconds.",
    },
    {
      answer: 1,
      why: "The customer. The provider secures OF the cloud; you secure what is IN it.",
    },
    { answer: 2, why: "Canary release. It would have caught Deploy Dave." },
    {
      answer: 1,
      why: "DORA: deployment frequency, lead time, change failure rate, time to restore.",
    },
    {
      answer: 1,
      why: "Spot VMs: deep discounts, but they can be reclaimed at short notice.",
    },
    { answer: 1, why: "CRM: Salesforce, Dynamics 365, Zoho…" },
    { answer: 1, why: "Ask “what” and “how”, never “who”." },
  ],
};

export const MYSTERY_KEY = {
  killer: "dave",
  weapon: "pool",
  accomplice: "tara",
  bonus: "hold-connection",
  points: {
    killer: 200,
    weapon: 100,
    accomplice: 50,
    fix: 50,
    bonus: 25,
    first: 100,
    wrongKiller: -50,
  },
};
