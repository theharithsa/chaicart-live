# Changelog

## Unreleased

- Patch source-map-js and UUID dependencies, replacing an ineffective nested override; clean frontend and Functions audits report zero vulnerabilities.

- Respect completed InspiredLearning erasure during workshop archival without recreating deleted portal history; in-progress erasure still blocks archival.
- Allow learners to read their own privacy marker and global facilitators to review it; deny all client marker writes.

- Connect InspiredLearning permanent learner records and authenticated certificates; separate the portal announcement from verified completion.
- Protect completed-session deletion until all participants have durable reviewed records and reserve archived session codes.
- Add owner-scoped learning rules and canonical-event retry index.

- Attach transaction IDs and real audit trace/span IDs to every newly generated canonical workshop BizEvent; preserve request correlation where available.
- Share transaction IDs across browser interactions and telemetry; add trace/span IDs to completed browser operations.
- Add an isolated, repeatable workshop browser rehearsal and scoring/correlation/permission cases.
- Keep anonymous visitors behind the Google sign-in gate without misleading session errors.
- Validate incomplete architecture submissions, retain concurrent networking completion steps, wait for Bingo evidence before approval, and show frozen architecture as read-only.
- Allow freezing an approved architecture after its award has already been applied.
- Score recap quizzes from a fresh server read after locking answers, and show pending answer saves until confirmed.
