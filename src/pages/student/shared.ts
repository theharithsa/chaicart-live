import type { SessionDoc, Student } from '../../types'

export interface StudentProps {
  sid: string
  uid: string
  student: Student
  session: SessionDoc
}

export const LETTERS = 'ABCDEFGH'

export function fmtTime(ts: unknown) {
  const t = ts as { toDate?: () => Date } | undefined
  return t?.toDate ? t.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
}

export function randomDie() {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return (a[0] % 6) + 1
}
