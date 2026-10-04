export interface BudgetCard {
  id: string;
  title: string;
  text: string;
  forced?: boolean;
  a: string;
  b?: string;
  /** Option A is a risky "ship" choice, blocked once the budget is exhausted. */
  riskyA?: boolean;
  /** Option A needs a die roll. */
  rollA?: boolean;
}

export const BUDGET_START = 43;

export const BUDGET_CARDS: BudgetCard[] = [
  {
    id: "friday",
    title: "Friday 6 PM feature",
    text: "The loyalty feature is ready. Ship it now?",
    a: "Ship now: roll a die. 1–3 → lose 20 min. 4–6 → +60 credits.",
    b: "Wait till Monday: +20 credits, no risk.",
    riskyA: true,
    rollA: true,
  },
  {
    id: "chaos",
    title: "Chaos experiment",
    text: "Run a planned game day to practise failure?",
    a: "Yes: lose 5 min now, and shrug off the next forced outage.",
    b: "No: nothing happens.",
  },
  {
    id: "zone",
    title: "Zone outage",
    text: "One availability zone goes down. No choice!",
    forced: true,
    a: "Multi-zone design → no loss. Otherwise lose 25 min.",
  },
  {
    id: "flash",
    title: "Flash sale tonight",
    text: "Marketing wants a surprise sale.",
    a: "Go without a load test: roll a die. 1–2 → lose 30 min. 3–6 → +80 credits.",
    b: "Load test first: pay 30 credits, then earn 80 credits.",
    riskyA: true,
    rollA: true,
  },
  {
    id: "cert",
    title: "Certificate expiring",
    text: "The TLS certificate expires in 2 days.",
    a: "Renew now: no loss.",
    b: "“Later”: lose 30 min when it expires.",
  },
  {
    id: "toil",
    title: "Automate the toil",
    text: "An engineer wants a sprint to automate manual restarts.",
    a: "Approve: pay 40 credits; every later minute loss is halved.",
    b: "Decline: nothing happens.",
  },
  {
    id: "canary",
    title: "Canary looks sick",
    text: "The new version on 5% of users shows +2% errors.",
    a: "Roll back: lose 2 min.",
    b: "Push to 100%: lose 15 min.",
  },
  {
    id: "bug",
    title: "Sunday-night bug",
    text: "A bug shows the wrong price for samosas.",
    a: "Hotfix now, skip tests: roll a die. 1–3 → lose 10 min.",
    b: "Proper fix Monday morning: lose 5 min.",
    riskyA: true,
    rollA: true,
  },
  {
    id: "gateway",
    title: "Payment gateway wobble",
    text: "PayFast degrades for an hour. No choice!",
    forced: true,
    a: "Circuit breaker or second gateway → lose 3 min. Otherwise lose 20 min.",
  },
];

export type BudgetChoice = { c: "A" | "B"; roll?: number };

export interface BudgetStep {
  title: string;
  lost: number;
  credits: number;
  note: string;
}

export function evaluateBudget(
  choices: Record<string, BudgetChoice>,
  components: string[],
) {
  const has = (c: string) => components.includes(c);
  let minutes = BUDGET_START;
  let credits = 0;
  let toil = false;
  let shield = false;
  const steps: BudgetStep[] = [];

  BUDGET_CARDS.forEach((card, i) => {
    const chosen = choices[String(i)];
    const ch =
      minutes < 0 && card.riskyA && chosen?.c === "A"
        ? { c: "B" as const }
        : chosen;
    if (!ch) return;
    let lost = 0;
    let cr = 0;
    let note = "";
    const roll = ch.roll ?? 0;
    switch (card.id) {
      case "friday":
        if (ch.c === "A") {
          if (roll <= 3) {
            lost = 20;
            note = `Rolled ${roll}: the release broke checkout.`;
          } else {
            cr = 60;
            note = `Rolled ${roll}: customers love it.`;
          }
        } else {
          cr = 20;
          note = "Safe Monday release.";
        }
        break;
      case "chaos":
        if (ch.c === "A") {
          lost = 5;
          shield = true;
          note = "Game day done: you are ready for the next outage.";
        } else note = "Skipped.";
        break;
      case "zone":
        if (shield) {
          shield = false;
          note = "Your game-day practice absorbed the outage.";
        } else if (has("multiAZ"))
          note = "Multi-zone design: traffic moved to healthy zones.";
        else {
          lost = 25;
          note = "Single zone: ChaiCart went down.";
        }
        break;
      case "flash":
        if (ch.c === "A") {
          if (roll <= 2) {
            lost = 30;
            note = `Rolled ${roll}: the site fell over.`;
          } else {
            cr = 80;
            note = `Rolled ${roll}: record sales.`;
          }
        } else {
          cr = 50;
          note = "Load tested, then a smooth sale (−30 +80).";
        }
        break;
      case "cert":
        if (ch.c === "A") note = "Renewed in time.";
        else {
          lost = 30;
          note = "The certificate expired: browsers blocked the site.";
        }
        break;
      case "toil":
        if (ch.c === "A") {
          cr = -40;
          toil = true;
          note = "Automation built: later losses are halved.";
        } else note = "Declined.";
        break;
      case "canary":
        lost = ch.c === "A" ? 2 : 15;
        note =
          ch.c === "A"
            ? "Rolled back quickly."
            : "Everyone got the broken version.";
        break;
      case "bug":
        if (ch.c === "A") {
          if (roll <= 3) {
            lost = 10;
            note = `Rolled ${roll}: the hotfix broke something else.`;
          } else note = `Rolled ${roll}: the hotfix worked.`;
        } else {
          lost = 5;
          note = "Customers saw the wrong price until Monday.";
        }
        break;
      case "gateway":
        if (shield) {
          shield = false;
          note = "Your game-day practice absorbed the outage.";
        } else if (has("fallback")) {
          lost = 3;
          note = "Circuit breaker switched to the backup gateway.";
        } else {
          lost = 20;
          note = "Every payment hung until PayFast recovered.";
        }
        break;
    }
    if (toil && card.id !== "toil" && lost > 0) lost = Math.ceil(lost / 2);
    minutes -= lost;
    credits += cr;
    steps.push({ title: card.title, lost, credits: cr, note });
  });

  const done = steps.length === BUDGET_CARDS.length;
  const endBonus = minutes >= 0 ? minutes * 3 : -100;
  return {
    minutes,
    credits,
    steps,
    done,
    endBonus,
    total: credits + (done ? endBonus : 0),
  };
}

export const isFrozen = (
  choices: Record<string, BudgetChoice>,
  components: string[],
  upTo: number,
) => {
  const partial: Record<string, BudgetChoice> = {};
  for (let i = 0; i < upTo; i++)
    if (choices[String(i)]) partial[String(i)] = choices[String(i)];
  return evaluateBudget(completeChoices(partial, upTo), components).minutes < 0;
};

/** Undecided cards count as option B (or as applied, for forced cards) so skipping never helps. */
export function completeChoices(
  choices: Record<string, BudgetChoice>,
  upTo: number,
) {
  const out = { ...choices };
  for (let i = 0; i < Math.min(upTo, BUDGET_CARDS.length); i++)
    if (!out[String(i)])
      out[String(i)] = { c: BUDGET_CARDS[i].forced ? "A" : "B" };
  return out;
}
