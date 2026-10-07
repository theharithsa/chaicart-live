# Workshop business observability

Updated 7 October 2026. This covers ChaiCart Live; the static workshop pages and Azure demo retain their existing RUM and OTel instrumentation.

## How the signals work

1. Browser RUM captures control activation and form submission, authenticated identity changes, and successful joins, submissions and staff actions. Native `dynatrace.sendBizEvent()` sends client-observed events. Controls log their type and safe ID, never entered text.
2. Authenticated interactions also pass through the protected telemetry gateway as correlated OTel spans and logs with verified user identity. Anonymous visitors have RUM coverage; the OTel gateway requires sign-in.
3. Firestore triggers capture committed workshop changes independently of the browser. They create immutable, deterministic event IDs in `workshopTelemetry`.
4. A leased delivery worker sends CloudEvents to Dynatrace. A scheduled drain retries pending records every five minutes. Failed ingestion does not block scoring or student work.

Canonical events use `event.provider=chaicart-live`, `event.authority=server-confirmed`, and `event.source=firestore-commit`. Browser events use provider `chaicart-live-rum` and authority `client-observed`. Never add these two streams together to calculate points. RUM is best effort and depends on monitoring being available.

## Coverage

| Change | Canonical events / information |
|---|---|
| Session creation, edits, deletion | session.created, session.updated, session.deleted |
| Activity launch, phase, timer and closure | activity.launched, activity.ended, activity.state.changed, timer.changed |
| Student joins or profile changes | participant.joined, participant.updated, participant.removed; participant and team IDs |
| Quiz answers and grading | quiz.answer.submitted, answer.graded, answer.reversed, participant.score.updated; answer choice, correctness, credits |
| Captain and facilitator reviews | review changes, proposed credits, reviewer identity and role |
| Committed credit ledger | credits.awarded / credits.adjusted; signed delta, batch, team, actor and transaction |
| Team leaderboard | team score changes; these are score snapshots, not extra awards |
| Pre/post survey | stage, numerical c0–c9 confidence ratings and mean; post-survey NPS |
| Voting | chosen team and activity; revisions are separate events |
| Bingo, architecture, gallery and other submissions | submission.saved / bingo.claimed and review/ledger outcomes; no free-text body |
| Factory stations and handoffs | stage, ticket, reservation and handoff changes |
| Networking, social participation and staff | completion/availability, social entry changes and staff assignment |
| Closing | certificates.released/withdrawn, individual.award.recorded, workshop.completed/reopened |

The complete field extraction and event catalog are in `functions/business-events.js`. Other committed public workshop record changes produce a bounded `workshop.record.changed` event. Private answer keys and internal application markers are excluded. This is semantic activity coverage, not keystroke recording.

## Identity and correlation

Events carry a stable `event.id`, original `workshop.occurred_at`, session ID, document collection and change. Applicable events include participant, team, activity, transaction and authenticated actor identifiers. Backend actor email is resolved from Firebase Auth, rather than trusted from browser telemetry. Some system or deleted-user changes cannot resolve an email; they retain available identity and auth type without inventing a user.

OTel spans and logs share trace/span IDs within each operation. A Firestore commit is asynchronous: its audit trace is separate from the browser request trace. Session, actor, transaction, document and event IDs provide cross-flow correlation; this implementation does not claim one continuous trace across every Firebase SDK write.

Student names, team join codes, free-text survey feedback, submission bodies, social URLs, private answer keys and credentials are not exported. Numerical responses and actor emails are identifiable data. The workshop's consent and access restrictions must cover them.

## Delivery and operations

Backend service: `chaicart-live-audit`. Region: asia-south1. Functions: auditWorkshopSession, auditWorkshopRecords, auditStationHandoffs, deliverWorkshopBusinessEvent and retryWorkshopBusinessEvents. Existing telemetryIngest and workshopAction remain active.

BizEvents endpoint: `https://indiacs.live.dynatrace.com/api/v2/bizevents/ingest`. OTLP base: `https://indiacs.live.dynatrace.com/api/v2/otlp`. Credentials stay in Firebase secret `DYNATRACE_PLATFORM_TOKEN`; its historical name does not determine token type. Classic tokens use `Api-Token` and require `bizevents.ingest` plus the existing OTLP scopes. Platform tokens use Bearer and corresponding OpenPipeline scopes. Never place the secret in a browser build or Git.

Only HTTP 202 marks a BizEvent delivered. Pending records retain attempts, lastStatus, nextAttemptAt and leaseUntil. Transient failures back off; authentication/payload failures wait one hour. Inspect and repair repeated 400/401/403 errors rather than deleting pending records. Secret changes require redeploying all functions that bind the secret.

Capture is idempotent and workers use a lease. Delivery is at least once: an accepted request followed by a lost response can produce duplicates. Always deduplicate `event.id` before aggregating. Firestore changes may arrive out of order; use original occurrence time. Historical data before installation is not reconstructed.

Only facilitators can read the outbox through client rules; no client, including facilitators, can create or change it. Server delivery updates require administrative credentials. Outbox records survive session deletion. There is no automatic retention purge: agree a retention period and remove delivered records administratively after it; preserve pending records for recovery. Dynatrace retention is separately governed by tenant settings.

## Closing the class

After post-survey, awards, attendance checks and certificate release, choose **Console → Workshop → Mark workshop complete**. This locks activity submissions, clears the active activity and closes networking. Certificate release alone does not declare completion. Reopen workshop clears the completion marker; launch the desired activity separately.

## Investigation examples

These queries use the emitted schema. Validate them in your tenant before adding a production dashboard.

```dql
fetch bizevents, from: now()-24h
| filter event.provider == "chaicart-live" and event.authority == "server-confirmed"
| filter workshop.session.id == "YOUR_SESSION"
| dedup event.id
| summarize events=count(), by:{event.type}
```

For net awarded credits, aggregate only committed ledger deltas:

```dql
fetch bizevents, from: now()-24h
| filter event.provider == "chaicart-live"
| filter workshop.session.id == "YOUR_SESSION"
| filter event.name == "credits.awarded" or event.name == "credits.adjusted"
| dedup event.id
| summarize netCredits=sum(credits.delta), by:{workshop.team.id}
```

For survey comparisons, take the latest response per participant and stage before calculating a mean. For votes, take the latest choice per team and activity. Counting every revision inflates both results. Score snapshots, quiz grading and ledger deltas describe overlapping outcomes and must not be summed together.

```dql
fetch logs, from: now()-24h
| filter service.name == "chaicart-live-audit"
| filter workshop.session.id == "YOUR_SESSION"
| sort timestamp desc
```

## Verification

The automated checks cover native RUM API selection and safe fields; actual Firestore schemas and stable IDs; acceptance/failure HTTP statuses; duplicate capture, concurrent delivery, failed ingestion and expired-lease recovery; and facilitator-only read/server-only write rules. Use isolated test sessions for production verification. Check outbox status=delivered and lastStatus=202, then locate those event IDs in Dynatrace. An HTTP acceptance check alone does not prove a Grail query or dashboard has been verified.

References: [Dynatrace BizEvents API](https://docs.dynatrace.com/docs/dynatrace-api/environment-api/business-analytics-v2), [RUM business events](https://docs.dynatrace.com/docs/observe/business-observability/bo-events-capturing/web-and-mobile-rum), [Firestore events](https://firebase.google.com/docs/functions/firestore-events).

## Release verification — 7 October 2026

The replacement classic credential accepted the isolated BizEvents permission probe with HTTP202 and each OTLP signal with HTTP200. No token is recorded here.

Production session `OBS0710CHECK` generated nine delivered audit events. Session creation, actual student joining, numerical post-survey submission, a synthetic captain credit award, voting and workshop completion all reached HTTP202 on their first attempts. Source records were removed after verification. These checks used synthetic identities, not workshop participants. Filter out this session when building workshop reports. Dynatrace Grail searches and dashboard results have not been independently queried in this release.

Validation: application build, lint, seven RUM tests, seventeen backend tests and thirty-six emulator integration tests passed in GitHub CI. Four focused outbox tests additionally passed after adding delivery correlation fields.

| Review area | Check |
|---|---|
| Correctness | Actual submission, student, ledger and quiz-result schemas; completion distinct from certificate release |
| Reliability | Deterministic capture, delivery leases, retained failures and scheduled recovery |
| Security | Server-only outbox mutation; verified identity; token absent from browser and source |
| Privacy | Explicit field extraction; no free-text submissions, feedback or join codes |
| Performance | Bounded concurrency, batched retries, bounded metric dimensions |
| Maintainability | Pure event catalog, documented source/authority and isolated tests |
| Documentation | Completion steps, endpoint/scopes, retention, deduplication and verification limits |
