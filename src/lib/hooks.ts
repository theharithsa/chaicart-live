import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase'

export function useAuthUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return user
}

/** Live document data: undefined while loading, null if missing or not readable. */
export function useDocData<T>(path: string | null): T | null | undefined {
  const [state, setState] = useState<{ path: string | null; data: T | null | undefined }>({ path, data: undefined })
  useEffect(() => {
    if (!path) return
    return onSnapshot(
      doc(db, path),
      s => setState({ path, data: s.exists() ? (s.data() as T) : null }),
      () => setState({ path, data: null }),
    )
  }, [path])
  return state.path === path ? state.data : undefined
}

export type WithId<T> = T & { id: string }

/** Live collection, optionally filtered by one equality condition. */
export function useCollectionData<T>(path: string | null, field?: string, value?: string): WithId<T>[] | undefined {
  const key = path ? `${path}|${field ?? ''}|${value ?? ''}` : null
  const [state, setState] = useState<{ key: string | null; rows: WithId<T>[] | undefined }>({ key, rows: undefined })
  useEffect(() => {
    if (!path || !key) return
    const ref = collection(db, path)
    const q = field ? query(ref, where(field, '==', value)) : ref
    return onSnapshot(
      q,
      s => setState({ key, rows: s.docs.map(d => ({ id: d.id, ...(d.data() as T) })) }),
      () => setState({ key, rows: [] }),
    )
  }, [path, field, value, key])
  return state.key === key ? state.rows : undefined
}

export function useIsAdmin(user: User | null | undefined) {
  const [state, setState] = useState<{ email: string | null; ok: boolean | undefined }>({ email: null, ok: undefined })
  const email = user?.email ?? null
  useEffect(() => {
    if (!email) return
    getDoc(doc(db, 'admins', email))
      .then(s => setState({ email, ok: s.exists() }))
      .catch(() => setState({ email, ok: false }))
  }, [email])
  if (user === undefined) return undefined
  if (!email) return false
  return state.email === email ? state.ok : undefined
}

export function useNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
