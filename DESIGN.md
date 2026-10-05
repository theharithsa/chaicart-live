# Interface design and verification

ChaiCart Live is the workshop's source of truth for registration, answers, captain reviews, credits and certificates. Its design distinguishes student participation from staff review and final scoring.

## Interface changes

- Clear Google-sign-in and team-code onboarding, with session codes explained separately.
- Student activity cards explain individual/team scope and the signed-in student's submission responsibility.
- Submitted answers use labeled summaries instead of raw JSON. Technical architecture IDs have readable names; exported data remains available.
- Captain and facilitator screens distinguish proposed credits from applied ledger entries.
- Secondary facilitator tools are expandable: team codes, awards, Bingo, Factory and station assignments.
- Shared typography, warm ivory/green colors, visible focus states, touch-sized controls, responsive tables/navigation and reduced-motion behavior.
- Connection, empty, waiting and certificate-release states remain visible and readable.

## Checks performed on 5 October 2026

- Production TypeScript/Vite build passes. Lint passes with eight existing Fast Refresh warnings in unrelated exports.
- All 22 Firestore emulator tests pass, including 120 Google students joining 24 teams and regional captain restrictions.
- All 24 student activities render at 390 px without page overflow in an isolated local rehearsal.
- Rehearsed captain review, all five console tabs, labeled architecture evidence, student agenda/team views, locked/revealed quizzes, waiting state, pending/released certificates, and projector activity/leaderboard/join views.
- The final join QR image is constrained to its viewport.
- Production bundles use the existing Firebase project and exclude synthetic accounts and rehearsal modules.

Protected visual checks used local fixtures and never wrote production records. They verify rendering and interaction layout, not a fresh end-to-end Google account journey. Real Google sign-in, session participation and consent were not repeated for this design release.

## Deployment

Build with the existing production Firebase web configuration and `VITE_TELEMETRY_ENABLED=true`. Deploy Hosting only for this release; rules and Functions are unchanged. Retain the `/api/telemetry` Hosting rewrite and Dynatrace RUM tag. Never include local rehearsal files or credentials in the bundle.
