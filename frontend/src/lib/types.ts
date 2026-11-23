export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  created_at: string
}

export interface QRRecord {
  qr_id: number
  qr_type: string
  title: string
  content: string
  qr_format: "png" | "jpg" | "jpeg" | string
  qr_size: number
  qr_color: string
  background_color: string
  corner_eye_color: string
  qr_pattern_style: string
  corner_eye_style: string
  qr_logo?: string | null
  media_path?: string | null
  media_url?: string | null
  media_name?: string | null
  media_type?: string | null
  media_size?: number | null
  image?: string
  public_url?: string | null
  qr_public_url?: string | null
  created_at: string
}

export interface HistoryResponse {
  total: number
  limit: number
  offset: number
  items: QRRecord[]
}

export interface HistoryStats {
  total_qr_codes: number
  media_qr_codes: number
  media_bytes: number
  by_type: Record<string, number>
}

export interface MediaUploadResponse {
  path: string
  public_url: string
  file_name: string
  content_type: string
  file_size: number
}

export interface LogoUploadResponse {
  path: string
  public_url: string
  file_name: string
}

export interface QRPayload {
  qr_type: string
  content: string
  title: string
  qr_format: "png" | "jpg"
  qr_size: number
  qr_color: string
  background_color: string
  corner_eye_color: string
  qr_pattern_style: string
  corner_eye_style: string
  qr_logo: string | null
}
