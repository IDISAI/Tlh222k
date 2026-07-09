# .github

GitHub automation lives here.

- `workflows/ci.yml`: lint, typecheck, build.
- `workflows/deploy-staging.yml`: Vercel preview deploys.
- `workflows/release.yml`: production deploys and GitHub Release.

App runtime env belongs in each app or Vercel project. GitHub repository secrets
here are for CI/CD only.
