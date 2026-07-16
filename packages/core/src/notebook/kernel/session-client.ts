import type { RuntimeProfile, SandboxSession } from "./types"

export type ClerkTokenGetter = () => Promise<string | null>

/** Typed lifecycle client for kernel-server sandbox sessions. */
export class SandboxSessionClient {
  private readonly baseUrl: string
  private readonly getToken: ClerkTokenGetter

  constructor(baseUrl: string, getToken: ClerkTokenGetter) {
    this.baseUrl = baseUrl.replace(/\/$/, "")
    this.getToken = getToken
  }

  /** Resolve server-returned proxy path against kernel-server origin. */
  resolveProxyUrl(proxyBaseUrl: string): string {
    return new URL(proxyBaseUrl, `${this.baseUrl}/`).toString()
  }

  create(profile: RuntimeProfile): Promise<SandboxSession> {
    return this.request<SandboxSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ profile }),
    })
  }

  get(id: string): Promise<SandboxSession> {
    return this.request<SandboxSession>(
      `/api/sessions/${encodeURIComponent(id)}`
    )
  }

  interrupt(id: string): Promise<SandboxSession> {
    return this.request<SandboxSession>(
      `/api/sessions/${encodeURIComponent(id)}/interrupt`,
      { method: "POST" }
    )
  }

  restart(id: string): Promise<SandboxSession> {
    return this.request<SandboxSession>(
      `/api/sessions/${encodeURIComponent(id)}/restart`,
      { method: "POST" }
    )
  }

  async remove(id: string): Promise<void> {
    await this.request<unknown>(`/api/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (init.headers) {
      Object.assign(headers, init.headers)
    }
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    })
    if (!response.ok) {
      throw new Error(`kernel session request failed: ${response.status}`)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}
