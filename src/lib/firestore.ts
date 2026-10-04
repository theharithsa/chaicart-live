// Instrument the same Firebase SDK calls without changing data, transactions or rules.
export * from "firebase/firestore";
import * as sdk from "firebase/firestore";
import { observe, operationAttributes } from "./telemetry";

const pathOf = (value: unknown): string | undefined => {
  if (value && typeof value === "object" && "path" in value) return String(value.path);
  return undefined;
};
function wrap<F extends (...args: any[]) => Promise<any>>(name: string, fn: F): F {
  return ((...args: Parameters<F>) => observe(name, () => fn(...args), operationAttributes(pathOf(args[0])))) as F;
}
export const getDoc = wrap("firestore.document.read", sdk.getDoc);
export const getDocs = wrap("firestore.query.read", sdk.getDocs);
export const setDoc = wrap("firestore.document.write", sdk.setDoc);
export const updateDoc = wrap("firestore.document.update", sdk.updateDoc);
export const deleteDoc = wrap("firestore.document.delete", sdk.deleteDoc);
export const addDoc = wrap("firestore.document.add", sdk.addDoc);
export const runTransaction: typeof sdk.runTransaction = ((db: sdk.Firestore, update: (tx: sdk.Transaction) => Promise<unknown>, options?: sdk.TransactionOptions) => observe("firestore.transaction", span => sdk.runTransaction(db, tx => {
  const instrumented = new Proxy(tx, { get(target, key) {
    if (key === "get") return (ref: sdk.DocumentReference) => {
      const attributes = operationAttributes(ref.path); span.setAttributes(attributes);
      return observe("firestore.transaction.read", () => target.get(ref), attributes, span);
    };
    const value = Reflect.get(target, key);
    if (typeof value === "function") return (...args: unknown[]) => {
      if (["set", "update", "delete"].includes(String(key))) { span.setAttributes(operationAttributes(pathOf(args[0]))); span.addEvent("transaction." + String(key)); }
      return value.apply(target, args);
    };
    return value;
  } });
  return update(instrumented);
}, options))) as typeof sdk.runTransaction;
export const writeBatch: typeof sdk.writeBatch = (...args) => {
  const batch = sdk.writeBatch(...args);
  const commit = batch.commit.bind(batch);
  batch.commit = () => observe("firestore.batch.commit", () => commit());
  return batch;
};

// A real-time subscription is not one infinite span. Measure initial load, errors,
// and recovery, without exporting a record for every leaderboard snapshot.
export const onSnapshot: typeof sdk.onSnapshot = ((...args: any[]) => {
  let finish: (() => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
  let first = true;
  let failed = false;
  void observe("firestore.listener.initial", () => new Promise<void>((resolve, failure) => { finish = resolve; reject = failure; }), operationAttributes(pathOf(args[0]))).catch(() => {});
  const nextIndex = args.findIndex((arg, index) => index > 0 && typeof arg === "function");
  const observerIndex = args.findIndex((arg, index) => index > 0 && arg && typeof arg === "object" && ("next" in arg || "error" in arg));
  const next = (original?: (...values: any[]) => void) => (...values: any[]) => {
    if (first) { first = false; finish?.(); }
    if (failed) { failed = false; void observe("firestore.listener.recovered", async () => {}).catch(() => {}); }
    original?.(...values);
  };
  const error = (original?: (reason: any) => void) => (reason: any) => {
    failed = true;
    if (first) { first = false; reject?.(reason); }
    else void observe("firestore.listener.error", async () => { throw reason; }).catch(() => {});
    original?.(reason);
  };
  if (nextIndex > 0) { const original = args[nextIndex]; const originalError = args[nextIndex + 1]; args[nextIndex] = next(original); args[nextIndex + 1] = error(originalError); }
  else if (observerIndex > 0) { const original = args[observerIndex]; args[observerIndex] = { ...original, next: next(original.next), error: error(original.error) }; }
  const unsubscribe = (sdk.onSnapshot as (...values: any[]) => () => void)(...args);
  return () => { finish?.(); unsubscribe(); };
}) as typeof sdk.onSnapshot;
