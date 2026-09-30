export type Field =
  | { id: string; type: 'text' | 'textarea'; label: string; required?: boolean }
  | { id: string; type: 'number'; label: string; min?: number; max?: number; required?: boolean }
  | { id: string; type: 'select'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'scale'; label: string; required?: boolean }
  | { id: string; type: 'checks'; label: string; options: { id: string; label: string }[] }

interface Base {
  id: string
  title: string
  day: 1 | 2
  /** Where this activity appears in the slide decks, for the facilitator. */
  slides: string
  intro?: string
}

export interface QuizActivity extends Base {
  kind: 'quiz'
  /** Polls are not scored; quizzes award `points` per question, scaled by the share of team members who got it right. */
  mode: 'quiz' | 'poll'
  points: number
  questions: { q: string; options: string[] }[]
}

export interface FormActivity extends Base {
  kind: 'form'
  scope: 'team' | 'individual'
  fields: Field[]
  /** Shown to each team based on its position, e.g. one scenario per team. */
  variants?: { title: string; body: string }[]
  creditsField?: string
  regionMax?: { field: string; award: number }
}

export interface VoteActivity extends Base {
  kind: 'vote'
  award: number
}

export interface SimpleActivity extends Base {
  kind: 'mystery' | 'budget' | 'billshock'
}

export type Activity = QuizActivity | FormActivity | VoteActivity | SimpleActivity

const CLOUD_OPTIONS = ['Cloud', 'Not cloud', 'It depends']

export const ACTIVITIES: Activity[] = [
  {
    id: 'cloud-or-not', title: 'Cloud or Not?', day: 1, slides: 'Day 1 · slides 5–6', kind: 'quiz', mode: 'poll', points: 0,
    intro: 'Vote on each item as it appears on the screen.',
    questions: ['Gmail', 'Pen drive', 'Netflix', 'UPI payment', 'Excel on your laptop', 'ChatGPT', 'Phone calculator', 'Google Photos backup']
      .map(q => ({ q, options: CLOUD_OPTIONS })),
  },
  {
    id: 'deploy-debate', title: 'Where Should They Live?', day: 1, slides: 'Day 1 · slide 18', kind: 'form', scope: 'team',
    intro: 'Read your scenario, decide as a team, and give your reasons. You may be picked to defend it in 60 seconds.',
    variants: [
      { title: 'A large Indian bank', body: 'Core banking on 20-year-old systems. Crores of customers. RBI regulated. Wants a modern mobile app and AI fraud detection.' },
      { title: 'OTT cricket startup', body: 'Launching a live-streaming app in 3 months. Traffic is near zero on normal days and explodes during matches.' },
      { title: 'Multi-city hospital chain', body: 'Patient records, MRI machines in every hospital, wants AI to read scans. Health data is highly sensitive.' },
      { title: 'State government portal', body: 'Land records, certificates and scholarships for 5 crore citizens. Must follow government cloud guidelines.' },
      { title: 'Global e-commerce company', body: 'Sells in 30 countries. The board worries about depending on one vendor. Some countries require local data storage.' },
      { title: 'Defence research lab', body: 'Top-secret designs. No internet connectivity allowed for core systems.' },
      { title: 'College fest website', body: 'Needed for 3 weeks: registrations, schedule, live leaderboard. Budget: almost zero.' },
      { title: 'Smart car factory', body: 'Robots on the assembly line need responses in under 10 ms. Management wants global analytics dashboards.' },
    ],
    fields: [
      { id: 'model', type: 'select', label: 'Our deployment model', options: ['Public cloud', 'Private cloud', 'Hybrid cloud', 'Multi-cloud', 'Government / community cloud'], required: true },
      { id: 'reason', type: 'textarea', label: 'Why? (compliance, latency, cost, scale, skills, lock-in)', required: true },
    ],
  },
  {
    id: 'shark-vote', title: 'Shark Tank: region vote', day: 1, slides: 'Day 1 · slide 23', kind: 'vote', award: 50,
    intro: 'Vote for the best pitch in your region. You cannot vote for your own team. One vote per team.',
  },
  {
    id: 'architecture', title: 'Architecture Lego: our design', day: 1, slides: 'Day 1 · slide 32', kind: 'form', scope: 'team',
    intro: 'After drawing your architecture on chart paper, tick what your design includes. Day 2 games will check this, so be honest.',
    fields: [
      { id: 'provider', type: 'select', label: 'Cloud provider', options: ['AWS', 'Microsoft Azure', 'Google Cloud', 'Oracle Cloud (OCI)'], required: true },
      { id: 'region', type: 'text', label: 'Cloud region(s), e.g. Central India', required: true },
      {
        id: 'components', type: 'checks', label: 'Our design includes', options: [
          { id: 'multiAZ', label: 'Multiple availability zones' },
          { id: 'autoscaling', label: 'Autoscaling or pre-scaling' },
          { id: 'cdn', label: 'CDN' },
          { id: 'waf', label: 'WAF / DDoS protection' },
          { id: 'queue', label: 'Message queue' },
          { id: 'cache', label: 'Cache' },
          { id: 'fallback', label: 'Circuit breaker or second payment gateway' },
          { id: 'monitoring', label: 'Monitoring / observability' },
          { id: 'vault', label: 'Secrets vault / managed identities' },
        ],
      },
    ],
  },
  {
    id: 'quiz-day1', title: 'Day 1 recap quiz', day: 1, slides: 'Day 1 · slide 43', kind: 'quiz', mode: 'quiz', points: 10,
    questions: [
      { q: "Which is NOT one of NIST's 5 essential cloud characteristics?", options: ['On-demand self-service', 'Rapid elasticity', 'Free of cost', 'Measured service'] },
      { q: 'You rent a VM, then install and patch the OS and your app yourself. Which model?', options: ['SaaS', 'PaaS', 'IaaS', 'On-premises'] },
      { q: 'Azure App Service, where you upload code and it runs, is…', options: ['IaaS', 'PaaS', 'SaaS', 'FaaS only'] },
      { q: 'A hospital keeps patient records on-prem but uses public cloud AI to analyse scans. That is…', options: ['Public cloud', 'Private cloud', 'Hybrid cloud', 'Community cloud'] },
      { q: 'Containers share which part of the host with each other?', options: ['The hypervisor', 'The operating system kernel', 'The guest OS', 'The BIOS'] },
      { q: 'Which tool orchestrates thousands of containers: restarts, scales, schedules?', options: ['Docker Hub', 'Kubernetes', 'Terraform', 'Jenkins'] },
      { q: 'Which component spreads incoming traffic across multiple servers?', options: ['CDN', 'Load balancer', 'DNS', 'Message queue'] },
      { q: 'In which year did AWS launch S3 and EC2?', options: ['2001', '2006', '2010', '2014'] },
      { q: 'Diwali sale: 50× traffic for a few hours. The BEST way to absorb order bursts without losing them?', options: ['Bigger single server', 'Message queue + autoscaling workers', 'Turn off the database', 'Email orders to the kitchen'] },
      { q: 'In the Human Kitchen game, the order ticket with each station\'s time was an example of…', options: ['A metric', 'A log', 'A distributed trace', 'A backup'] },
    ],
  },
  {
    id: 'downtime', title: 'Guess the Downtime', day: 2, slides: 'Day 2 · slide 6', kind: 'quiz', mode: 'quiz', points: 5,
    questions: [
      { q: '99% availability allows how much downtime per year?', options: ['About 9 hours', 'About 3.65 days', 'About 5 minutes', 'About 1 month'] },
      { q: '99.9% availability allows how much downtime per year?', options: ['About 52 minutes', 'About 3.65 days', 'About 8.76 hours', 'About 26 seconds'] },
      { q: '99.99% availability allows how much downtime per year?', options: ['About 52.6 minutes', 'About 8.76 hours', 'About 5 minutes', 'About 1 day'] },
      { q: '99.999% availability allows how much downtime per year?', options: ['About 52 minutes', 'About 5.26 minutes', 'About 26 seconds', 'About 1 hour'] },
    ],
  },
  {
    id: 'mystery', title: 'Who Killed Checkout?', day: 2, slides: 'Day 2 · slides 11–15', kind: 'mystery',
    intro: 'Study the evidence, then submit one accusation per team. You can submit only once.',
  },
  {
    id: 'treasure-hunt', title: 'Observability Treasure Hunt', day: 2, slides: 'Day 2 · slide 19', kind: 'form', scope: 'team',
    intro: 'Mark your answers as the facilitator reads them out, then submit your total.',
    creditsField: 'total',
    fields: [
      { id: 'total', type: 'number', label: 'Self-marked total (out of 150)', min: 0, max: 150, required: true },
      { id: 'hardest', type: 'text', label: 'Which question was hardest?' },
    ],
  },
  {
    id: 'budget', title: 'Error Budget Poker', day: 2, slides: 'Day 2 · slide 24', kind: 'budget',
    intro: 'Your team starts the month with 43 minutes of error budget. Decide each card as it is revealed. Choices are final.',
  },
  {
    id: 'postmortem', title: 'Blameless postmortem', day: 2, slides: 'Day 2 · slide 25', kind: 'form', scope: 'team',
    intro: 'Ask “what” and “how”, never “who”.',
    fields: [
      { id: 'summary', type: 'textarea', label: 'Summary (2 lines)', required: true },
      { id: 'impact', type: 'textarea', label: 'Impact: users, money, minutes', required: true },
      { id: 'timeline', type: 'textarea', label: 'Timeline (08:58 → recovery)', required: true },
      { id: 'rootCause', type: 'textarea', label: 'Root cause and contributing factors', required: true },
      { id: 'wentWell', type: 'textarea', label: 'What went well' },
      { id: 'actions', type: 'textarea', label: 'Action items (owner role + when)', required: true },
    ],
  },
  {
    id: 'paper-planes', title: 'Paper Plane Factory', day: 2, slides: 'Day 2 · slide 28', kind: 'form', scope: 'team',
    regionMax: { field: 'r2Flying', award: 50 },
    fields: [
      { id: 'r1Flying', type: 'number', label: 'Round 1: planes flying 3+ m', min: 0, max: 50, required: true },
      { id: 'r1First', type: 'number', label: 'Round 1: seconds until the first plane flew', min: 0, max: 600 },
      { id: 'r1Scrapped', type: 'number', label: 'Round 1: planes scrapped', min: 0, max: 50 },
      { id: 'r2Flying', type: 'number', label: 'Round 2: planes flying 3+ m', min: 0, max: 50, required: true },
      { id: 'r2First', type: 'number', label: 'Round 2: seconds until the first plane flew', min: 0, max: 600 },
      { id: 'r2Scrapped', type: 'number', label: 'Round 2: planes scrapped', min: 0, max: 50 },
    ],
  },
  {
    id: 'billshock', title: 'Cloud Bill Shock', day: 2, slides: 'Day 2 · slide 36', kind: 'billshock',
    intro: 'The month-end bill has arrived. For every loss, pick the control that would have prevented it to get half back.',
  },
  {
    id: 'plan', title: 'My 90-day cloud plan', day: 2, slides: 'Day 2 · slide 44', kind: 'form', scope: 'individual',
    fields: [
      { id: 'role', type: 'select', label: 'Target role', options: ['Cloud Architect', 'DevOps Engineer', 'Site Reliability Engineer', 'Platform Engineer', 'Cloud Security Engineer', 'FinOps Analyst', 'Observability Engineer', 'AI / MLOps Engineer'], required: true },
      { id: 'd30', type: 'textarea', label: 'Days 1–30', required: true },
      { id: 'd60', type: 'textarea', label: 'Days 31–60', required: true },
      { id: 'd90', type: 'textarea', label: 'Days 61–90 (certificate or project)', required: true },
    ],
  },
  {
    id: 'demo-vote', title: 'Demo Day: region vote', day: 2, slides: 'Day 2 · slide 48', kind: 'vote', award: 0,
    intro: 'Vote for the startup that should represent your region in the grand final. Not your own team.',
  },
  {
    id: 'quiz-day2', title: 'Day 2 recap quiz', day: 2, slides: 'Day 2 · slide 47', kind: 'quiz', mode: 'quiz', points: 10,
    questions: [
      { q: '99.9% availability over a month allows roughly how much downtime?', options: ['4 minutes', '43 minutes', '7 hours', '3.6 days'] },
      { q: 'SLO stands for…', options: ['Service Level Objective', 'System Load Output', 'Standard Latency Option', 'Service Licence Order'] },
      { q: "Which is NOT one of Google's 4 golden signals?", options: ['Latency', 'Traffic', 'Revenue', 'Saturation'] },
      { q: 'In “Who Killed Checkout?”, what was the weapon?', options: ['Full disk', 'Slow payment gateway', 'Database connection pool exhaustion', 'Cache misses'] },
      { q: 'With IaaS, who patches the guest operating system?', options: ['Cloud provider', 'The customer', 'Nobody', 'The hardware vendor'] },
      { q: 'Releasing a new version to 5% of users first and watching metrics is called…', options: ['Big bang', 'Blue-green', 'Canary', 'Waterfall'] },
      { q: 'Which is NOT a DORA metric?', options: ['Deployment frequency', 'Lines of code written', 'Change failure rate', 'Lead time for changes'] },
      { q: 'Cheapest compute for interruptible nightly batch jobs?', options: ['Reserved instances', 'Spot VMs', 'Dedicated hosts', 'Bigger VMs'] },
      { q: 'Which business system manages customers, leads and loyalty?', options: ['ERP', 'CRM', 'HCM', 'SCM'] },
      { q: 'A blameless postmortem focuses on…', options: ['Finding who to fire', 'Systems and processes that allowed the failure', 'Hiding the incident', 'Blaming the vendor'] },
    ],
  },
]

const SURVEY_TOPICS = [
  'IaaS / PaaS / SaaS', 'Deployment models', 'VMs and containers', 'Cloud architecture and microservices',
  'Observability: logs, metrics, traces', 'SRE: SLOs and error budgets', 'DevOps and CI/CD', 'Cloud security and cost',
  'Business systems (ERP, CRM…)', 'Cloud career paths',
]

ACTIVITIES.unshift({
  id: 'survey-pre', title: 'Pre-workshop survey', day: 1, slides: 'Day 1 · before slide 1', kind: 'form', scope: 'individual',
  intro: 'Anonymous to other students. Rate your confidence: 1 = no idea, 5 = could teach it.',
  fields: [
    ...SURVEY_TOPICS.map((t, i) => ({ id: `c${i}`, type: 'scale' as const, label: t, required: true })),
    { id: 'hope', type: 'textarea', label: 'The one thing you want to walk away with' },
    { id: 'word', type: 'text', label: 'One word that comes to mind when you hear “cloud”' },
  ],
})

ACTIVITIES.push({
  id: 'survey-post', title: 'Post-workshop feedback', day: 2, slides: 'Day 2 · slide 49', kind: 'form', scope: 'individual',
  intro: 'Be honest. It is a blameless postmortem for the workshop.',
  fields: [
    ...SURVEY_TOPICS.map((t, i) => ({ id: `c${i}`, type: 'scale' as const, label: t, required: true })),
    { id: 'nps', type: 'number', label: 'How likely are you to recommend this workshop? (0–10)', min: 0, max: 10, required: true },
    { id: 'learned', type: 'textarea', label: 'The most useful thing you learned' },
    { id: 'improve', type: 'textarea', label: 'One thing to improve' },
  ],
})

export const ACTIVITY_BY_ID: Record<string, Activity> = Object.fromEntries(ACTIVITIES.map(a => [a.id, a]))
