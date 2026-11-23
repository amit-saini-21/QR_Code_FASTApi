import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAME = "qr_studio_access"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const METHODS = ["GET", "POST", "PUT", "DELETE"] as const

type RouteContext = {
  params: Promise<{ path: string[] }>
}

function backendUrl(path: string, search: string) {
  const base = (process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "")
  return `${base}/${path}${search}`
}

function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  })
}

function clearAuthCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  const backendPath = path.join("/")
  const isLogin = backendPath === "api/v1/auth/login"
  const isLogout = backendPath === "api/v1/auth/logout"
  const method = request.method

  if (![...METHODS].includes(method as (typeof METHODS)[number])) {
    return NextResponse.json({ detail: "Method not allowed." }, { status: 405 })
  }

  const origin = request.headers.get("origin")
  if (method !== "GET" && origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) {
        return NextResponse.json({ detail: "Cross-origin request rejected." }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ detail: "Invalid request origin." }, { status: 403 })
    }
  }

  const headers = new Headers()
  const contentType = request.headers.get("content-type")
  const accept = request.headers.get("accept")
  if (contentType) headers.set("content-type", contentType)
  if (accept) headers.set("accept", accept)

  const accessToken = request.cookies.get(COOKIE_NAME)?.value
  if (accessToken && !isLogin && !backendPath.endsWith("/auth/register")) {
    headers.set("authorization", `Bearer ${accessToken}`)
  }

  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    cache: "no-store",
    redirect: "manual",
  }

  if (method !== "GET" && method !== "DELETE" && request.body) {
    init.body = request.body
    init.duplex = "half"
  }

  try {
    const upstream = await fetch(backendUrl(backendPath, request.nextUrl.search), init)

    if (isLogin && upstream.ok) {
      const payload = (await upstream.clone().json().catch(() => null)) as
        | { access_token?: string }
        | null
      if (!payload?.access_token) {
        return NextResponse.json({ detail: "The backend did not return an access token." }, { status: 502 })
      }
      const response = NextResponse.json({ authenticated: true }, { status: 200 })
      setAuthCookie(response, payload.access_token)
      response.headers.set("cache-control", "no-store")
      return response
    }

    const responseHeaders = new Headers()
    const upstreamType = upstream.headers.get("content-type")
    const disposition = upstream.headers.get("content-disposition")
    if (upstreamType) responseHeaders.set("content-type", upstreamType)
    if (disposition) responseHeaders.set("content-disposition", disposition)
    responseHeaders.set("cache-control", "no-store")

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })

    if (isLogout || upstream.status === 401) clearAuthCookie(response)
    return response
  } catch {
    const response = NextResponse.json(
      { detail: "Could not reach the QR backend. Check BACKEND_API_URL and confirm the FastAPI server is running." },
      { status: 502 },
    )
    if (isLogout) clearAuthCookie(response)
    return response
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context)
}
