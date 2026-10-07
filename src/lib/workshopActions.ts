import { businessEvent } from "./rum-business.js";
import { getApp } from "firebase/app";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from "firebase/functions";
import { observe } from "./telemetry";
let backend: Functions | undefined;
export async function workshopAction(data: Record<string, unknown>) {
  if (!backend) {
    backend = getFunctions(getApp(), "asia-south1");
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_USE_EMULATORS === "true" &&
      ["localhost", "127.0.0.1"].includes(location.hostname)
    )
      connectFunctionsEmulator(backend, "127.0.0.1", 5001);
  }
  const call = httpsCallable<
    Record<string, unknown>,
    { message?: string; deleted?: string }
  >(backend, "workshopAction", { timeout: 540000 });
  const transactionId = crypto.randomUUID();
  return observe(
    "workshop." + String(data.action),
    async (span) => {
      const response = await call({
        ...data,
        clientContext: {
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          transactionId,
        },
      });
      businessEvent("staff.action.completed", {
        operation: String(data.action),
        "workshop.session.id": String(data.sid),
        "transaction.id": transactionId,
        ...(typeof data.teamId === "string"
          ? { "workshop.team.id": data.teamId }
          : {}),
        ...(typeof data.activity === "string"
          ? { "workshop.activity.id": data.activity }
          : {}),
        ...(typeof data.delta === "number"
          ? { "credits.delta": data.delta }
          : {}),
        outcome: "success",
      });
      return response.data;
    },
    {
      "workshop.session.id": String(data.sid),
      ...(typeof data.teamId === "string"
        ? { "workshop.team.id": data.teamId }
        : {}),
      ...(typeof data.activity === "string"
        ? { "workshop.activity.id": data.activity }
        : {}),
      "transaction.id": transactionId,
    },
  );
}
