# Student and staff workflow verification — 6 October 2026

The changes were tested with disposable Google identities and sessions in `demo-chaicart` Firebase emulators. Production sessions, student answers and credit totals were not modified by verification.

| Requested check | Result and evidence |
|---|---|
| Session deletion | Setup exposes Delete, requires the exact code, then clears the selected session and all nested records. Browser deleted UIFLOW successfully; backend test also verifies nested station events are removed and captain/wrong-confirmation requests are rejected. |
| Cloud or Not results and scoring | An individual CEO answer was accepted, reveal showed Correct and 100 personal credits, and the team increased from 1,000 to 1,100. Integration tests cover two correct participants adding 200, incorrect/missing answers earning zero, concurrent reveals, multiple questions, undo and re-score. |
| Student details | Students → View submitted work displayed Gmail → Cloud and the 100-credit personal result. Captains can inspect regional team work and individual Cloud answers; private surveys/plans remain facilitator-only. |
| Incorrect Timeline approval | Captain approval remained enabled and saved an approved review at zero credits. The +50 correct-order winner award cannot be issued for an incorrect order; a separate reasoned bonus/correction is available. |
| In-activity leaderboard | Run → Service Model Sort → Screen: Leaderboard rendered the live regional scores inside Run and updated the projector mode. |
| Captains award any activity | Captain’s any-activity form applied a reasoned +100 bonus and updated the selected team from 1,000 to 1,100. Integration tests reject wrong-region/nonstaff requests and deduplicate retried operations. Facilitators retain access. |
| Bingo claim | Valid local claim approved and awarded +30 by the captain; team increased from 1,200 to 1,230. Invalid claims and the first-three award limit are tested. Bingo awards follow the existing team rubric. |
| Architecture | Captain’s reviewed award applied +50; team increased from 1,100 to 1,150. Concurrent captain/facilitator award tests confirm only one award is applied. |
| Gallery | Captain’s reviewed award applied +50; team increased from 1,150 to 1,200. Room-wide four-award limit remains enforced. |

Additional checks: atomic session creation succeeds with protected content; missing content fails without a partial session. Staff controls and student pages reported no browser runtime errors. The existing runtime identity’s Firestore access was checked; no new project IAM role was granted. An unauthenticated request to the deployed callable returned 401/UNAUTHENTICATED.

Validation: production build; lint with only existing Fast Refresh warnings; 31 Firestore/backend regression tests including 120 students joining 24 teams; 10 backend policy/telemetry unit tests; final targeted privacy/schema tests and backend integration rerun. CI runs the emulator files sequentially to avoid fixture interference.

Scoring implication: five participants × eight correct answers × 100 = 4,000 team credits in Cloud or Not. Recap quizzes remain +10 per correct team answer. Existing Cloud answers are retained and scored only when a facilitator explicitly reveals/scores the question; there is no automatic backfill.

Published components: restricted Firestore read rules, authenticated `workshopAction`, telemetry gateway update and Firebase Hosting frontend. The workshop slides, facilitator cues and flow map were aligned with the new scoring responsibilities.
