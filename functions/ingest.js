import { context, trace, TraceFlags } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
const hr = milliseconds => [Math.floor(milliseconds / 1000), Math.round(milliseconds % 1000 * 1e6)];
export function clientSpans(telemetry, events, actor) {
const resource = resourceFromAttributes({ 'service.name': 'chaicart-live-browser', 'service.namespace': 'chaicart', 'deployment.environment.name': 'workshop', 'telemetry.source': 'client-observed' });
    const readable = events.map(event => {
      const sc = { traceId: event.traceId, spanId: event.spanId, traceFlags: TraceFlags.SAMPLED };
      telemetry.current?.()?.addLink({ context: sc, attributes: { 'telemetry.source': 'client-observed' } });
      const attributes = { ...event.attributes, 'user.id': actor.uid, 'user.email': actor.email, 'telemetry.source': 'client-observed' };
      const seconds = (event.endedAt - event.startedAt) / 1000;
      const ctx = trace.setSpanContext(context.active(), sc);
      telemetry.log(event.status === 2 ? 'ERROR' : 'INFO', event.name + (event.status === 2 ? ' failed' : ' completed'), { ...attributes, 'event.name': event.name, duration_ms: seconds * 1000 }, ctx);
      telemetry.recordOperation(event.name, event.status === 2 ? 'failure' : 'success', seconds);
      return { name: event.name, kind: 2, spanContext: () => sc, parentSpanContext: event.parentSpanId ? { ...sc, spanId: event.parentSpanId } : undefined,
        startTime: hr(event.startedAt), endTime: hr(event.endedAt), duration: hr(event.endedAt - event.startedAt),
        attributes, status: { code: event.status }, events: [], links: [], resource, instrumentationScope: { name: 'chaicart.firestore', version: '1.0.0' },
        droppedAttributesCount: 0, droppedEventsCount: 0, droppedLinksCount: 0, ended: true };
    });

  return readable;
}
