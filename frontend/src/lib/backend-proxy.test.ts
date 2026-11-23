import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/backend/[...path]/route"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("backend authentication proxy", () => {
  it("stores the backend JWT in an HttpOnly cookie without returning it to JavaScript", async () => {
    vi.stubEnv("BACKEND_API_URL", "https://backend.example")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ access_token: "private-backend-token", token_type: "bearer" }),
    ))
    const request = new NextRequest("http://localhost/api/backend/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alex@example.com", password: "Password!2" }),
    })

    const response = await POST(request, { params: Promise.resolve({ path: ["api", "v1", "auth", "login"] }) })

    expect(await response.json()).toEqual({ authenticated: true })
    expect(response.headers.get("set-cookie")).toContain("HttpOnly")
    expect(JSON.stringify(response)).not.toContain("private-backend-token")
    expect(fetch).toHaveBeenCalledWith(
      "https://backend.example/api/v1/auth/login",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("uses the Render backend URL when no override is configured", async () => {
    vi.stubEnv("BACKEND_API_URL", "")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "ok" })))
    const request = new NextRequest("http://localhost/api/backend/api/v1/history/stats", {
      method: "POST",
    })

    await POST(request, { params: Promise.resolve({ path: ["api", "v1", "history", "stats"] }) })

    expect(fetch).toHaveBeenCalledWith(
      "https://qr-code-fastapi.onrender.com/api/v1/history/stats",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("rejects cross-origin state-changing requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const request = new NextRequest("http://localhost/api/backend/api/v1/auth/logout", {
      method: "POST",
      headers: { origin: "https://untrusted.example" },
    })

    const response = await POST(request, { params: Promise.resolve({ path: ["api", "v1", "auth", "logout"] }) })

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
