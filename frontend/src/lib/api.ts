export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload) return payload
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg)
          }
          return String(item)
        })
        .join(" · ")
    }
  }
  if (payload && typeof payload === "object" && "message" in payload) {
    return String((payload as { message: unknown }).message)
  }
  return fallback
}

async function readError(response: Response) {
  const text = await response.text().catch(() => "")
  if (!text) return `Request failed (${response.status}).`
  try {
    return errorMessage(JSON.parse(text), `Request failed (${response.status}).`)
  } catch {
    return errorMessage(text, `Request failed (${response.status}).`)
  }
}

function announceUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("qr-studio:unauthorized"))
  }
}

export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  })

  announceUnauthorized(response.status)

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) return (await response.json()) as T
  return (await response.text()) as T
}

export async function apiBlob(url: string, signal?: AbortSignal, init: RequestInit = {}): Promise<Blob> {
  const response = await fetch(url, {
    ...init,
    method: init.method ?? "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  })

  announceUnauthorized(response.status)

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status)
  }

  return response.blob()
}

export function saveBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function friendlyDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently created"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}
