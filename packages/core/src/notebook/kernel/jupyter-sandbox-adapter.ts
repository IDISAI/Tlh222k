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
 * Browser kernel adapter. Browser receives only short-lived proxy ticket;
 * Jupyter token and sandbox endpoint stay inside kernel-server.
 */
export class JupyterSandboxAdapter implements KernelAdapter {
  private session: SandboxSession | null = null
  private manager: KernelManager | null = null
  private kernel: Kernel.IKernelConnection | null = null
  private startPromise: Promise<void> | null = null
  private statusValue: KernelStatus = "uninitialized"
  private readonly subscribers = new Set<(status: KernelStatus) => void>()

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

  async execute(
    code: string,
    callbacks: ExecuteCallbacks = {}
  ): Promise<ExecuteResult> {
    await this.start()
    if (!this.kernel) throw new Error("Jupyter kernel unavailable")
    if (this.status === "busy") throw new Error("Another cell is running")

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
    this.kernel?.dispose()
    this.manager?.dispose()
    const session = this.session
    this.kernel = null
    this.manager = null
    this.session = null
    this.startPromise = null
    this.setStatus("uninitialized")
    this.subscribers.clear()
    if (session) void this.client.remove(session.id)
  }

  private async connect(): Promise<void> {
    const session = await this.client.create(this.profile)
    const baseUrl = trailingSlash(this.client.resolveProxyUrl(session.proxyBaseUrl))
    const wsUrl = baseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
    const serverSettings = ServerConnection.makeSettings({
      baseUrl,
      wsUrl,
      token: session.connectionTicket,
      appendToken: true,
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
  for (const mime of ["image/png", "image/jpeg", "image/gif", "image/svg+xml"]) {
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
