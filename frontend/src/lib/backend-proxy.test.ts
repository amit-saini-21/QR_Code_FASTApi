import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "@/app/api/backend/[...path]/route"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("backend authentication proxy", () => {
  it("stores the backend JWT in a partitioned production cookie without returning it to JavaScript", async () => {
    vi.stubEnv("NODE_ENV", "production")
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
    const setCookie = response.headers.get("set-cookie")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Secure")
    expect(setCookie).toMatch(/SameSite=none/i)
    expect(setCookie).toContain("Partitioned")
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

  it("accepts browser-verified same-origin requests through an internal proxy host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "ok" })))
    const request = new NextRequest("http://internal-host/api/backend/api/v1/history/stats", {
      method: "POST",
      headers: {
        origin: "https://qr-studio.vercel.app",
        "sec-fetch-site": "same-origin",
      },
    })

    const response = await POST(request, { params: Promise.resolve({ path: ["api", "v1", "history", "stats"] }) })

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it("does not clear the session cookie for an unauthenticated session check", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ detail: "Not authenticated" }, { status: 401 }),
    ))
    const request = new NextRequest("http://localhost/api/backend/api/v1/auth/me")

    const response = await GET(request, { params: Promise.resolve({ path: ["api", "v1", "auth", "me"] }) })

    expect(response.status).toBe(401)
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  it("clears the matching partitioned cookie on logout", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "logged out" })))
    const request = new NextRequest("https://qr-studio.vercel.app/api/backend/api/v1/auth/logout", {
      method: "POST",
    })

    const response = await POST(request, { params: Promise.resolve({ path: ["api", "v1", "auth", "logout"] }) })
    const setCookie = response.headers.get("set-cookie")

    expect(setCookie).toContain("Max-Age=0")
    expect(setCookie).toMatch(/SameSite=none/i)
    expect(setCookie).toContain("Secure")
    expect(setCookie).toContain("Partitioned")
  })

  it("rejects cross-origin state-changing requests", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const request = new NextRequest("http://localhost/api/backend/api/v1/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://untrusted.example",
        "sec-fetch-site": "cross-site",
      },
    })

    const response = await POST(request, { params: Promise.resolve({ path: ["api", "v1", "auth", "logout"] }) })

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
