import { describe, expect, it, vi } from "vitest"

import { SandboxSessionClient } from "./session-client"

describe("SandboxSessionClient", () => {
  it("creates a data-science session with a fresh Clerk bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session-1",
          profile: "data-science",
          status: "idle",
          proxyBaseUrl: "https://kernel.example/api/sessions/session-1/jupyter",
          connectionTicket: "ticket",
          expiresAt: "2026-07-10T00:00:00Z",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const getToken = vi.fn().mockResolvedValue("clerk")
    const client = new SandboxSessionClient(
      "https://kernel.example",
      getToken
    )

    await expect(client.create("data-science")).resolves.toMatchObject({
      id: "session-1",
      profile: "data-science",
    })
    expect(getToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://kernel.example/api/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer clerk" }),
      })
    )

    vi.unstubAllGlobals()
  })
})
