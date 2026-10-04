import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "./firestore";
import { auth, db } from "../firebase";

export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

/** Live document data: undefined while loading, null if missing or not readable. */
export function useDocData<T>(path: string | null): T | null | undefined {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null | undefined;
  }>({ path, data: undefined });
  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db, path),
      (s) => setState({ path, data: s.exists() ? (s.data() as T) : null }),
      (e) => {
        window.dispatchEvent(
          new CustomEvent("chaicart-data-error", {
            detail: `Could not load workshop data (${e.code}). Check access or reconnect.`,
          }),
        );
        setState({ path, data: null });
      },
    );
  }, [path]);
  return state.path === path ? state.data : undefined;
}

export type WithId<T> = T & { id: string };

/** Live collection, optionally filtered by one equality condition. */
export function useCollectionData<T>(
  path: string | null,
  field?: string,
  value?: string,
  secondField?: string,
  secondValue?: string,
): WithId<T>[] | undefined {
  const key = path
    ? `${path}|${field ?? ""}|${value ?? ""}|${secondField ?? ""}|${secondValue ?? ""}`
    : null;
  const [state, setState] = useState<{
    key: string | null;
    rows: WithId<T>[] | undefined;
  }>({ key, rows: undefined });
  useEffect(() => {
    if (!path || !key) return;
    const ref = collection(db, path);
    const filters = [];
    if (field) filters.push(where(field, "==", value));
    if (secondField) filters.push(where(secondField, "==", secondValue));
    const q = filters.length ? query(ref, ...filters) : ref;
    return onSnapshot(
      q,
      (s) =>
        setState({
          key,
          rows: s.docs.map((d) => ({ id: d.id, ...(d.data() as T) })),
        }),
      (e) => {
        window.dispatchEvent(
          new CustomEvent("chaicart-data-error", {
            detail: `Could not load workshop list (${e.code}). Check access or reconnect.`,
          }),
        );
        setState({ key, rows: [] });
      },
    );
  }, [path, field, value, key, secondField, secondValue]);
  return state.key === key ? state.rows : undefined;
}

export function useIsAdmin(user: User | null | undefined) {
  const [state, setState] = useState<{
    email: string | null;
    ok: boolean | undefined;
  }>({ email: null, ok: undefined });
  const email = user?.email ?? null;
  useEffect(() => {
    if (!email) return;
    getDoc(doc(db, "admins", email))
      .then((s) =>
        setState({
          email,
          ok: s.exists() && (!s.data().role || s.data().role === "facilitator"),
        }),
      )
      .catch(() => setState({ email, ok: false }));
  }, [email]);
  if (user === undefined) return undefined;
  if (!email) return false;
  return state.email === email ? state.ok : undefined;
}

export function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
