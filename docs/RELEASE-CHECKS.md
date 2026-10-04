# Paperless release checks

## Automated evidence

- Production TypeScript/Vite build and targeted Oxlint checks.
- 21 passing Firestore emulator tests: authenticated membership and 120 simulated Google identities across 24 teams, regional captain isolation, individual-response privacy, payload validation, locked quiz/timeline answers, immutable scoring with duplicate protection and compensating undo, frozen designs, staff-issued rolls, legal factory transitions and assigned station handoffs, and captain X shortlisting.
- The 120-identity run tests emulator transactions, not venue Wi-Fi or real Google OAuth throughput.
- Dependency audit: zero known vulnerabilities after updating the transitive gRPC dependency.
- Previous production rules and existing session data backed up outside Git before migration. Existing answers and credits retained; legacy submissions gain a scope field.

## Before students arrive

1. Rehearse Google sign-in with a student, four captains and a facilitator on the actual phones/browsers. Allow authentication popups. A browser preview may not support the OAuth popup.
2. Set the session workshop date, verify 24 team codes and five distinct roles per team. Review any legacy role collisions; do not overwrite them silently.
3. Run each activity once in a separate rehearsal session. Confirm private surveys cannot be opened by a teammate or captain.
4. Freeze approved Day 1 designs. Rehearse mystery scoring, staff rolls, factory rounds and digital station volunteers.
5. Confirm Dynatrace access and instrumented demo evidence before presenting telemetry. This release does not add OTel instrumentation to the Azure app.
6. Verify the composite Firestore index is ready. Check connection/error banners and venue Wi-Fi with the expected attendance.
7. Record individual awards, verify attendance, then release certificates. Workshop certificate date comes from the session.

## Operational limits

Captains review human judgement activities; they do not automatically select a regional winner. The facilitator approves reviews and exceptional bonuses. Factory measurements are teaching proxies, not production DORA reporting. X posting is optional and photo permission is required. No offline submission guarantee is made; preserve drafts and pause scoring during an outage.

Legacy anonymous users can link Google without changing their UID. If a Google account already owns another identity, linking stops without discarding progress; a facilitator must reconcile the records deliberately before retrying. Keep session exports private.
