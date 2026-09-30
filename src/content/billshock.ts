export interface BillCard {
  id: string
  title: string
  text: string
  delta?: number
  /** Outcome depends on the team's architecture: `pos` if the component is present, otherwise `neg`. */
  needs?: { component: string; pos: number; neg: number }
  /** First option is the correct control; the app shuffles the display order. */
  controls?: string[]
}

export const BILL_CARDS: BillCard[] = [
  { id: 'gpu', title: 'GPU left running', text: 'An intern left a GPU VM running all weekend “for testing”.', delta: -150,
    controls: ['Auto-shutdown schedules with budget alerts', 'A bigger GPU', 'Moving to another region', 'Turning off logging'] },
  { id: 'bucket', title: 'Public storage bucket', text: 'A storage container was public. Customer invoices were indexed by a search engine.', delta: -300,
    controls: ['Private-by-default storage with a policy blocking public access', 'A CDN in front of storage', 'More storage replicas', 'Faster disks'] },
  { id: 'ipl', title: 'IPL final surge', text: 'Traffic jumped 20× in the final over.', needs: { component: 'autoscaling', pos: 150, neg: -200 },
    controls: ['Autoscaling or pre-scaling before the match', 'A larger database', 'Longer log retention', 'A second domain name'] },
  { id: 'reserved', title: 'Reserved capacity', text: 'You committed to 1-year reserved instances for your steady database.', delta: 100 },
  { id: 'disks', title: 'Orphaned disks', text: '200 unattached disks from deleted VMs are still being billed.', delta: -60,
    controls: ['Regular clean-up with tagging and inventory queries', 'Premium SSDs', 'Bigger VMs', 'Turning off backups'] },
  { id: 'keys', title: 'Keys on GitHub', text: 'Cloud keys were pushed to a public repo. Crypto miners launched 50 VMs in 2 hours.', delta: -250,
    controls: ['A secrets vault, secret scanning and managed identities', 'A private fork of the repo', 'Stronger developer passwords', 'Longer API keys'] },
  { id: 'spot', title: 'Spot VMs for batch', text: 'Nightly report jobs moved to discounted Spot VMs.', delta: 80 },
  { id: 'logs', title: 'Debug logs forever', text: 'DEBUG logging was left on in production and stored forever. The telemetry bill tripled.', delta: -100,
    controls: ['Log levels, sampling and retention policies', 'A bigger log server disk', 'Emailing logs to the team', 'More dashboards'] },
  { id: 'rightsize', title: 'Rightsizing', text: 'Metrics showed VMs at 8% average CPU. You downsized them.', delta: 90 },
  { id: 'egress', title: 'Egress surprise', text: 'Promo videos were served across regions without a CDN. Data-transfer charges exploded.', delta: -120,
    controls: ['A CDN, keeping content close to users', 'Bigger video files', 'Storing videos in more regions', 'Faster VMs'] },
  { id: 'mfa', title: 'MFA saves the day', text: 'An admin clicked a phishing link, but MFA blocked the login.', delta: 100 },
  { id: 'tags', title: 'Tag everything', text: 'Every resource is tagged by team and app. The CFO finally knows who spends what.', delta: 50 },
  { id: 'ddos', title: 'DDoS on launch day', text: 'Attackers flooded ChaiCart with fake traffic.', needs: { component: 'waf', pos: 50, neg: -200 },
    controls: ['A WAF with DDoS protection', 'More developers on call', 'A second cloud account', 'Longer timeouts'] },
  { id: 'night', title: 'Night shutdown', text: 'Dev/test environments now auto-stop at 8 PM and on weekends.', delta: 70 },
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  let s = seed || 1
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296
}

export function dealBill(sessionId: string, teamId: string): BillCard[] {
  const r = rng(hash(`${sessionId}:${teamId}`))
  const pool = [...BILL_CARDS]
  const out: BillCard[] = []
  while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return out
}

export function shuffledControls(card: BillCard, teamId: string) {
  const r = rng(hash(`${card.id}:${teamId}`))
  return [...(card.controls ?? [])].sort(() => r() - 0.5)
}

export function cardOutcome(card: BillCard, components: string[]) {
  if (card.delta !== undefined) return card.delta
  const n = card.needs!
  return components.includes(n.component) ? n.pos : n.neg
}

export function evaluateBill(sessionId: string, teamId: string, components: string[], controls: Record<string, string>) {
  const cards = dealBill(sessionId, teamId).map(card => {
    const outcome = cardOutcome(card, components)
    const correct = outcome < 0 && card.controls ? controls[card.id] === card.controls[0] : false
    const refund = correct ? Math.round(-outcome / 2) : 0
    return { card, outcome, refund, picked: controls[card.id] }
  })
  return { cards, total: cards.reduce((s, c) => s + c.outcome + c.refund, 0) }
}
