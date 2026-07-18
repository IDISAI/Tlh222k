import { beforeEach, describe, expect, it, vi } from "vitest"

import { JupyterSandboxAdapter } from "./jupyter-sandbox-adapter"
import type { RuntimeProfile, SandboxSession } from "./types"

const jupyter = vi.hoisted(() => ({
  startNew: vi.fn(),
  makeSettings: vi.fn((settings: unknown) => settings),
}))

vi.mock("@jupyterlab/services", () => ({
  KernelManager: class {
    startNew = jupyter.startNew
    dispose = vi.fn()
  },
  KernelMessage: {
    isStreamMsg: vi.fn(() => false),
    isExecuteResultMsg: vi.fn(() => false),
    isDisplayDataMsg: vi.fn(() => false),
    isErrorMsg: vi.fn(() => false),
  },
  ServerConnection: { makeSettings: jupyter.makeSettings },
}))

const EXPECTED_KERNELS: ReadonlyArray<[RuntimeProfile, string]> = [
  ["data-science", "python3"],
  ["ml-cpu", "python3"],
  ["javascript", "deno"],
  ["cpp", "xcpp17"],
  ["java", "java"],
  ["rust", "evcxr"],
  ["go", "gophernotes"],
  ["julia", "julia"],
]

function session(profile: RuntimeProfile): SandboxSession {
  return {
    id: `session-${profile}`,
    profile,
    status: "idle",
    proxyBaseUrl: `/api/sessions/session-${profile}/proxy/`,
    expiresAt: "2099-01-01T00:00:00Z",
  }
}

describe("JupyterSandboxAdapter kernel selection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    jupyter.startNew.mockResolvedValue({
      dispose: vi.fn(),
      isDisposed: false,
      connectionStatus: "connected",
    })
  })

  it.each(EXPECTED_KERNELS)(
    "starts %s sessions with the %s kernelspec",
    async (profile, kernelName) => {
      const client = {
        create: vi.fn(async () => session(profile)),
        interrupt: vi.fn(async () => undefined),
        restart: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
        resolveProxyUrl: vi.fn(
          () => `http://localhost:3006/api/sessions/session-${profile}/proxy/`
        ),
      }
      const adapter = new JupyterSandboxAdapter(client, profile)

      await adapter.start()

      expect(client.create).toHaveBeenCalledWith(profile)
      expect(jupyter.startNew).toHaveBeenCalledWith({ name: kernelName })
      adapter.dispose()
    }
  )
})
