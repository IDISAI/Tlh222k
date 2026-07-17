# .github - agent notes

GitHub workflow and repository automation.

- Keep CI aligned with the root [CLAUDE.md](../CLAUDE.md): install, lint,
  typecheck, build.
- Vercel deploy secrets are CI secrets, not app `.env` values.
- Do not reintroduce submodule setup unless `.gitmodules` is restored with real
  gitlinks.
- Changes here should be reflected in [docs/onboarding/cicd.md](../docs/onboarding/cicd.md)
  when behavior changes.
