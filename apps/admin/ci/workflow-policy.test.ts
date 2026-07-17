import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

function workflow(name: string): string {
  try {
    return readFileSync(resolve(REPO_ROOT, ".github/workflows", name), "utf8")
  } catch {
    return ""
  }
}

describe("release workflow policy", () => {
  it("gates the standalone Go service in CI", () => {
    const ci = workflow("ci.yml")
    expect(ci).toContain("actions/setup-go@v5")
    expect(ci).toContain("go-version-file: apps/kernel-server/go.mod")
    expect(ci).toContain("go test -race ./...")
    expect(ci).toContain("go vet ./...")
    expect(ci).toContain("go build ./...")
  })

  it("supplies the fail-closed backend URL to the CI build gate", () => {
    const ci = workflow("ci.yml")
    expect(ci).toContain("NEXT_PUBLIC_SVC_API_URL: http://localhost:3005")
  })

  it("deploys svc-api and pins one exact Vercel CLI version", () => {
    const staging = workflow("deploy-staging.yml")
    const release = workflow("release.yml")
    const combined = `${staging}\n${release}`

    expect(staging).toContain("{ app: svc-api, project: SVC_API }")
    expect(release).toContain("{ app: svc-api, project: SVC_API }")
    expect(combined).not.toContain("vercel@latest")

    const versions = [...combined.matchAll(/vercel@(\d+\.\d+\.\d+)/g)].map(
      (match) => match[1]
    )
    expect(versions).toHaveLength(6)
    expect(new Set(versions).size).toBe(1)
  })

  it("publishes only immutable kernel image tags with minimal permissions", () => {
    const kernel = workflow("kernel-image.yml")
    expect(kernel).toContain("workflow_dispatch:")
    expect(kernel).toContain("packages: write")
    expect(kernel).toContain("contents: read")
    expect(kernel).toContain("${{ github.sha }}")
    expect(kernel).toContain("provenance: mode=max")
    expect(kernel).not.toContain(":latest")
    expect(kernel).not.toContain("value=latest")
  })
})
