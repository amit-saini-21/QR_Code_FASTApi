import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { authApi, historyApi, qrApi } from "@/lib/backend-api"
import type { QRPayload } from "@/lib/types"

const payload: QRPayload = {
  qr_type: "url",
  content: "https://example.com/launch",
  title: "Launch page",
  qr_format: "png",
  qr_size: 1024,
  qr_color: "#16211D",
  background_color: "#F5F8EF",
  corner_eye_color: "#16211D",
  qr_pattern_style: "square",
  corner_eye_style: "square",
  qr_logo: null,
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("QR backend flows", () => {
  it("starts authentication through the same-origin session proxy", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ authenticated: true }))

    await expect(authApi.login("alex@example.com", "Password!2")).resolves.toEqual({ authenticated: true })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/backend/api/v1/auth/login")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("same-origin")
    expect(JSON.parse(String(init.body))).toEqual({ email: "alex@example.com", password: "Password!2" })
  })

  it("requests a live preview image with the current QR settings", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } }))

    const image = await qrApi.preview(payload, new AbortController().signal)

    expect(image.type).toBe("image/png")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/backend/api/v1/qr/preview")
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual(payload)
  })

  it("saves a QR code using the backend generator", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ qr_id: 7, ...payload, created_at: "2026-11-23T00:00:00Z" }))

    const saved = await qrApi.generate(payload)

    expect(saved.qr_id).toBe(7)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/backend/api/v1/qr/generate")
    expect(init.method).toBe("POST")
  })

  it("loads searchable, paginated history", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ total: 1, limit: 12, offset: 0, items: [] }))

    await historyApi.list({ limit: 12, offset: 0, search: "launch page", qrType: "url" })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain("/api/backend/api/v1/history?")
    expect(url).toContain("search=launch+page")
    expect(url).toContain("qr_type=url")
  })

  it("deletes a QR code from the authenticated history", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: "QR code deleted" }))

    await expect(historyApi.delete(7)).resolves.toEqual({ message: "QR code deleted" })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/backend/api/v1/history/7")
    expect(init.method).toBe("DELETE")
  })
})
