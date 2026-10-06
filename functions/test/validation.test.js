import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEvents, rateLimiter } from '../validation.js';
import { clientSpans } from '../ingest.js';

const now = Date.now();
const event = { traceId: '1234567890abcdef1234567890abcdef', spanId: '1234567890abcdef', name: 'firestore.document.write', startedAt: now - 100, endedAt: now, status: 0, attributes: { 'transaction.id': '12345678-1234-1234-1234-123456789abc' } };
test('rejects oversized batches, forged span names, invalid IDs and invalid durations', () => {
  for (const events of [Array(25).fill(event), [{ ...event, name: 'run arbitrary work' }], [{ ...event, traceId: '0'.repeat(32) }], [{ ...event, endedAt: now + 120000 }], [{ ...event, startedAt: now + 1 }]]) assert.throws(() => validateEvents({ events }, now));
});
test('drops arbitrary attributes, credentials, identity spoofing and form content', () => {
  const [clean] = validateEvents({ events: [{ ...event, attributes: { 'user.email': 'forged@example.com', authorization: 'secret', answer: 'private', 'db.collection.name': 'submissions' } }] }, now);
  assert.deepEqual(clean.attributes, { 'db.collection.name': 'submissions' });
});
test('rate limiter bounds per-user requests and total key storage, and recovers', () => {
  const allow = rateLimiter(2, 1000, 2);
  assert.equal(allow('a', 100), true); assert.equal(allow('a', 200), true); assert.equal(allow('a', 300), false);
  assert.equal(allow('b', 400), true); assert.equal(allow('c', 500), false); assert.equal(allow('c', 1101), true);
});
test('imported client spans and logs use verified identity and matching trace context', () => {
  const records = [];
  const telemetry = { log: (...args) => records.push(args), recordOperation() {} };
  const [span] = clientSpans(telemetry, validateEvents({ events: [event] }, now), { uid: 'verified', email: 'verified@example.test' });
  assert.equal(span.attributes['user.email'], 'verified@example.test'); assert.equal(span.spanContext().traceId, event.traceId);
  assert.equal(records[0][2]['transaction.id'], event.attributes['transaction.id']);
  assert.equal(span.resource.attributes['service.name'], 'chaicart-live-browser');
});

test('workshop actions are exported but arbitrary workshop operations remain blocked', () => {
  assert.equal(validateEvents({ events: [{ ...event, name: 'workshop.applyReview' }] }, now)[0].name, 'workshop.applyReview');
  assert.throws(() => validateEvents({ events: [{ ...event, name: 'workshop.grantAdmin' }] }, now));
});
