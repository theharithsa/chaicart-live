# Implementation status

Implemented as the paperless release. See [release checks](RELEASE-CHECKS.md) for verification and remaining venue/OAuth rehearsal. The planning audit below is retained as design context.

# ChaiCart Live: paperless workshop implementation plan

Status: proposed, source audit completed 4 October 2026. No app behavior or production Firebase changes made.

## Goal and boundaries

Make ChaiCart Live the phone-friendly home for students and region captains across both workshop days: Google sign-in, team onboarding, activities, worksheets, scoring, judging, resources and certificates. Keep the Azure ChaiCart ordering/fault demo separate; link to it from Live. Live remains hosted on Firebase.

Paperless means no printed handouts, table cards, worksheets, posters or score sheets. Physical demonstrations can still use people and props. User decision: replace Paper Plane Factory with a fully digital delivery game. Retain Human Kitchen and Follow the Order as people-based demonstrations with phone instructions and digital tokens; no printed station cards or order tickets.

Sources: the current private repo (local HEAD matches origin/main), workshop-reference facilitator-guide.html, both slide decks, cards.html, gallery-posters.html, team-sheet-and-surveys.html, treasure-hunt.html and the deployed demo runbook. Facilitator guide supplies the scoring baseline; reconcile conflicts explicitly before release.

## Findings to address first

- Students currently use anonymous Firebase accounts in Join, Play and Certificate. Returning on a different device does not recover the same student identity.
- All entries in admins/{email} have full admin access; the role field is ignored. Captains can change every region, launch activities and access all private submissions.
- Student documents can be read by any signed-in user. Private surveys and personal plans should be owner-only; roster data needs a separate limited view.
- Teams and roles are self-selected; there is no enforced five-person capacity or unique role assignment.
- Any team member can overwrite a team form; later saves silently win. Plan a designated submitter and controlled handover.
- Firestore submission rules do not fully validate activity-specific payloads, numeric bounds or allowed scope. UI validation is insufficient.
- applyCredits writes an applied marker but does not read/check it inside the transaction. Concurrent reveals can award twice. Undo deletes ledger entries and has no scoped authorization or durable correction trail.
- Hook failures appear as missing data or empty lists, hiding permission and connection errors.
- Answer keys are in a downloadable console bundle. Put unrevealed answers in protected Firestore documents, and publish only released answers.
- Only one currentActivity may accept submissions. An all-day X challenge and persistent team workspace need independent availability windows.
- Slide references are stale. Guess the Downtime is currently an individual multiple-choice quiz worth 5, whereas the guide uses team numeric guesses and +20 for the closest per region. Recap scoring currently averages individual accuracy into team credits; the guide uses one team answer sheet at +10 per correct answer.
- Architecture is just a checklist following a paper drawing. Treasure Hunt only collects a self-marked total, not worksheet answers/proof.
- Certificates are available before completion and use the viewing date rather than workshop date. No award registry exists.
- Dependencies are not installed in this checkout: baseline build/lint attempts cannot run (tsc and oxlint missing). Install locked dependencies during implementation, then establish the baseline.

## Proposed student experience

1. Scan the session QR or enter its code; sign in with Google; select certificate name, semester and branch.
2. Join a team using a facilitator-issued team code/QR, then claim an available role. Show capacity and prevent accidental team changes after activities begin. A captain can resolve mistakes.
3. Home offers Today’s agenda, Live activity, Team workspace, Networking challenge, Resources and My progress. Launching an activity highlights it without erasing a draft elsewhere.
4. Team workspace holds roster/role descriptions, architecture, submissions, credit history and captain feedback. One designated submitter (COO by default) submits scored team answers; handover is explicit.
5. Show Draft, Pending sync, Submitted, Locked and Reviewed distinctly. Preserve drafts across refresh; never imply an offline attempt was accepted before the server confirms it.
6. Download personal workshop notes, 90-day plan and issued certificate. Public leaderboard/projector exposes teams and scores, not emails or private survey responses.

Google login must include cancellation/error handling, mobile-browser testing and return-to-session behavior. Upgrade an existing anonymous identity by linking Google where possible, preserving its UID. If the Google account already owns another UID, stop and use a controlled migration workflow; never merge by student name. Existing anonymous sessions remain intact until migration/export is verified. See Firebase account-linking and Google sign-in documentation.

## Activity coverage

| Activity/material | Current state | Planned paperless replacement |
|---|---|---|
| Agenda, table cards, roles | Partial join form | Both daily agendas; team codes, roster and role cards |
| LinkedIn / GitHub / X | Missing | Profile links/QRs, per-student completion, captain approval, +100/team/activity once, maximum +300 |
| All-day X award | Missing | #ChaiCartCloudWorkshop instructions, one best-post URL per entrant, captain shortlist, facilitator selects one individual winner; no extra team credits |
| Human Timeline | Manual score only | Team reorderable cards with move buttons, final submit, server-confirmed timestamp; captain validates first correct per region +50 |
| Service Model Sort | Manual score only | Assign each card to IaaS/PaaS/SaaS; reveal and score +5/correct, max100 |
| Deployment debate | Team form exists | Retain scenario/defence; captain judges +30; correct slide mapping |
| Shark Tank | Region vote exists | Add pitch brief, regional finalist workflow and facilitator grand-winner +100 |
| Cloud Bingo | Missing | Team digital board, facilitator called-term list, claim timestamp, validated first three +30 |
| Architecture Lego | Checklist only | Mobile component/connection editor, region/zone choices and rationale; frozen approved design feeds Day2 games; +50 regional/+100 overall |
| Human Kitchen | Missing | Volunteer station cards, digital order tickets and per-station event times; chaos/fix rounds and +20 per volunteer team |
| Gallery Walk | Missing | Case-study carousel with group rotations, team feedback notes and facilitator choice of four +50 notes |
| Recap quizzes | Individual quiz exists | Individual learning results plus one locked team answer per question for +10/correct; synchronize guide/slides with this rule |
| Guess the Downtime | Different game/scoring | Team numeric estimates; closest per row per region +20, define ties before launch |
| Murder mystery | Evidence/accusations exist | Preserve exhibits/hints/final accusation; protect solution, validate finality and timestamp; captain review and first-correct bonus |
| Treasure Hunt | Total only | Full question-by-question worksheet, DQL/KQL copy buttons, answer/proof text or links, reflection; captain-reviewed score up to150 |
| Error Budget Poker | Exists | Audit card order/outcomes versus print deck; authoritative recorded rolls, immutable choices, frozen architecture dependencies |
| Postmortem | Form exists | Structured action items with owner/due date; region +40/overall +75 judging |
| Paper Plane Factory → Digital Delivery Factory | Physical game with results form | Two-round digital delivery pipeline: sequential work then parallel team roles; record lead time, throughput, failed releases and recovery; captain confirms regional +50 winner |
| Bill Shock | Exists | Audit deal/control/refund rules; frozen architecture proof and captain approval of exceptions |
| Follow the Order | Missing | Seven station roles, digital order token/handoffs, state/timestamp trail and outage/recovery rounds |
| Career Tarot / cheat sheet | Missing | Career cards, searchable workshop reference and personal90-day plan |
| Surveys / feedback | Forms exist | Complete omitted feedback fields; owner-private responses and facilitator aggregates/exports |
| Demo Day / awards / certificates | Partial vote and certificate | Finalists, judging, award registry including X, workshop dates and facilitator-issued downloadable certificates |

Social follows are student-declared and captain-confirmed; do not collect passwords or attempt platform API verification. Posting is optional. Ask permission before sharing someone’s photo. Store X post links rather than uploading images in the first release.

## Captain and facilitator experience

Captain route: assigned session and region, six-team roster, outstanding submissions, activity rubrics/answer keys when appropriate, completion approvals, scoped awards, evidence reviews, feedback and region finalists. Captains cannot launch global activities, edit another region or create sessions. Scorekeeper, if needed, receives a distinct role.

Facilitator route: session setup, team/role correction, captain region assignments, activity windows/lock/reveal/timers, overall judging, projector, immutable credit audit, corrections, exports and certificate issue/close. Include digital captain briefing and preflight checklist.

Use per-session staff assignments under the existing facilitator allowlist; do not repurpose the demo’s admin allowlist or loosen it. The two apps share a Firebase project, so rules deployment must preserve existing admins and every unrelated collection policy.

## Data and integrity approach

Keep existing session IDs and activity IDs where possible. Add schema/workshop version and date, session staff, team membership/role reservations, team workspaces, per-activity availability, networking completion, X entries, awards and certificates. Separate private identity/contact/survey data from team-visible roster and released responses.

Use atomic membership/role allocation. Scoring uses deterministic per-team/per-activity keys checked within the same transaction as credits, plus actor, reason and source submission revision. Corrections append a compensating entry; concurrent double-clicks/undo must be safe. Final submissions and judge decisions require server timestamps. Dice cannot be student-supplied arbitrary values: staff issues and records rolls, or add a trusted backend if fully automatic randomness is required.

Start with Firebase Auth + Firestore + Hosting and staff-authorized scoring. No need to move Live to Azure. A trusted backend is an explicit later choice for automatic authoritative marking/randomness. Measure actual read/write load; do not retain the current unverified claim that the entire expanded workshop fits Spark quotas.

## Implementation sequence and acceptance gates

1. Establish baseline, versioned content/scoring manifest and data backup/export. Add Google student login, safe anonymous migration, membership allocation and scoped staff rules. Emulator tests must deny spoofing, cross-region writes and private-data reads.
2. Add the persistent student/team hub, captain dashboard, error/sync states and transaction-safe credit ledger. Concurrent award attempts yield one credit change; corrections preserve history.
3. Build missing Day1 activities and digital architecture. All participants can complete them on a phone without handouts; no chart-paper proof remains in Day2 rules.
4. Complete Day2 worksheets/station games, all-day networking/X, judging and certificate issuance. Starting another activity does not close the X challenge or lose workspace drafts.
5. Rehearse a full two-day session with facilitator, captains and student accounts; test 120 participants/24 teams, mobile widths, keyboard controls, reconnects, refreshes, duplicate submissions, account collisions and concurrent scoring. No email/private responses on projector.
6. Deploy first to a Firebase Hosting preview with test-session data; check rule changes against the existing demo; then publish production. Update README, decks and facilitator/captain notes together so no required printing remains.

For a Wi-Fi outage, pause scored submissions and keep projector/physical discussion running; cached drafts do not guarantee real-time scoring. A paperless workshop needs tested venue connectivity and a fallback hotspot.

## Digital Delivery Factory design

Confirmed replacement for Paper Plane Factory. Keep its workshop time slot and update the Day2 slides, captain briefing and scoring references.

- Each team builds virtual ChaiCart release tickets through Plan → Build → Test → Deploy. Accessible buttons replace drag-only interactions.
- Round1 uses a sequential process with a single active worker. Round2 assigns pipeline stages across teammates, allowing several tickets in flight and a visible work-in-progress limit.
- Each ticket carries requirements and a small test/check task. Invalid releases fail; the team diagnoses and fixes them, recording recovery time. Use the same workload and difficulty for each team/round.
- Server-confirmed transitions record start/deploy/failure/recovery timestamps. Show completed successful releases, lead time, deployment frequency, change failure rate and recovery time after both rounds.
- Regional +50 goes to the most successful Round2 releases; break ties by fewer failed releases, then lower median lead time. Keep learning measures separate from the winning score.
- Staff controls round start/stop; the app validates legal stage transitions and task completion. No client-supplied scores or elapsed times. Interrupted connections flag results for captain review rather than silently penalizing a team.
- Acceptance: five teammates can operate on phones; no printing or physical paper needed; compare both rounds on projector and connect the result to the DORA lesson.

## References

- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/account-linking
- https://firebase.google.com/docs/firestore/manage-data/enable-offline
