export const SUSPECTS = [
  {
    id: "pete",
    name: "Postgres Pete",
    what: "orders database",
    alibi: "I was just sitting there. Nobody even talked to me.",
  },
  {
    id: "dave",
    name: "Deploy Dave",
    what: "payment-service v2.3.1",
    alibi: "Tiny config tweak. FinOps approved it!",
  },
  {
    id: "priya",
    name: "PayFast Priya",
    what: "external payment gateway",
    alibi: "My status page is green.",
  },
  {
    id: "dinesh",
    name: "Disk-Full Dinesh",
    what: "log-server disk at 97%",
    alibi: "I have been this full for two days. Nobody cares.",
  },
  {
    id: "rani",
    name: "Redis Rani",
    what: "cache",
    alibi: "Hit ratio 94%, same as always.",
  },
  {
    id: "tara",
    name: "Traffic Tara",
    what: "launch surge, 3×",
    alibi: "You planned for 5×. Don’t blame me.",
  },
];

export const WEAPONS = [
  { id: "db-cpu", label: "The database ran out of CPU" },
  { id: "pool", label: "The database connection pool was exhausted" },
  { id: "gateway", label: "The payment gateway was slow or down" },
  { id: "disk", label: "The log server disk filled up" },
  { id: "cache", label: "The cache stopped working" },
  {
    id: "capacity",
    label: "Traffic went beyond what the servers could handle",
  },
];

export const BONUS_OPTIONS = [
  {
    id: "hold-connection",
    label: "A DB connection is held open during the external payment call",
  },
  { id: "transactional", label: "Using transactions at all is wrong" },
  {
    id: "insert-first",
    label: "Inserting the payment before calling the gateway",
  },
  { id: "fine", label: "Nothing, the code is fine" },
];

export const HINTS = [
  "Compare the database connections before and after 08:58.",
  "Look at the log lines from two days ago, then today’s.",
  "In the failed trace, what is missing?",
];

export const BRIEF = [
  "09:00 — ChaiCart launched in 5 cities. A push notification went to 2.1 million users.",
  "09:03 — Checkout success rate crashed from 99% to 38%. Customers see “Payment stuck on spinner…” for 30 seconds, then an error.",
  "Checkout path: app → checkout-service → cart-service, then payment-service → orders-db (PostgreSQL) + PayFast gateway. Also running: redis cache, log-server.",
];

// Deterministic noise so every phone shows identical charts.
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rnd = seeded(42);
const N = 31;
const noise = (v: number, pct: number) => v * (1 + (rnd() - 0.5) * pct);
const series = (fn: (k: number) => number) =>
  Array.from({ length: N }, (_, k) => fn(k));

export const timeLabel = (k: number) => {
  const m = 45 + k;
  return m < 60
    ? `08:${String(m).padStart(2, "0")}`
    : `09:${String(m - 60).padStart(2, "0")}`;
};

export interface ChartDef {
  title: string;
  data: number[];
  min: number;
  max: number;
}

export const CHARTS: ChartDef[] = [
  {
    title: "Checkout success rate (%)",
    data: series((k) =>
      k < 17 ? noise(99.2, 0.01) : k === 17 ? 71 : noise(39, 0.12),
    ),
    min: 0,
    max: 100,
  },
  {
    title: "Checkout requests / min",
    data: series((k) => (k < 15 ? noise(400, 0.08) : noise(1200, 0.06))),
    min: 0,
    max: 1500,
  },
  {
    title: "payment-service response time p95 (ms)",
    data: series((k) =>
      k < 16 ? noise(185, 0.1) : k === 16 ? 2400 : noise(30000, 0.01),
    ),
    min: 0,
    max: 32000,
  },
  {
    title: "orders-db CPU (%)",
    data: series(() => noise(28, 0.2)),
    min: 0,
    max: 100,
  },
  {
    title: "orders-db active connections",
    data: series((k) => (k < 14 ? Math.round(noise(42, 0.1)) : 5)),
    min: 0,
    max: 60,
  },
  {
    title: "PayFast gateway calls / min",
    data: series((k) =>
      k < 15 ? noise(395, 0.08) : k === 15 ? 470 : noise(452, 0.03),
    ),
    min: 0,
    max: 1500,
  },
  {
    title: "PayFast gateway latency (ms)",
    data: series(() => noise(205, 0.06)),
    min: 0,
    max: 1000,
  },
  {
    title: "redis cache hit ratio (%)",
    data: series(() => noise(94, 0.01)),
    min: 0,
    max: 100,
  },
  {
    title: "log-server disk used (%)",
    data: series(() => noise(97, 0.005)),
    min: 0,
    max: 100,
  },
  {
    title: "cart-service response time p95 (ms)",
    data: series(() => noise(19, 0.2)),
    min: 0,
    max: 200,
  },
];

export const LOGS: {
  t: string;
  level: "INFO" | "WARN" | "ERROR" | "NOTE";
  msg: string;
}[] = [
  { t: "[2 days ago]", level: "NOTE", msg: "" },
  {
    t: "18:02:11",
    level: "INFO",
    msg: "[payment-service] Starting payment-service v2.3.0 (build 51d0e2c)",
  },
  {
    t: "18:02:12",
    level: "INFO",
    msg: "[payment-service] HikariPool-1 - configuration: maximumPoolSize=50 connectionTimeout=30000",
  },
  {
    t: "18:40:03",
    level: "WARN",
    msg: "[log-server] Disk usage at 96% on /var/log (threshold 95%)",
  },
  { t: "[Launch day]", level: "NOTE", msg: "" },
  {
    t: "08:45:00",
    level: "INFO",
    msg: "[redis] Keyspace hits=94.2% evicted_keys=0",
  },
  {
    t: "08:50:14",
    level: "INFO",
    msg: "[checkout-service] POST /api/checkout 200 (312 ms) trace=a1f3…",
  },
  {
    t: "08:55:40",
    level: "WARN",
    msg: "[log-server] Disk usage at 97% on /var/log (threshold 95%)",
  },
  {
    t: "08:58:02",
    level: "INFO",
    msg: "[payment-service] Starting payment-service v2.3.1 (build 7f3c9a1)",
  },
  {
    t: "08:58:03",
    level: "INFO",
    msg: "[payment-service] HikariPool-1 - configuration: maximumPoolSize=5 connectionTimeout=30000",
  },
  {
    t: "08:58:05",
    level: "INFO",
    msg: "[payment-service] HikariPool-1 - Start completed.",
  },
  {
    t: "08:58:30",
    level: "INFO",
    msg: "[orders-db] connection closed: user=payment_svc (x45)",
  },
  {
    t: "09:00:00",
    level: "INFO",
    msg: "[notification-service] Campaign LAUNCH sent to 2,104,332 devices",
  },
  {
    t: "09:00:41",
    level: "INFO",
    msg: "[checkout-service] POST /api/checkout 200 (298 ms)",
  },
  {
    t: "09:01:52",
    level: "WARN",
    msg: "[payment-service] HikariPool-1 - Pool stats (total=5, active=5, idle=0, waiting=31)",
  },
  {
    t: "09:02:13",
    level: "WARN",
    msg: "[payment-service] HikariPool-1 - Pool stats (total=5, active=5, idle=0, waiting=87)",
  },
  {
    t: "09:02:43",
    level: "ERROR",
    msg: "[payment-service] HikariPool-1 - Connection is not available, request timed out after 30000ms.",
  },
  {
    t: "09:02:43",
    level: "ERROR",
    msg: "[checkout-service] POST /api/checkout failed: 504 Gateway Timeout from payment-service (30012 ms)",
  },
  {
    t: "09:02:44",
    level: "INFO",
    msg: "[redis] Keyspace hits=94.1% evicted_keys=0",
  },
  {
    t: "09:02:55",
    level: "WARN",
    msg: "[log-server] Disk usage at 97% on /var/log (threshold 95%)",
  },
  {
    t: "09:03:10",
    level: "INFO",
    msg: "[orders-db] checkpoint complete: wrote 312 buffers (0.4%); active connections=5",
  },
  {
    t: "09:03:12",
    level: "ERROR",
    msg: "[payment-service] HikariPool-1 - Connection is not available, request timed out after 30000ms.",
  },
  {
    t: "09:03:14",
    level: "INFO",
    msg: "[payfast-client] Gateway health check OK (latency 204 ms)",
  },
  {
    t: "09:03:30",
    level: "WARN",
    msg: '[frontend] Client error rate spike: "Payment stuck on spinner" x 1,284',
  },
  {
    t: "09:03:41",
    level: "INFO",
    msg: "[checkout-service] POST /api/checkout 200 (18,902 ms)",
  },
  {
    t: "09:04:02",
    level: "ERROR",
    msg: "[payment-service] HikariPool-1 - Connection is not available, request timed out after 30000ms.",
  },
  {
    t: "09:04:05",
    level: "INFO",
    msg: "[orders-db] LOG: duration: 11.8 ms  statement: INSERT INTO payments …",
  },
  {
    t: "09:04:20",
    level: "INFO",
    msg: "[cart-service] GET /api/cart 200 (17 ms)",
  },
  {
    t: "09:05:00",
    level: "WARN",
    msg: "[payment-service] HikariPool-1 - Pool stats (total=5, active=5, idle=0, waiting=214)",
  },
];

export interface Trace {
  title: string;
  total: number;
  spans: { name: string; start: number; dur: number; kind?: "err" | "wait" }[];
}

export const TRACES: Trace[] = [
  {
    title: "Trace a1f3… · 08:50:14 · 200 OK · 312 ms",
    total: 312,
    spans: [
      { name: "checkout-service POST /api/checkout", start: 0, dur: 312 },
      { name: "  cart-service GET /api/cart", start: 4, dur: 18 },
      { name: "  payment-service POST /pay", start: 26, dur: 280 },
      { name: "    HikariPool.getConnection", start: 27, dur: 1 },
      { name: "    orders-db INSERT payments", start: 29, dur: 12 },
      { name: "    PayFast POST /charge", start: 42, dur: 205 },
      { name: "    orders-db UPDATE payments", start: 250, dur: 5 },
    ],
  },
  {
    title: "Trace 7c20… · 09:03:41 · 200 OK (slow) · 18,902 ms",
    total: 18902,
    spans: [
      { name: "checkout-service POST /api/checkout", start: 0, dur: 18902 },
      { name: "  cart-service GET /api/cart", start: 3, dur: 19 },
      { name: "  payment-service POST /pay", start: 25, dur: 18870 },
      {
        name: "    HikariPool.getConnection",
        start: 26,
        dur: 18410,
        kind: "wait",
      },
      { name: "    orders-db INSERT payments", start: 18440, dur: 12 },
      { name: "    PayFast POST /charge", start: 18455, dur: 204 },
      { name: "    orders-db UPDATE payments", start: 18665, dur: 5 },
    ],
  },
  {
    title: "Trace e91b… · 09:03:12 · 504 Gateway Timeout · 30,020 ms",
    total: 30020,
    spans: [
      {
        name: "checkout-service POST /api/checkout",
        start: 0,
        dur: 30020,
        kind: "err",
      },
      { name: "  cart-service GET /api/cart", start: 3, dur: 19 },
      {
        name: "  payment-service POST /pay",
        start: 24,
        dur: 30005,
        kind: "err",
      },
      {
        name: "    HikariPool.getConnection (timeout)",
        start: 25,
        dur: 30000,
        kind: "wait",
      },
    ],
  },
];

export const CHANGES = [
  {
    when: "2 days ago 18:40",
    what: "Alert",
    details:
      "OPS-311 “log-server disk > 95%”, acknowledged, “clean old logs after launch”.",
  },
  {
    when: "Yesterday 18:00",
    what: "Deploy",
    details:
      "frontend v5.0: new launch banner and animations. Load tested: yes.",
  },
  {
    when: "Today 08:30",
    what: "Config",
    details: "redis: no change, health check only.",
  },
  {
    when: "Today 08:58",
    what: "Deploy",
    details:
      "payment-service v2.3.1 — FINOPS-482 “Right-size DB tier: reduce connection pool to lower DB cost”. Reviewer: cost-bot (approved). Load test: skipped, launch-day rush. Rollout: 100% at once.",
  },
  {
    when: "Today 09:00",
    what: "Marketing",
    details:
      "Launch push notification to 2.1M users. Expected traffic: up to 5× normal.",
  },
];

export const WITNESSES = [
  {
    who: "Meera, Support Lead",
    says: "From about 09:03 we got hundreds of tickets: “Payment stuck on spinner, then fails.” Nobody complained about menus or carts being slow.",
  },
  {
    who: "Arjun, DBA",
    says: "The database is bored! CPU under 30%. Actually I saw fewer connections than usual this morning. I thought it was a quiet day.",
  },
  {
    who: "Kabir, On-call SRE",
    says: "My pager went off for disk on the log server… but that alert has been firing for two days, so I muted it.",
  },
  {
    who: "Tanya, Head of Marketing",
    says: "We sent the push at 09:00 sharp. We told engineering to expect 5×. We only got 3×! This is not on us.",
  },
  {
    who: "Rohan, FinOps Analyst",
    says: "Great news: we are on track to save 22% on the database bill this month. Engineering made some tuning changes for us.",
  },
  {
    who: "PayFast Account Manager",
    says: "Our latency is completely normal. Honestly, we expected many more transactions from your launch.",
  },
];

export const CODE = `@Transactional   // opens a DB connection for the whole method
public PaymentResult pay(Order order) {
    paymentsRepo.insertPending(order);            // ~12 ms on the DB
    GatewayResponse r = payFast.charge(order);    // ~205 ms external HTTP call
    paymentsRepo.markResult(order, r.status());   // ~5 ms on the DB
    return PaymentResult.from(r);
}`;
