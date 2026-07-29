#!/usr/bin/env node
// Consolidates Vercel env vars that are duplicated as separate single-environment
// entries (one row scoped to "Production", another to "Preview") into a single
// entry scoped to both — driven by scripts/vercel-env/manifest.json.
//
// Usage:
//   node scripts/vercel-env/sync.mjs            # dry run (default), prints the plan
//   node scripts/vercel-env/sync.mjs --apply     # actually runs `vercel env rm`/`add`
//
// Only touches entries with "action": "merge" in the manifest. Entries marked
// "skip" are real secrets or environment-sensitive values this script refuses
// to guess at — it just prints the reason so a human can handle them in the
// Vercel dashboard.

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const apply = process.argv.includes("--apply")

const manifest = JSON.parse(
  readFileSync(join(__dirname, "manifest.json"), "utf8")
)

function vercel(args, projectId) {
  return execFileSync("vercel", args, {
    encoding: "utf8",
    shell: true,
    env: { ...process.env, VERCEL_ORG_ID: manifest.org, VERCEL_PROJECT_ID: projectId },
  })
}

function currentScopes(projectId) {
  // `vercel env ls` output: "name  value  environments  created". A var that
  // still needs merging shows as MULTIPLE rows for the same key (one scoped
  // to Production, another to Preview) — so track rows, not just the union of
  // environments, or two separate single-env rows would look "already merged".
  const out = vercel(["env", "ls"], projectId)
  const rows = new Map() // key -> Set<environment>[]
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\S+)\s+.+?\s+((?:Production|Preview|Development)(?:,\s*(?:Production|Preview|Development))*)\s+\d/)
    if (!m) continue
    const [, key, envs] = m
    const set = new Set(envs.split(",").map((s) => s.trim().toLowerCase()))
    const list = rows.get(key) ?? []
    list.push(set)
    rows.set(key, list)
  }
  return rows
}

let skipCount = 0
let mergeCount = 0

for (const project of manifest.projects) {
  console.log(`\n=== ${project.name} (${project.id}) ===`)
  const scopes = currentScopes(project.id)

  for (const v of project.vars) {
    if (v.action === "skip") {
      skipCount++
      console.log(`  SKIP   ${v.key} — ${v.reason}`)
      continue
    }

    const rows = scopes.get(v.key) ?? []
    const want = new Set(manifest.environments)
    const isExactRow = (s) => s.size === want.size && [...want].every((e) => s.has(e))
    const alreadyMerged = rows.length === 1 && isExactRow(rows[0])
    if (alreadyMerged) {
      console.log(`  OK     ${v.key} already a single entry scoped to ${[...want].join(", ")}`)
      continue
    }
    if (rows.length === 0) {
      console.log(`  ADD    ${v.key} -> ${manifest.environments.join(", ")} = "${v.value}" (not set yet)`)
    } else {
      console.log(
        `  MERGE  ${v.key}: ${rows.length} separate row(s) (${rows.map((s) => [...s].join("+")).join(", ")}) -> one row scoped to ${manifest.environments.join(", ")} = "${v.value}"`
      )
    }
    mergeCount++
    if (!apply) continue

    // Remove every environment this key currently has ANY row for, across
    // all rows, so re-adding below creates exactly one row.
    const currentEnvs = new Set(rows.flatMap((s) => [...s]))
    for (const env of currentEnvs) {
      try {
        vercel(["env", "rm", v.key, env, "--yes"], project.id)
      } catch (err) {
        console.error(`    ! rm ${v.key} (${env}) failed: ${err.message}`)
      }
    }
    try {
      // Environments MUST be one comma-separated arg ("production,preview"),
      // not separate positional args — those get parsed as environment +
      // git-branch and fail with a confusing "branch_not_found" error. And
      // --value avoids stdin piping entirely (which silently failed to reach
      // the interactive prompt when this ran once with input+shell:true).
      vercel(
        [
          "env",
          "add",
          v.key,
          manifest.environments.join(","),
          "--value",
          v.value,
          "--yes",
        ],
        project.id
      )
      console.log(`    added.`)
    } catch (err) {
      // A failed add AFTER a successful rm leaves the var missing entirely —
      // never swallow this and move on to the next var.
      console.error(`    ! add ${v.key} FAILED — it is now MISSING from ${[...currentEnvs].join(", ")}: ${err.message}`)
      console.error(`    Stopping here. Fix the issue and re-run before continuing.`)
      process.exit(1)
    }
  }
}

console.log(
  `\n${mergeCount} var(s) to merge, ${skipCount} need manual review.` +
    (apply ? "" : " Re-run with --apply to execute.")
)
