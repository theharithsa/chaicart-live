# ChaiCart Live

The paperless student and captain app for the [ChaiCart Cloud Workshop](https://theharithsa.github.io/chaicart-cloud-workshop/). Hosted at [chaicloud-workshop.web.app](https://chaicloud-workshop.web.app/). The [Azure ordering/fault demo](https://chaicart-workshop-vh-20261003.azurewebsites.net/) remains a separate app, linked from student Resources.

## Student flow

1. Scan the projector QR or enter the session code.
2. **Sign in with Google**. Use your captain’s team code; choose semester, branch, certificate name and an available role. Five roles reserve five places atomically.
3. **Live activity** follows the facilitator. The **COO** submits scored team answers; teammates discuss and can view the saved answer. Individual surveys, plans and polls remain individual.
4. **My workshop** contains both agendas, roster, submissions, captain feedback, credit history, networking and resources. Drafts stay on the device through refresh. “Pending server confirmation” is not a successful submission.
5. Networking: LinkedIn in Day1 opening, GitHub after lunch, X launched Day2 and continuing all day. Each completed team activity receives +100 once after captain approval; maximum +300. Existing accounts/connections count.
6. Optional X posts/photos use **#ChaiCartCloudWorkshop**. Ask permission before sharing someone’s photo. Submit your best post link before closing. Captains shortlist; facilitator awards one individual for learning value, creativity and workshop spirit, not likes. No extra team credits.
7. Download notes and the personal90-day plan. Certificates appear after the facilitator issues them and use the workshop date.

## Paperless activities

| Day1 | Day2 |
|---|---|
| Pre-survey and Cloud or Not? poll | Guess the Downtime: team numeric estimates |
| Timeline ordering; first correct in each region | Murder mystery evidence, hints and final accusation |
| Service model classification; +5/correct | Full Treasure Hunt worksheet with proof and query copying |
| Deployment debate and Shark Tank pitch/vote | Error Budget Poker with immutable staff-issued rolls |
| Digital Bingo with facilitator-called terms | Postmortem and captain judging |
| Digital architecture: components, flow and rationale | **Digital Delivery Factory** replaces paper planes |
| Human Kitchen station cards and timed order handoffs | Bill Shock using the frozen architecture |
| Gallery case studies and feedback notes | Follow the Order station cards/tokens |
| Team recap quiz: +10 per correct team answer | Career cards, 90-day plan, team quiz, Demo Day vote and feedback |

Architecture is reviewed and frozen before Day2 games. No chart-paper proof is needed. Human Kitchen and Follow the Order retain people-based demonstrations with digital station cards/tickets. Digital Delivery Factory uses six virtual releases: a three-minute sequential COO round, then a three-minute pipeline with CEO Plan, CTO Build, SRE Test and COO Deploy. Metrics are teaching proxies for DORA; failed tests are not literally production incidents. Regional winner: most successful round2 releases, fewer failures, then lower median lead time; +50.

## Facilitator and captain flow

- `#/console`: Google sign-in restricted to facilitator allowlist. Setup creates a session, its team codes and protected key copies. Set the workshop date; assign captain Google emails to regions.
- Share each team’s code from **Workshop** and share `#/captain?s=SESSION` with captains.
- `#/captain`: assigned region’s team join codes with copy buttons and role counts, scoped six-team roster, responses, rubrics, networking approvals, feedback and X shortlists. Captains propose credits; they cannot change global activities or another region’s credits.
- **Run** launches/locks/reveals activities and timers. **Workshop** applies captain approvals once, freezes architectures, calls Bingo clues, assigns station volunteers, starts/stops Factory rounds, records awards and issues certificates.
- Bingo awards are capped at three teams, Gallery at four, and Timeline at one winner per region. Confirm submission timestamps when selecting first-place awards.
- Poker: issue staff rolls for each card before students choose. Rolls and frozen architecture documents cannot be overwritten through the client.
- **Leaderboard** provides exceptional manual adjustments and correction of the latest uncorrected batch. Corrections append compensating ledger entries; previous records remain.
- `#/screen?s=SESSION`: projector join QR, leaderboard, activity totals, released answers and hints. Personal emails and private responses are not displayed.
- Export students/form responses in the console after the workshop. Retain only what you need; Firebase console deletion is a separate deliberate cleanup step.

## Setup and local development

Node24 recommended. Firebase Google sign-in must be enabled and your hosting/local domain authorized. Copy `.env.example` to `.env.local` and enter the Firebase **public web configuration**, not a service-account credential.

```sh
npm ci
npm run dev
npm run build
npm run lint
```

Facilitators are existing `admins/{Google email}` documents with `role: "facilitator"` (legacy documents without a role remain facilitator entries). Captains are **per-session** `sessions/{id}/staff/{email}` records created by the facilitator in Setup; do not add new captains as global admins.

Answer keys are seed-only source in `src/admin/keys.ts` and `scripts/activity-keys.json`. Browser code imports only types; no unrevealed quiz/mystery key is shipped in the production bundles. The authenticated seed script writes protected Firestore content and initializes legacy teams without replacing responses or credits.

```sh
npx firebase-tools login
# FIREBASE_TOOLS_LIB points to the installed firebase-tools/lib directory.
FIREBASE_TOOLS_LIB=/path/to/firebase-tools/lib node scripts/firebase-rest.mjs backup-rules
FIREBASE_TOOLS_LIB=/path/to/firebase-tools/lib node scripts/seed-workshop.mjs
```

The script backs up session/roster data locally in `/tmp` and reports legacy role collisions for facilitator review. Never commit those backups or credentials. Run this when importing existing sessions or refreshing answer keys. Newly created sessions copy the protected global content automatically.

## Rules testing and release

Firestore rules enforce Google identity, team scope, COO submissions, current activity/question, payload schemas, immutable final answers, timestamps, captain regions, factory transitions and station handoffs. Emails and private surveys/plans are not in team-visible documents.

Java21 is needed by the Firestore emulator:

```sh
npx firebase-tools emulators:exec --project demo-chaicart --only firestore "node --test test/rules.test.mjs"
npm run build
npx firebase-tools hosting:channel:deploy paperless-review --project chaicloud-workshop
npx firebase-tools deploy --only firestore:rules,firestore:indexes,hosting --project chaicloud-workshop
```

Preview Hosting uses the configured Firebase backend; it does not create a separate rules environment. Emulator tests use a demo project and never touch production. CI runs build, lint and the rule/integration suite, including 120 Google student identities joining24 teams and competing credit transactions.

The rules live in a project shared with the Azure demo. They preserve `/admins` reads and do not affect the Admin SDK’s IAM access. Back up the current release before deploying; restore that source with Firebase CLI if rollback is needed. Keep the previous Hosting release available for rollback too.

## Existing anonymous students

Google sign-in links an anonymous account in place, keeping its UID/profile/responses. If that Google account already belongs to another UID, the app stops rather than discarding data. A facilitator must export and migrate the existing record deliberately. No automatic name/email-based merging occurs.

## Connectivity and limits

Venue Wi-Fi and a fallback hotspot are needed for live scoring. Cached data/drafts help through short interruptions; role reservations and score transactions require a connection. Do not treat pending offline writes as accepted final answers. First Google sign-in also needs internet. The app does not promise a fully offline workshop.

Firebase Auth + Firestore + Hosting; no Cloud Functions or photo uploads are introduced. X entries store public post links. Keep listeners scoped, monitor reads/writes during rehearsal, and confirm actual quotas rather than assuming the expanded workshop fits a free tier.

See [the plan and audit](docs/PAPERLESS-APP-PLAN.md) and [release checks](docs/RELEASE-CHECKS.md).


## Dynatrace RUM and OpenTelemetry

The shared workshop RUM tag is installed in `index.html`. Google sign-in restoration, account changes and sign-out update `dtrum.identifyUser(email)` (cleared on sign-out). The callback is optional and cannot block authentication. Captured errors use sanitized operation/error codes, not form contents.

`src/lib/firestore.ts` wraps the existing Firebase SDK calls with browser OTel spans. Reads inside a transaction share the parent transaction's trace and transaction ID. Finite listener spans measure initial load, errors and recovery. The wrappers do not change data, rules or scoring. Import instrumented calls from this module when adding new application operations.

The protected gateway source is in `functions/`. It verifies Google Firebase ID tokens, derives UID/email from the verified token, bounds request size/timestamps/rate, and exports OTLP/HTTP protobuf. Client reports are diagnostic observations, not authoritative audit records. Internal Firestore processing is outside our instrumentation. The Dynatrace token is server-only; never put it in `VITE_*` configuration.

### Optional RUM-only deployment

```sh
npm ci
npm run build
npx firebase-tools deploy --project chaicloud-workshop --only hosting --config firebase.rum-only.json
```

Browser OTel forwarding is disabled unless `VITE_TELEMETRY_ENABLED=true`. RUM remains active independently. This configuration does not require Firebase Blaze or a Function and does not send background requests to an unavailable gateway.

### Activate the Firebase gateway

Firebase Functions requires Blaze billing. Once enabled:

```sh
npm ci --prefix functions
npm test --prefix functions
npx firebase-tools functions:secrets:set DYNATRACE_PLATFORM_TOKEN --project chaicloud-workshop
VITE_TELEMETRY_ENABLED=true npm run build
npx firebase-tools deploy --project chaicloud-workshop --only functions:telemetry,hosting
```

Enter the platform token only at the secret prompt. Both the token scopes and its owning user's permissions must allow `openpipeline:logs:ingest`, `openpipeline:metrics:ingest` and `openpipeline:traces:ingest`. The gateway uses `https://indiacs.live.dynatrace.com/api/v2/otlp`, Bearer authentication, delta metrics and bounded exporters. Its hosting rewrite keeps the endpoint same-origin for RUM correlation.

If Firebase billing remains disabled, the same validated gateway can run on the existing Azure App Service after configuring an explicit endpoint, origin allowlist and Dynatrace cross-origin trace propagation. Do not enable browser forwarding until its gateway is verified.

See the [workshop observability runbook](https://github.com/theharithsa/chaicart-cloud-workshop/blob/main/chaicart-demo/docs/OBSERVABILITY.md) for fields, metrics, investigation queries and demonstrations. Ingestion permission does not grant dashboard or Grail query access.

### Deployed telemetry gateway

The `telemetryIngest` Node.js 22 Function is deployed in `asia-south1`, with Firebase Hosting forwarding `/api/telemetry` to it. The ingestion credential is stored in Secret Manager. Production browser forwarding is enabled by building with `VITE_TELEMETRY_ENABLED=true`; use that flag for subsequent production builds. Gateway requests require a verified Google Firebase identity.

Dynatrace uses OTLP/HTTP binary protobuf at `https://indiacs.live.dynatrace.com/api/v2/otlp/v1/{traces,metrics,logs}` with a server-only classic `Api-Token` credential (platform tokens use `Bearer`). The direct endpoint does not support gRPC. A 403 reporting a missing `openpipeline:*:ingest` permission requires fixing both token scopes and the token owner permissions, rather than changing the endpoint.

The production gateway uses a classic token. The existing secret name `DYNATRACE_PLATFORM_TOKEN` is retained for compatibility; the exporter selects `Api-Token` for classic `dt0c01` tokens. Required classic scopes are `openTelemetryTrace.ingest`, `metrics.ingest`, and `logs.ingest`.
