import { clientSpans } from './ingest.js';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createTelemetry } from './telemetry.js';
import { validateEvents, rateLimiter } from './validation.js';

initializeApp();
const platformToken = defineSecret('DYNATRACE_PLATFORM_TOKEN');
const allow = rateLimiter();
let telemetry;
const allowedOrigins = new Set(['https://gmu.inspi.in', 'https://chaicloud-workshop.web.app', 'https://chaicloud-workshop.firebaseapp.com']);

export const telemetryIngest = onRequest({ region: 'asia-south1', secrets: [platformToken], cors: false, invoker: 'public', maxInstances: 2, concurrency: 40, timeoutSeconds: 30, memory: '256MiB' }, async (req, res) => {
  res.set('cache-control', 'no-store');
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) { res.status(403).end(); return; }
  if (!req.is('application/json') || (req.rawBody?.length ?? 0) > 65536) { res.status(413).end(); return; }
  const credential = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!credential) { res.status(401).end(); return; }
  let actor;
  try { actor = await getAuth().verifyIdToken(credential[1], true); }
  catch { res.status(401).end(); return; }
  if (actor.firebase?.sign_in_provider !== 'google.com' || !actor.email_verified || !actor.email) { res.status(403).end(); return; }
  if (!allow(actor.uid)) { res.status(429).end(); return; }
  let events;
  try { events = validateEvents(req.body); }
  catch { res.status(400).end(); return; }
  telemetry ||= createTelemetry('chaicart-live-telemetry', { endpoint: 'https://indiacs.live.dynatrace.com/api/v2/otlp', token: platformToken.value() });
  await telemetry.request(req, res, async () => {
    telemetry.enrich({ 'user.id': actor.uid, 'user.email': actor.email });
    const readable = clientSpans(telemetry, events, actor);
    const result = await telemetry.span('telemetry.export.browser_batch', { 'telemetry.batch.size': events.length }, () => new Promise(resolve => telemetry.exporter.export(readable, resolve)));
    telemetry.log(result.code === 0 ? 'INFO' : 'ERROR', 'Browser telemetry batch processed', { 'event.name': 'telemetry.batch.processed', 'telemetry.batch.size': events.length, 'telemetry.outcome': result.code === 0 ? 'success' : 'failure' });
    if (result.code !== 0) { res.status(503).json({ error: 'Telemetry export unavailable' }); return; }
    // Flush all signals before a serverless instance can be suspended. OTel does not
    // block the student's Firestore work, only this background telemetry request.
    res.status(202).json({ accepted: events.length });
  });
  await telemetry.flush();
});

export { workshopAction } from './workshop.js';

export { auditWorkshopSession, auditWorkshopRecords, auditStationHandoffs, deliverWorkshopBusinessEvent, retryWorkshopBusinessEvents } from './workshop-audit.js';
