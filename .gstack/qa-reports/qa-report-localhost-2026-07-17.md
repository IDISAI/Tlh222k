# QA Report — localhost stability evidence run (2026-07-17)

Branch `verify/security-evidence` @ `8a8f235`. Automated Playwright chromium
session, one continuous recording (`stability-evidence.webm`, SHA256
`83E67253…38E59`, 103s). Desktop 1440x900 then mobile 375x812.

## Services under test

| Service       | Mode                                             | Port |
| ------------- | ------------------------------------------------ | ---- |
| web           | `next start` (production build)                  | 3000 |
| admin         | `next dev` (dev-role bypass is dev-only by design)| 3002 |
| svc-api       | `node dist/main.js`, Neon **dev** branch          | 3005 |
| kernel-server | `go run`, dev role, random ticket secret          | 3006 |

No production secrets used. Clerk: publishable + test-instance keys only.
Docker unavailable — live Jupyter execution out of scope this run.

## Results — 18/18 steps pass

| # | Step | Result |
| - | ---- | ------ |
| 01 | web home (desktop) | PASS |
| 02 | web /roadmaps list renders data from svc-api | PASS |
| 03 | web roadmap viewer (Frontend Developer tree) | PASS |
| 04 | web roadmap node click opens panel | PASS |
| 05 | admin /roadmaps list (Quản lý roadmap) | PASS |
| 06 | admin open roadmap builder | PASS |
| 07 | admin create-roadmap with empty title → visible validation error "Tên roadmap không được để trống", dialog stays open | PASS |
| 08 | dialog dismiss | PASS |
| 09 | kernel GET /health → 200 | PASS |
| 10 | kernel GET /api/notebooks (dev-authorized) → 200 list | PASS |
| 11 | kernel Jupyter proxy without ticket cookie → **401** | PASS |
| 12 | kernel Jupyter proxy with `?ticket=forged` → **400** (query secrets rejected) | PASS |
| 13 | web notebook page /notebooks/css-grid-lab | PASS |
| 14 | switch viewport to 375x812 | PASS |
| 15 | mobile web home | PASS |
| 16 | mobile web /roadmaps | PASS |
| 17 | mobile web roadmap viewer | PASS |
| 18 | mobile admin /roadmaps | PASS |

## Console errors

Zero unexpected console errors across all tested pages. The only two console
entries are the **intentional** authorization-rejection demos (steps 11–12).

## Artifacts

- `stability-evidence.webm` — full run video
- `screenshots/01…18-*.png` — one per step
- `qa-run-2026-07-17.json` — machine-readable step results + console log
- `baseline.json` — command gates + environment baseline
