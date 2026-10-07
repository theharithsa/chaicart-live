const HEX32 = /^[a-f0-9]{32}$/;
const HEX16 = /^[a-f0-9]{16}$/;
const NAMES = /^(firestore\.(document\.(read|write|update|delete|add)|query\.read|transaction(\.read)?|batch\.commit|listener\.(initial|error|recovered))|browser\.(error|interaction|form)|auth\.google|workshop\.(applyReview|manualAward|scoreCloud|undoCloud|deleteSession))$/;
const ATTRIBUTES = new Set(['ui.control', 'ui.control.id', 'page', 'transaction.id', 'db.system.name', 'db.operation.name', 'db.collection.name', 'workshop.session.id', 'workshop.team.id', 'workshop.activity.id', 'user.role', 'error.type']);

export function validateEvents(body, now = Date.now()) {
  if (!body || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 24) throw new Error('Invalid event batch');
  return body.events.map(event => {
    if (!event || !HEX32.test(event.traceId) || /^0+$/.test(event.traceId) || !HEX16.test(event.spanId) || /^0+$/.test(event.spanId) || !NAMES.test(event.name)) throw new Error('Invalid span');
    if (event.parentSpanId !== undefined && (!HEX16.test(event.parentSpanId) || /^0+$/.test(event.parentSpanId))) throw new Error('Invalid parent');
    if (![0, 1, 2].includes(event.status) || !Number.isFinite(event.startedAt) || !Number.isFinite(event.endedAt) || event.endedAt < event.startedAt || event.endedAt > now + 60000 || event.startedAt < now - 3600000 || event.endedAt - event.startedAt > 3600000) throw new Error('Invalid time');
    const attributes = {};
    for (const [key, value] of Object.entries(event.attributes || {})) {
      if (!ATTRIBUTES.has(key) || typeof value !== 'string' || value.length > 100 || /[\r\n\x00]/.test(value)) continue;
      if (key === 'transaction.id' && !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('Invalid transaction');
      attributes[key] = value;
    }
    return { traceId: event.traceId, spanId: event.spanId, parentSpanId: event.parentSpanId, name: event.name, startedAt: event.startedAt, endedAt: event.endedAt, status: event.status, attributes };
  });
}

export function rateLimiter(maximum = 120, windowMs = 60000, maxKeys = 2000) {
  const buckets = new Map();
  return (key, now = Date.now()) => {
    for (const [id, bucket] of buckets) if (now - bucket.start >= windowMs) buckets.delete(id);
    const bucket = buckets.get(key) || { start: now, count: 0 };
    if (!buckets.has(key) && buckets.size >= maxKeys) return false;
    bucket.count++; buckets.set(key, bucket);
    return bucket.count <= maximum;
  };
}
