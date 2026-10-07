# Workshop rehearsal and test cases

This rehearsal uses the isolated `demo-chaicart` Firebase Auth, Firestore and Functions emulators. Synthetic Google identities and local telemetry collectors never modify workshop sessions or send rehearsal data to Dynatrace.

## Run it

Use Node 24 and Java 21. Install root and Functions dependencies, then install Playwright Chromium (`npx playwright install --with-deps chromium` on Linux). Run `npm run test:rehearsal`. Locally, the browser configuration uses installed Chrome; CI uses Chromium. Run `npm run test:rules` separately for permission and concurrency cases. Browser failure screenshots and traces are in `test-results/`; the HTML report is in `playwright-report/`.

The runner forces the emulator project and creates a temporary placeholder secret only when no local secret exists. The emulated exporters use a local collector. Production authorization is unchanged: anonymous users cannot participate or enter staff consoles.

## Browser cases

| Case | Actions and expected results |
|---|---|
| Session setup | Invalid and duplicate codes recover; create 24 team codes and opening balances. |
| Authentication | Anonymous users see Google sign-in; ordinary students cannot enter facilitator/captain consoles. |
| Joining | Incorrect team code rejected; correct code reserves a role; roster persists after reload. |
| Launch coverage | Launch all 24 live activities through the facilitator UI; student mobile viewport and facilitator views render without page errors. |
| Written activities | All eight form activities validate, save and reappear in student work. |
| Quizzes | Answer all 28 questions; facilitator reveals/advances; correct answers earn 100 credits, incorrect answers earn zero; participant results and team sums agree. |
| Studio | Timeline mouse dragging and keyboard reordering; service-model cards; architecture completeness validation; gallery work persists. |
| Votes | Both voting activities exclude own team; revised vote replaces the earlier selection; locked voting disables submission. |
| Captain awards | Team codes visible; incorrect timeline can be reviewed for zero credits; architecture, gallery, treasure, postmortem and downtime awards apply once. |
| Networking | Three completion steps persist without replacing earlier steps; invalid X links rejected; valid links and resources work. |
| Factory round 1 | Release and complete the full station pipeline. |
| Bingo | Valid claim is reviewed and awarded once; approval waits for claim and called terms to load. |
| Decisions | Mystery accusation cannot be overwritten; all Poker cards and forced choices resolve; Bill Shock selections persist. |
| Day 2 collaboration | Five roles complete networking; three team awards apply; Factory round 2 and Kitchen/Follow the Order handoffs complete, including blocked/recovered tickets and seven distinct volunteers. |
| Operations | Timer start/clear; projector join and leaderboard; freeze an already-awarded architecture; frozen student controls; CSV download; student transfers update both rosters. |
| Offline recovery | Pending edits do not count as a confirmed save until reconnect; reconnect persists the work. |
| Closing | Certificate gating/release; nested live leaderboard; completion/reopening; every canonical event has transaction and trace/span correlation; confirmed session deletion recursively removes workshop data. |

## Additional automated checks

Firestore/Functions integration tests cover role boundaries, cross-team access, immutable scores and submissions, idempotent awards, concurrent reservations, 120-student simulation and atomic networking updates. Pure scoring tests cover Poker and Bill Shock. Backend and browser telemetry tests cover event catalogues, correlation, identity, filtering and delivery behaviour.

## Practical limits

Emulator identities do not test real Google OAuth popups, browser account restrictions or authorized domains. A mobile Chrome viewport does not certify physical phones or Safari. The 120-student simulation checks correctness, not venue Wi-Fi capacity. The local collector verifies payloads and delivery without proving their eventual appearance in Dynatrace Grail; production ingestion needs a separate acceptance check. Captain/facilitator judgement still determines reviewed awards.

Before doors open, use a real Google account on the hosted site, verify a captain’s assigned region, and check the venue’s phones, Wi-Fi and projector. These checks complement the automated rehearsal.

## Activity inventory

| Activity | Type | Coverage |
|---|---|---|
| Pre-workshop survey (survey-pre) | form | Launch and interaction cases above |
| Cloud or Not? (cloud-or-not) | quiz | Launch and interaction cases above |
| Human Timeline (timeline) | studio | Launch and interaction cases above |
| Service Model Sort (service-sort) | studio | Launch and interaction cases above |
| Where Should They Live? (deploy-debate) | form | Launch and interaction cases above |
| Cloud Shark Tank: pitch brief (shark-pitch) | form | Launch and interaction cases above |
| Shark Tank: region vote (shark-vote) | vote | Launch and interaction cases above |
| Cloud Bingo (bingo) | studio | Launch and interaction cases above |
| Architecture Lego: digital design (architecture) | studio | Launch and interaction cases above |
| Human Kitchen (kitchen) | studio | Launch and interaction cases above |
| Gallery Walk (gallery) | studio | Launch and interaction cases above |
| Day 1 recap quiz (quiz-day1) | quiz | Launch and interaction cases above |
| Guess the Downtime (downtime) | form | Launch and interaction cases above |
| Who Killed Checkout? (mystery) | mystery | Launch and interaction cases above |
| Observability Treasure Hunt (treasure-hunt) | form | Launch and interaction cases above |
| Error Budget Poker (budget) | budget | Launch and interaction cases above |
| Blameless postmortem (postmortem) | form | Launch and interaction cases above |
| Digital Delivery Factory (factory) | studio | Launch and interaction cases above |
| Cloud Bill Shock (billshock) | billshock | Launch and interaction cases above |
| Follow the Order (follow-order) | studio | Launch and interaction cases above |
| My 90-day cloud plan (plan) | form | Launch and interaction cases above |
| Day 2 recap quiz (quiz-day2) | quiz | Launch and interaction cases above |
| Demo Day: region vote (demo-vote) | vote | Launch and interaction cases above |
| Post-workshop feedback (survey-post) | form | Launch and interaction cases above |

## Verified result — 7 October 2026

- 17 browser scenarios passed, covering the two-day flow and all 24 activity launches.
- 37 permission, scoring, audit and concurrency integration tests passed, including 120 student registrations.
- 10 browser/scoring unit tests and 18 backend tests passed.
- Production build passed; lint passed with existing Fast Refresh development warnings.

The rehearsal found and fixed anonymous-session loading, incomplete architecture feedback, concurrent networking steps, approval-loading controls, freezing already-awarded architecture and stale recap response scoring. Recursive deletion is verified after asynchronous cleanup completes.
