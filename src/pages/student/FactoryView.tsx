import { useState } from "react";
import { doc, runTransaction, serverTimestamp } from "../../lib/firestore";
import { db } from "../../firebase";
import { useCollectionData, useDocData, useNow } from "../../lib/hooks";
import type { SimpleActivity } from "../../content/activities";
import type { StudentProps } from "./shared";
export interface FactoryTicket {
  teamId: string;
  round: number;
  ticket: number;
  stage: number;
  failures: number;
  checksum?: number;
  startedAt?: { toMillis: () => number };
  updatedAt?: { toMillis: () => number };
  deployedAt?: { toMillis: () => number };
  failedAt?: { toMillis: () => number };
  recoveredAt?: { toMillis: () => number };
}
export function factoryMetrics(rows: FactoryTicket[], duration = 180) {
  const done = rows.filter((t) => t.stage === 4);
  const lead = done
    .map(
      (t) =>
        ((t.deployedAt?.toMillis() ?? 0) - (t.startedAt?.toMillis() ?? 0)) /
        1000,
    )
    .sort((a, b) => a - b);
  const failed = rows.filter((t) => t.failures > 0);
  const recovery = done
    .filter((t) => t.failedAt && t.recoveredAt)
    .map((t) => (t.recoveredAt!.toMillis() - t.failedAt!.toMillis()) / 1000);
  return {
    successful: done.length,
    lead: lead.length ? lead[Math.floor(lead.length / 2)] : 0,
    frequency: done.length / (duration / 60),
    failureRate: rows.length ? (100 * failed.length) / rows.length : 0,
    recovery: recovery.length
      ? recovery.reduce((a, b) => a + b, 0) / recovery.length
      : 0,
    failures: rows.reduce((a, b) => a + b.failures, 0),
  };
}
export default function FactoryView({
  sid,
  uid,
  student,
}: StudentProps & { activity: SimpleActivity }) {
  const config = useDocData<{ round: number; open: boolean; endsAt: number }>(
    `sessions/${sid}/public/factory`,
  );
  const all =
    useCollectionData<FactoryTicket>(
      `sessions/${sid}/factoryTickets`,
      "teamId",
      student.teamId,
    ) ?? [];
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [status, setStatus] = useState("");
  const now = useNow(1000);
  const round = config?.round ?? 1;
  const rows = all.filter((t) => t.round === round);
  const roles = ["CEO", "CTO", "SRE", "COO"];
  async function act(ticket: number) {
    try {
      setStatus("Pending server confirmation…");
      await runTransaction(db, async (tx) => {
        const ref = doc(
          db,
          `sessions/${sid}/factoryTickets/${student.teamId}__${round}__${ticket}`,
        );
        const snap = await tx.get(ref);
        const old = snap.data() as FactoryTicket | undefined;
        const stage = old?.stage ?? 0;
        const lock = doc(
          db,
          `sessions/${sid}/factoryLocks/${student.teamId}__${round}`,
        );
        if (stage === 0 && round === 1) {
          const previous = await tx.get(lock);
          if (previous.exists()) {
            const prior = await tx.get(
              doc(
                db,
                `sessions/${sid}/factoryTickets/${student.teamId}__${round}__${previous.data().ticket}`,
              ),
            );
            if (prior.data()?.stage !== 4)
              throw new Error("Finish the active ticket first.");
          }
        }
        if (stage >= 4) throw new Error("Already deployed");
        if (stage === 0) {
          if (round === 1)
            tx.set(lock, { teamId: student.teamId, round, ticket });
          tx.set(ref, {
            teamId: student.teamId,
            round,
            ticket,
            stage: 1,
            failures: 0,
            startedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastBy: uid,
          });
        } else if (stage === 1) {
          const checksum = Number(inputs[ticket]);
          if (!Number.isInteger(checksum) || checksum < 0 || checksum > 100)
            throw new Error("Enter a whole number between 0 and 100.");
          tx.update(ref, {
            checksum,
            stage: 2,
            lastBy: uid,
            updatedAt: serverTimestamp(),
          });
        } else if (stage === 2) {
          const pass = old!.checksum === ticket + round + 8;
          tx.update(
            ref,
            pass
              ? {
                  stage: 3,
                  updatedAt: serverTimestamp(),
                  lastBy: uid,
                  ...(old!.failures ? { recoveredAt: serverTimestamp() } : {}),
                }
              : {
                  stage: 1,
                  failures: old!.failures + 1,
                  failedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  lastBy: uid,
                },
          );
        } else {
          tx.update(ref, {
            stage: 4,
            deployedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastBy: uid,
          });
        }
      });
      setStatus("Transition confirmed.");
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <div className="stack">
      <div className="card stack">
        <h3>
          Round {round}: {round === 1 ? "Sequential delivery" : "Team pipeline"}
        </h3>
        <p>
          {round === 1
            ? "COO does every stage, one ticket at a time."
            : "CEO plans, CTO builds, SRE tests and COO deploys; work on multiple tickets. CFO watches flow and suggests improvements."}
        </p>
        <p>
          Build requirement: checksum = ticket number (zero-based) + round + 8.
          Testing validates your build; a failed test returns it to Build.
        </p>
        <p className="small">
          Round ends at{" "}
          {config?.endsAt
            ? new Date(config.endsAt).toLocaleTimeString()
            : "facilitator start"}
          . Results require server confirmation.
        </p>
      </div>
      {Array.from({ length: 6 }, (_, i) => {
        const t = rows.find((t) => t.ticket === i);
        const stage = t?.stage ?? 0;
        const allowed =
          round === 1 ? student.role === "COO" : student.role === roles[stage];
        const sequential =
          round !== 1 || !rows.some((x) => x.ticket !== i && x.stage < 4);
        return (
          <div className="card stack" key={i}>
            <b>
              Release {i + 1} ·{" "}
              {["Plan", "Build", "Test", "Deploy", "Released"][stage]}
            </b>
            {stage === 1 && (
              <label className="field">
                Checksum
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={inputs[i] ?? ""}
                  onChange={(e) =>
                    setInputs({ ...inputs, [i]: e.target.value })
                  }
                />
              </label>
            )}
            <span className="small">Failures: {t?.failures ?? 0}</span>
            <button
              className="btn"
              disabled={
                !config?.open ||
                now > config.endsAt ||
                !allowed ||
                !sequential ||
                stage === 4
              }
              onClick={() => act(i)}
            >
              {
                [
                  "Plan release",
                  "Submit build",
                  "Run tests",
                  "Deploy",
                  "Released",
                ][stage]
              }
            </button>
          </div>
        );
      })}
      <div className="card small">
        <h3>DORA comparison</h3>
        {[1, 2].map((r) => {
          const m = factoryMetrics(all.filter((t) => t.round === r));
          return (
            <p key={r}>
              Round {r}: {m.successful} successful releases ·{" "}
              {m.frequency.toFixed(1)}/minute · median lead {m.lead.toFixed(1)}s
              · change failures {m.failureRate.toFixed(0)}% · recovery{" "}
              {m.recovery.toFixed(1)}s
            </p>
          );
        })}
      </div>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
