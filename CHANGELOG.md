# Changelog

## Unreleased

- Attach transaction IDs and real audit trace/span IDs to every newly generated canonical workshop BizEvent; preserve request correlation where available.
- Share transaction IDs across browser interactions and telemetry; add trace/span IDs to completed browser operations.
- Add an isolated, repeatable workshop browser rehearsal and scoring/correlation/permission cases.
- Keep anonymous visitors behind the Google sign-in gate without misleading session errors.
- Validate incomplete architecture submissions, retain concurrent networking completion steps, wait for Bingo evidence before approval, and show frozen architecture as read-only.
- Allow freezing an approved architecture after its award has already been applied.
