# OpenCan — Backlog

Features not yet specced or scheduled. Add items here; promote to a spec in
`specs/` when ready to implement.

---

## Notifications

### Admin comment notification
When an admin posts a comment on a post, notify the post author by email
(respecting a user preference — likely a new `notifyOnComment` field on `User`,
mirroring the pattern of `notifyOnStatusChange` and `notifyOnChangelog`).

**Motivation:** closes the feedback loop when the team replies to a submission.
Equivalent to the "the team replied to your post" email in UserJot.

**Scope notes:**
- Only admin comments trigger the notification (not user-to-user comments), or
  optionally all comments — decision to be made in spec.
- Post author should not be notified of their own comments.
- Email infrastructure (`lib/email.ts`) and preference pattern already exist.
- Low effort; no schema change if scoped to admin-only (no new preference field
  needed if we reuse `notifyOnStatusChange`, but a dedicated field is cleaner).
