import {
  KernelManager,
  KernelMessage,
  ServerConnection,
  type Kernel,
} from "@jupyterlab/services"

import type { CellOutput, MimeBundle } from "../types"
import type { SandboxSessionClient } from "./session-client"
import type {
  ExecuteCallbacks,
  ExecuteResult,
  KernelAdapter,
  KernelStatus,
  RuntimeProfile,
  SandboxSession,
} from "./types"

type SessionClient = Pick<
  SandboxSessionClient,
  "create" | "interrupt" | "restart" | "remove" | "resolveProxyUrl"
>

/**
 * Browser kernel adapter. HttpOnly cookie authenticates proxy requests;
 * Jupyter token and sandbox endpoint stay inside kernel-server.
 */
export class JupyterSandboxAdapter implements KernelAdapter {
  private session: SandboxSession | null = null
  private manager: KernelManager | null = null
  private kernel: Kernel.IKernelConnection | null = null
  private startPromise: Promise<void> | null = null
  private statusValue: KernelStatus = "uninitialized"
  private readonly subscribers = new Set<(status: KernelStatus) => void>()
  // Cells queue like Colab instead of rejecting while another one runs.
  private queue: Promise<unknown> = Promise.resolve()
  private disposed = false

  constructor(
    private readonly client: SessionClient,
    private readonly profile: RuntimeProfile
  ) {}

  get status(): KernelStatus {
    return this.statusValue
  }

  subscribeStatus(callback: (status: KernelStatus) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise
    this.setStatus("starting")
    this.startPromise = this.connect().catch((error) => {
      this.startPromise = null
      this.setStatus("error")
      throw error
    })
    return this.startPromise
  }

  execute(
    code: string,
    callbacks: ExecuteCallbacks = {}
  ): Promise<ExecuteResult> {
    const task = this.queue.then(() => this.runExecution(code, callbacks))
    this.queue = task.catch(() => undefined)
    return task
  }

  private async runExecution(
    code: string,
    callbacks: ExecuteCallbacks
  ): Promise<ExecuteResult> {
    try {
      return await this.executeOnce(code, callbacks)
    } catch (error) {
      // A dead sandbox (idle-reaped, docker restart, dropped WebSocket) is
      // recoverable: reconnect once with a fresh session, Colab-style.
      if (this.disposed || this.connectionHealthy()) throw error
      this.resetConnection()
      return this.executeOnce(code, callbacks)
    }
  }

  private async executeOnce(
    code: string,
    callbacks: ExecuteCallbacks
  ): Promise<ExecuteResult> {
    if (this.disposed) throw new Error("Kernel adapter disposed")
    await this.start()
    if (!this.kernel) throw new Error("Jupyter kernel unavailable")

    this.setStatus("busy")
    const future = this.kernel.requestExecute({ code, stop_on_error: true })
    future.onIOPub = (message) => emitIOPub(message, callbacks)
    try {
      const reply = await future.done
      this.setStatus("idle")
      return { executionCount: reply.content.execution_count ?? 0 }
    } catch (error) {
      this.setStatus("error")
      throw error
    } finally {
      future.dispose()
    }
  }

  private connectionHealthy(): boolean {
    return Boolean(
      this.kernel &&
      !this.kernel.isDisposed &&
      this.kernel.connectionStatus === "connected"
    )
  }

  /** Drop the broken kernel/session so the next start() dials fresh. */
  private resetConnection(): void {
    const session = this.session
    this.kernel?.dispose()
    this.manager?.dispose()
    this.kernel = null
    this.manager = null
    this.session = null
    this.startPromise = null
    if (session) void this.client.remove(session.id).catch(() => undefined)
  }

  async interrupt(): Promise<void> {
    if (!this.session) return
    await this.client.interrupt(this.session.id)
    this.setStatus("idle")
  }

  async restart(): Promise<void> {
    if (!this.session) return this.start()
    this.setStatus("starting")
    await this.client.restart(this.session.id)
    this.setStatus("idle")
  }

  dispose(): void {
    this.disposed = true
    this.resetConnection()
    this.setStatus("uninitialized")
    this.subscribers.clear()
  }

  private async connect(): Promise<void> {
    const session = await this.client.create(this.profile)
    const baseUrl = trailingSlash(
      this.client.resolveProxyUrl(session.proxyBaseUrl)
    )
    const wsUrl = baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
    const credentialedFetch: typeof fetch = (input, init) =>
      fetch(input, { ...init, credentials: "include" })
    const serverSettings = ServerConnection.makeSettings({
      baseUrl,
      wsUrl,
      token: "",
      appendToken: false,
      fetch: credentialedFetch,
    })
    const manager = new KernelManager({ serverSettings })
    const kernel = await manager.startNew({ name: "python3" })
    this.session = session
    this.manager = manager
    this.kernel = kernel
    this.setStatus("idle")
  }

  private setStatus(next: KernelStatus): void {
    if (next === this.statusValue) return
    this.statusValue = next
    for (const callback of this.subscribers) callback(next)
  }
}

function emitIOPub(
  message: KernelMessage.IIOPubMessage,
  callbacks: ExecuteCallbacks
): void {
  if (KernelMessage.isStreamMsg(message)) {
    callbacks.onStream?.(message.content.name, joinText(message.content.text))
    return
  }
  let output: CellOutput | null = null
  if (KernelMessage.isExecuteResultMsg(message)) {
    output = {
      kind: "execute_result",
      executionCount: message.content.execution_count,
      data: toMimeBundle(message.content.data),
    }
  } else if (KernelMessage.isDisplayDataMsg(message)) {
    output = { kind: "display_data", data: toMimeBundle(message.content.data) }
  } else if (KernelMessage.isErrorMsg(message)) {
    output = {
      kind: "error",
      ename: message.content.ename,
      evalue: message.content.evalue,
      traceback: message.content.traceback,
    }
  }
  if (output) callbacks.onOutput?.(output)
}

function toMimeBundle(data: Record<string, unknown>): MimeBundle {
  const text = data["text/plain"]
  const html = data["text/html"]
  for (const mime of [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/svg+xml",
  ]) {
    const value = data[mime]
    if (typeof value === "string") {
      return {
        image: { mime, base64: value },
        text: typeof text === "string" ? text : undefined,
      }
    }
  }
  return {
    html: typeof html === "string" ? html : undefined,
    text: typeof text === "string" ? text : undefined,
  }
}

function joinText(value: string | string[]): string {
  return Array.isArray(value) ? value.join("") : value
}

function trailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`
}
