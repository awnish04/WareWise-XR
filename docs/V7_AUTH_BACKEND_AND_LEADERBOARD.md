# v7 — Authentication, approval, backend and leaderboard

## Implemented changes

- Replaced the direct training landing screen with a secure employee/admin portal based on the approved WareWise visual direction.
- Rebuilt the WareWise XR SVG wordmark to remove the previous spacing/overlap issue.
- Added employee access requests with full name, work email, department and password.
- Added separate administrator login.
- Added administrator approval/rejection workflow.
- Added server-side protection of the training route: only an authenticated employee with `status=approved` can open `/training`.
- Added employee account dashboard with access status and training history.
- Added simple administrator dashboard with request queue, account table and participation metrics.
- Added employee leaderboard based on server-recorded best training score.
- Migrated employee training progress from device-only state to account-linked local backend persistence.
- Retained a browser copy of active training state only as a rendering/runtime cache; authoritative employee history is written to the local server store.

## Local architecture

The backend uses Node.js built-ins only and persists to `data/store.json`. This keeps deployment appropriate for a localhost university demonstration while providing a real client/server access-control workflow.

## Access rule

Authentication and approval are separate. A pending employee can sign in to check status but cannot access the training route. The administrator must explicitly approve the account first.
