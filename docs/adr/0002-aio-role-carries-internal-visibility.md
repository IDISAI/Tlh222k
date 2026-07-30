# A fourth role, `aio`, carries Internal visibility

Internal roadmap blocks need an audience that is neither the general public nor the CMS staff. We added `aio` as a fourth value of the single Clerk `role` claim, rather than a separate entitlement flag layered on top of the existing three, and Internal content admits `aio`, `admin`, and `super-admin`. Clerk issues one `role` claim and the whole codebase reads it through one helper; a second permission system beside it would be a second source of truth about who may see what, which is precisely the kind of divergence access control cannot afford. Admins are admitted so that whoever publishes Internal content can still read it back — without that, nobody can check their own work.

## Consequences

`normalizeRole` maps every unrecognised value to `viewer`. Until `aio` is added to that whitelist, a user granted the role in the Clerk dashboard silently becomes a viewer: the failure is closed, so nothing leaks, but nothing reports it either. The same helper backs every app's proxy and route guard, so the whitelist is the single place this must change — and the single place a mistake would either lock out AIO learners or open Internal content to everyone.

Roles stay mutually exclusive. An AIO learner who also edits content must be `admin`, and draws Internal access from that rather than from their enrolment; the system cannot express "enrolled in AIO" and "edits the catalogue" as independent facts about one person.

Visibility stays a separate axis from status: a block may be Published yet Internal — listed to everyone, opened by some. A paid tier is deliberately absent. Nothing records who has paid, so a `Premium` value would leave content its author believed to be sold sitting open to every visitor.
