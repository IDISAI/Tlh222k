import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const kernelDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(kernelDir, "../..")

// Load root .env file manually
try {
  const envContent = readFileSync(resolve(repoRoot, ".env"), "utf8")
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    }
  }
} catch (e) {
  // Ignore if file doesn't exist
}

const kernelServerUrl =
  process.env.NEXT_PUBLIC_KERNEL_SERVER_URL || "http://localhost:3006"

const enableBypass = process.env.ENABLE_DEV_AUTH_BYPASS === "true"
const devAuthRoleVal = enableBypass
  ? (process.env.NEXT_PUBLIC_DEV_AUTH_ROLE || process.env.DEV_AUTH_ROLE || "super-admin")
  : ""

const commands = [
  {
    command: "pnpm",
    args: ["turbo", "dev"],
    env: {
      NEXT_PUBLIC_KERNEL_SERVER_URL: kernelServerUrl,
      NEXT_PUBLIC_DEV_AUTH_ROLE: devAuthRoleVal,
    },
  },
  {
    command: "go",
    args: ["run", "./cmd/server"],
    env: {
      APP_ENV: "development",
      SESSION_TICKET_SECRET:
        process.env.SESSION_TICKET_SECRET || "development-only-ticket-secret",
      // Host-run kernel-server cannot resolve Docker network DNS names.
      JUPYTER_HOST_PROXY: "1",
    },
  },
]

if (process.argv.includes("--dry-run")) {
  process.stdout.write(JSON.stringify(commands))
  process.exit(0)
}

function spawnPnpm(args, options) {
  if (process.platform === "win32") {
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "pnpm.cmd", ...args], options)
  }
  return spawn("pnpm", args, options)
}

if (process.argv.includes("--check")) {
  const checks = [
    spawnPnpm(["--version"], { cwd: repoRoot, stdio: "ignore" }),
    spawn("go", ["version"], { cwd: kernelDir, stdio: "ignore" }),
  ]
  const codes = await Promise.all(
    checks.map(
      (child) =>
        new Promise((resolveCode) => {
          child.once("error", () => resolveCode(1))
          child.once("exit", (code) => resolveCode(code ?? 1))
        })
    )
  )
  process.exit(codes.every((code) => code === 0) ? 0 : 1)
}

// Run both stacks in one terminal by default, or split them: --js-only runs the
// turbo dev TUI alone (needs an exclusive TTY, else the Go logs corrupt it),
// --go-only runs just the kernel-server.
const goOnly = process.argv.includes("--go-only")
const jsOnly = process.argv.includes("--js-only")

const children = []
if (!goOnly) {
  children.push(
    spawnPnpm(commands[0].args, {
      cwd: repoRoot,
      env: { ...process.env, ...commands[0].env },
      stdio: "inherit",
    })
  )
}
if (!jsOnly) {
  children.push(
    spawn("go", commands[1].args, {
      cwd: kernelDir,
      env: {
        ...process.env,
        ...commands[1].env,
        DEV_AUTH_ROLE: devAuthRoleVal,
      },
      stdio: "inherit",
    })
  )
}

// child.kill() only signals the direct child (the cmd.exe/pnpm wrapper on
// Windows); its grandchildren — turbo, the next dev workers, the Go binary —
// survive and keep the ports bound. Kill the whole process tree so Ctrl+C
// frees 3000/3002/3003/3005/3006.
function killTree(child) {
  if (!child.pid || child.killed) return
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    })
  } else {
    child.kill("SIGTERM")
  }
}

let stopping = false
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) killTree(child)
  process.exitCode = exitCode
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop())
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(error.message)
    stop(1)
  })
  child.on("exit", (code, signal) => {
    if (!stopping) stop(signal ? 1 : (code ?? 1))
  })
}
