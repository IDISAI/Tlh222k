# Vercel environment variables

What each Vercel project needs to build, deploy, and serve a working preview.
Local development is covered by [env.md](env.md) and the `.env.example` beside
each app — this page is only about the four Vercel projects.

Vercel scopes every variable to **Production**, **Preview**, and
**Development**. A variable set only for Production is absent from every
preview deploy, which is how a preview ends up building fine and then rendering
an empty page. Unless a row says otherwise, set it for **Production and
Preview**.

`NEXT_PUBLIC_*` is inlined into the browser bundle at build time. Changing one
requires a redeploy — editing it in the dashboard does nothing until the next
build.

## Projects

| Vercel project | App | Root directory |
| --- | --- | --- |
| `tlh222k-web` | `apps/web` | `apps/web` |
| `tlh222k-admin` | `apps/admin` | `apps/admin` |
| `tlh222k-super-admin` | `apps/super-admin` | `apps/super-admin` |
| `tlh222k-svc-api` | `apps/svc-api` | `apps/svc-api` |

`apps/kernel-server` is **not** a Vercel project — it is a Go service that needs
Docker, which Vercel does not provide. See "Notebook execution" below.

## tlh222k-web

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Build fails without it. |
| `CLERK_SECRET_KEY` | yes | Server-side; never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | yes | `/roadmaps` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | yes | `/roadmaps` |
| `NEXT_PUBLIC_SVC_API_URL` | yes | Without it the roadmap list falls back to a browser-local mock and renders "Chưa có roadmap nào". |
| `ADMIN_URL` | only on preview | Multi-Zone rewrite target for `/admin`. `next.config.ts` defaults to `https://tlh222k-admin.vercel.app`, which is the **production** admin — so a web preview proxies `/admin` to production unless this points at the matching admin preview alias. |
| `SUPER_ADMIN_URL` | only on preview | Same, for `/super-admin`. |
| `NOTEBOOK_BLOB_TOKEN` or `BLOB_READ_WRITE_TOKEN` | recommended | Serves admin-authored notebooks. Absent, the viewer still works but shows only the `.ipynb` fixtures committed under `apps/web/content/notebooks/`. |
| `NEXT_PUBLIC_KERNEL_SERVER_URL` | **leave unset** | See "Notebook execution". |
| `NEXT_PUBLIC_DEV_AUTH_ROLE` | **never set** | Dev-only Clerk bypass. Ignored in production, but setting it in Preview is a real auth hole. |
| `SENTRY_*`, `NEXT_PUBLIC_SENTRY_*` | optional | Blank disables Sentry. `SENTRY_AUTH_TOKEN` is build-time only. |

## tlh222k-admin

Same Clerk block as web (`AFTER_SIGN_IN_URL` is `/roadmaps`), plus:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_HOST_URL` | yes | Web host origin, for the cross-zone switcher. |
| `NEXT_PUBLIC_SVC_API_URL` | yes | Roadmap builder and Notion editor both require it. |
| `NEXT_PUBLIC_WEB_URL` | yes | Builds the copyable `/notebooks/{slug}` link shown after publishing. Defaults to `http://localhost:3000`, so published notebooks advertise a localhost link until this is set. Used **only** by the admin editor — web does not need it. |
| `BLOB_READ_WRITE_TOKEN` | yes | Notebook storage **and** Notion cover-image uploads. Without it the notebook editor cannot save. |
| `NEXT_PUBLIC_KERNEL_SERVER_URL` | **leave unset** | See below. |
| `NEXT_PUBLIC_DEV_AUTH_ROLE` | **never set** | |

## tlh222k-super-admin

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | |
| `CLERK_SECRET_KEY` | yes | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | yes | `/users` |
| `NEXT_PUBLIC_HOST_URL` | yes | |
| `NEXT_PUBLIC_SVC_API_URL` | yes | User management reads it; absent, the user list is empty. |
| `NEXT_PUBLIC_DEV_AUTH_ROLE` | **never set** | |
| `SENTRY_*` | optional | |

## tlh222k-svc-api

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres (Neon) in every deployed environment. |
| `DIRECT_URL` | recommended | Non-pooled URL for `prisma db push` in CI. |
| `CLERK_SECRET_KEY` | yes | |
| `CLERK_PUBLISHABLE_KEY` | yes | |
| `CLERK_WEBHOOK_SECRET` | yes | Clerk → `/webhooks/clerk` signature check. |
| `FRONTEND_ORIGINS` | production only | Comma-separated CORS allow-list for the production origins. Preview hostnames do **not** need listing: `apps/svc-api/src/http/cors.ts` also accepts anything matching `https://tlh222k-<...>-idis.vercel.app`, which covers every deploy under this Vercel team. |
| `SENTRY_DSN` | optional | |

`PORT` is supplied by the platform; do not set it.

## Stale lines in `.env.example`

`apps/web/.env.example` and `apps/admin/.env.example` still list `DATABASE_URL`,
and web's also lists `SVC_NOTION_URL`. Neither app calls Prisma any more — Notion
goes through svc-api — and `SVC_NOTION_URL` survives only inside a comment. Do
not set either one on Vercel.

## Preview protection

Vercel Authentication is on by default: preview URLs return a login page to
anyone not signed in to the team, and cross-origin calls from a web preview to
an svc-api preview are rejected. If previews need to be reachable without a
Vercel login, turn off Deployment Protection for Preview, or use a protection
bypass token — Project → Settings → Deployment Protection.

## Notebook execution

There is no Docker on Vercel, so `apps/kernel-server` cannot run there. This is
deliberate, and the notebook feature is built to work without it:

| Language | On Vercel (no kernel server) |
| --- | --- |
| Python | runs in the browser on Pyodide |
| JavaScript | runs in the browser on the bundled interpreter |
| C++, Java, Rust, Go, Julia | **cannot run** — the cell reports that a kernel server is required |

Setting `NEXT_PUBLIC_KERNEL_SERVER_URL` to a URL that is not a reachable
kernel-server makes things **worse**, not better: cells stop using the browser
runtimes and start calling a sandbox that is not there, so Python and
JavaScript break too, and "Visualize execution" — which requires one successful
run — stops opening.

To get the other five languages working, deploy `apps/kernel-server` on a host
that runs containers (Fly.io, Railway, Render, a VPS) and point
`NEXT_PUBLIC_KERNEL_SERVER_URL` at it in both web and admin. The Go service and
its seven runtime images already exist under `apps/kernel-server/`; nothing in
the frontend needs to change.

## Applying variables

Dashboard: Project → Settings → Environment Variables → tick Production and
Preview.

CLI (requires `npm i -g vercel`):

```bash
vercel link --project tlh222k-web
vercel env add NEXT_PUBLIC_SVC_API_URL preview
vercel env pull apps/web/.env.local
```

`NEXT_PUBLIC_*` changes only take effect on the next build, so redeploy after
editing them.
