# ChaiCart Live

The paperless student and captain app for the [ChaiCart Cloud Workshop](https://theharithsa.github.io/chaicart-cloud-workshop/). Hosted at [chaicloud-workshop.web.app](https://chaicloud-workshop.web.app/). The [Azure ordering/fault demo](https://chaicart-workshop-vh-20261003.azurewebsites.net/) remains a separate app, linked from student Resources.

## Student flow

1. Scan the projector QR or enter the session code.
2. **Sign in with Google**. Use your captain’s team code; choose semester, branch, certificate name and an available role. Five roles reserve five places atomically.
3. **Live activity** follows the facilitator. The **COO** submits scored team answers; teammates discuss and can view the saved answer. Cloud or Not is an individual quiz: +100 per correct participant, added to the team total. Surveys and plans remain individual.
4. **My workshop** contains both agendas, roster, submissions, captain feedback, credit history, networking and resources. Drafts stay on the device through refresh. “Pending server confirmation” is not a successful submission.
5. Networking: LinkedIn in Day1 opening, GitHub after lunch, X launched Day2 and continuing all day. Each completed team activity receives +100 once after captain approval; maximum +300. Existing accounts/connections count.
6. Optional X posts/photos use **#ChaiCartCloudWorkshop**. Ask permission before sharing someone’s photo. Submit your best post link before closing. Captains shortlist; facilitator awards one individual for learning value, creativity and workshop spirit, not likes. No extra team credits.
7. Download notes and the personal90-day plan. Certificates appear after the facilitator issues them and use the workshop date.

## Paperless activities

| Day1 | Day2 |
|---|---|
| Pre-survey and Cloud or Not? individual quiz (+100 per correct answer) | Guess the Downtime: team numeric estimates |
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
- `#/captain`: assigned region’s team join codes with copy buttons and role counts, scoped six-team roster, responses, rubrics, networking approvals, feedback and X shortlists. Captains can apply reviewed awards once and enter reasoned bonuses/corrections for any activity within their region. They cannot change global activities or another region’s credits.
- **Run** launches/locks/reveals activities and timers. **Workshop** lets facilitators apply captain approvals once, freezes architectures, calls Bingo clues, assigns station volunteers, starts/stops Factory rounds, records awards and issues certificates.
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
npx firebase-tools emulators:exec --project demo-chaicart --only firestore "node --test --test-concurrency=1 test/rules.test.mjs test/workshop-actions.test.mjs"
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

Firebase Auth + Firestore + Hosting, with a Cloud Function for protected telemetry forwarding; no photo uploads are introduced. X entries store public post links. Keep listeners scoped, monitor reads/writes during rehearsal, and confirm actual quotas rather than assuming the expanded workshop fits a free tier.

See [the plan and audit](docs/PAPERLESS-APP-PLAN.md) and [release checks](docs/RELEASE-CHECKS.md).


## Dynatrace RUM and OpenTelemetry

See [observability.md](observability.md) for the complete runbook covering Live, the Azure Demo and the GitHub Pages workshop. It includes deployed resources, RUM tags, browser/email identity, protected gateway setup, classic/platform authentication, correlation, metrics, demonstration steps and recovery instructions.

Production browser builds require `VITE_TELEMETRY_ENABLED=true`. The telemetry gateway is deployed on Firebase Blaze; its Dynatrace credential stays in Secret Manager. Signed-out RUM visitors use a persistent random browser ID and signed-in visitors use their Google email. Browser reports measure Firebase SDK operations, not Firestore internal server processing.

## Scoring and session management

- Cloud or Not uses individual answers at 100 credits each. **Reveal and score** locks the question, stores each participant’s result, and atomically adds earned points to team totals. Repeated reveals do not duplicate credits. **Undo this question** reverses personal and team credits together; revealing again re-scores the saved answers. Existing unscored answers remain available and are scored explicitly, never by a migration.
- **Students → View submitted work** shows saved answers with question/option labels and personal Cloud or Not results. Captains can open the same details for their own region.
- Incorrect Human Timeline answers can be approved with feedback at **zero** credits; the +50 correct-order winner rubric remains unchanged.
- **Captain dashboard → team → review activity → Approve for facilitator → Award reviewed credits to team** applies an approved award. This covers Architecture, Gallery, Bingo and all review rubrics. For other activities/bonuses/corrections, use **Award or correct credits for any activity** with a reason. Facilitators retain these controls. Automatic quiz points should not be manually repeated.
- Captain awards go through the authenticated `workshopAction` Cloud Function, rather than broad client write permissions. Region checks, transaction markers and Bingo/Gallery/Timeline award limits are enforced on the server. Ledger entries retain the actor and role; the leaderboard updates immediately.
- The **Run → Screen: Leaderboard** control updates the projector and opens the leaderboard inside Run. It does not launch or change the selected activity.
- **Setup → Sessions → Delete** requires typing the exact session code. The server locks participation, then recursively deletes all nested records. Failure is visible and can be retried. Test deletion only with disposable rehearsal sessions; there is no restore button.

Deploy the backend **before** the frontend: `npx firebase-tools deploy --project chaicloud-workshop --only functions:telemetry:workshopAction,functions:telemetry:telemetryIngest,firestore:rules,hosting`. The new callable uses the existing Dynatrace secret and requires the Firebase runtime service account to have Firestore access, as the telemetry codebase’s default runtime normally does. No ingestion token is shipped to the browser.
