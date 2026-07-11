import { spawn } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const kernelDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(kernelDir, "../..")
const kernelServerUrl =
  process.env.NEXT_PUBLIC_KERNEL_SERVER_URL || "http://localhost:3006"
const commands = [
  {
    command: "pnpm",
    args: ["turbo", "dev"],
    env: { NEXT_PUBLIC_KERNEL_SERVER_URL: kernelServerUrl },
  },
  { command: "go", args: ["run", "./cmd/server"] },
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

const children = [
  spawnPnpm(commands[0].args, {
    cwd: repoRoot,
    env: { ...process.env, ...commands[0].env },
    stdio: "inherit",
  }),
  spawn("go", commands[1].args, {
    cwd: kernelDir,
    env: { ...process.env, DEV_AUTH_ROLE: process.env.DEV_AUTH_ROLE || "super-admin" },
    stdio: "inherit",
  }),
]

let stopping = false
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
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
