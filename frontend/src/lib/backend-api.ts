import { apiBlob, apiRequest } from "@/lib/api"
import type { HistoryResponse, HistoryStats, LogoUploadResponse, MediaUploadResponse, QRPayload, QRRecord, User } from "@/lib/types"

const API_ROOT = "/api/backend/api/v1"

export interface RegisterInput {
  name: string
  email: string
  password: string
  confirm_password: string
}

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<{ authenticated: boolean }>(`${API_ROOT}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  },
  register(input: RegisterInput) {
    return apiRequest<{ message?: string }>(`${API_ROOT}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
  },
  currentUser() {
    return apiRequest<User>(`${API_ROOT}/auth/me`)
  },
  logout() {
    return apiRequest<{ message?: string }>(`${API_ROOT}/auth/logout`, { method: "POST" })
  },
}

export const qrApi = {
  preview(payload: QRPayload, signal?: AbortSignal) {
    return apiBlob(`${API_ROOT}/qr/preview`, signal, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  },
  uploadLogo(file: File) {
    const form = new FormData()
    form.append("file", file)
    return apiRequest<LogoUploadResponse>(`${API_ROOT}/qr/logo/upload`, { method: "POST", body: form })
  },
  uploadMedia(file: File) {
    const form = new FormData()
    form.append("file", file)
    return apiRequest<MediaUploadResponse>(`${API_ROOT}/qr/media/upload`, { method: "POST", body: form })
  },
  generate(payload: QRPayload) {
    return apiRequest<QRRecord>(`${API_ROOT}/qr/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  },
  generateMedia(file: File, payload: QRPayload) {
    const form = new FormData()
    form.append("file", file)
    Object.entries(payload).forEach(([key, value]) => {
      if (key !== "qr_type" && key !== "content" && value !== null) form.append(key, String(value))
    })
    return apiRequest<QRRecord>(`${API_ROOT}/qr/media/generate`, { method: "POST", body: form })
  },
  get(id: number) {
    return apiRequest<QRRecord>(`${API_ROOT}/qr/${id}`)
  },
  update(id: number, payload: QRPayload) {
    return apiRequest<QRRecord>(`${API_ROOT}/qr/update/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  },
  download(id: number) {
    return apiBlob(`${API_ROOT}/qr/download/${id}`)
  },
}

export interface HistoryQuery {
  limit: number
  offset: number
  search?: string
  qrType?: string
}

export const historyApi = {
  list(query: HistoryQuery) {
    const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
    if (query.search) params.set("search", query.search)
    if (query.qrType && query.qrType !== "all") params.set("qr_type", query.qrType)
    return apiRequest<HistoryResponse>(`${API_ROOT}/history?${params.toString()}`)
  },
  stats() {
    return apiRequest<HistoryStats>(`${API_ROOT}/history/stats`)
  },
  delete(id: number) {
    return apiRequest<{ message?: string }>(`${API_ROOT}/history/${id}`, { method: "DELETE" })
  },
}
