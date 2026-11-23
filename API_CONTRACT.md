# Frontend API Contract

Base URL: `http://127.0.0.1:8000`

Authentication:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Use `Bearer` for every endpoint except registration and login.

## Data formats

### UserCreate

```json
{
  "name": "Amit Saini",
  "email": "user@example.com",
  "password": "Password1!",
  "confirm_password": "Password1!"
}
```

### QR settings

```json
{
  "qr_id": 1,
  "qr_type": "url",
  "content": "https://example.com",
  "title": "My QR",
  "qr_format": "png",
  "qr_size": 1024,
  "qr_color": "#111827",
  "background_color": "#FFFFFF",
  "corner_eye_color": "#7C3AED",
  "qr_pattern_style": "rounded",
  "corner_eye_style": "rounded",
  "qr_logo": "logos/12/uuid.png"
}
```

Allowed values:

| Field | Values |
|---|---|
| `qr_format` | `png`, `jpg`, `jpeg` |
| `qr_pattern_style` | `square`, `rounded`, `dot` |
| `corner_eye_style` | `square`, `rounded`, `dot` |
| `qr_size` | `256` to `2048` |
| `qr_color`, `background_color`, `corner_eye_color` | Hex color such as `#7C3AED` |

## Authentication endpoints

| Method | URL | Request | Success response |
|---|---|---|---|
| POST | `/api/v1/auth/register` | `UserCreate` | `201 { "message", "name", "email", "id" }` |
| POST | `/api/v1/auth/login` | `{ "email": "user@example.com", "password": "Password1!" }` | `200 { "access_token", "token_type" }` |
| GET | `/api/v1/auth/me` | No body | `200 UserResponse` |
| POST | `/api/v1/auth/logout` | No body | `200 { "message" }` |

## QR endpoints

| Method | URL | Request | Success response |
|---|---|---|---|
| POST | `/api/v1/qr/generate` | `QR settings` JSON | `201 QR record` |
| POST | `/api/v1/qr/preview` | `QR settings` JSON | `200 PNG/JPEG binary image` |
| GET | `/api/v1/qr` | No body | `200 QR record[]` |
| GET | `/api/v1/qr/{qr_id}` | No body | `200 QR record` |
| POST | `/api/v1/qr/download` | `{ "qr_id": 1 }` | `200 binary attachment` |
| GET | `/api/v1/qr/download/{qr_id}` | No body | `200 binary attachment` |
| PUT | `/api/v1/qr/update/{qr_id}` | Partial `QR settings` JSON | `200 updated QR record` |
| POST | `/api/v1/qr/update_qr` | `{ "qr_id": 1, ...settings }` | `200 updated QR record` |
| DELETE | `/api/v1/qr/{qr_id}` | No body | `200 { "message", "qr_id" }` |

### Generate preview

```http
POST /api/v1/qr/preview
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "qr_type": "url",
  "content": "https://example.com",
  "title": "Example",
  "qr_format": "png",
  "qr_size": 512,
  "qr_color": "#7C3AED",
  "background_color": "#FFF7ED",
  "corner_eye_color": "#EC4899",
  "qr_pattern_style": "dot",
  "corner_eye_style": "rounded"
}
```

The preview endpoint returns raw image bytes and `Cache-Control: no-store`. It does not upload or save anything.

### QR response

```json
{
  "qr_id": 1,
  "qr_type": "url",
  "title": "Example",
  "content": "https://example.com",
  "qr_format": "png",
  "qr_size": 512,
  "qr_color": "#7C3AED",
  "background_color": "#FFF7ED",
  "corner_eye_color": "#EC4899",
  "qr_pattern_style": "dot",
  "corner_eye_style": "rounded",
  "qr_logo": null,
  "media_path": null,
  "media_url": null,
  "media_name": null,
  "media_type": null,
  "media_size": null,
  "image": "qrs/12/uuid.png",
  "public_url": "https://.../photo/public/qrs/12/uuid.png",
  "created_at": "2026-11-23T10:00:00"
}
```

## Logo and media upload endpoints

All uploads use `multipart/form-data`.

| Method | URL | Form field | Success response |
|---|---|---|---|
| POST | `/api/v1/qr/logo/upload` | `file` | `{ "path", "public_url", "message" }` |
| POST | `/api/v1/qr/media/upload` | `file` | `{ "path", "public_url", "file_name", "content_type", "file_size", "message" }` |
| POST | `/api/v1/qr/media/generate` | `file` plus form settings | QR record |

Logo limits:

- PNG, JPEG, or WebP
- Maximum 5 MB
- Converted to PNG and resized to 512 pixels

Media limits:

- JPEG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, WAV, Ogg, or PDF
- Maximum 50 MB

Media generate form fields:

```text
file
title
qr_format
qr_size
qr_color
background_color
corner_eye_color
qr_pattern_style
corner_eye_style
qr_logo
```

## History endpoints

| Method | URL | Request | Success response |
|---|---|---|---|
| GET | `/api/v1/history` | Query: `search`, `qr_type`, `limit`, `offset` | `{ "total", "limit", "offset", "items" }` |
| GET | `/api/v1/history/stats` | No body | `{ "total_qr_codes", "media_qr_codes", "media_bytes", "by_type" }` |
| GET | `/api/v1/history/{qr_id}` | No body | `200 History item` |
| DELETE | `/api/v1/history/{qr_id}` | No body | `{ "message", "qr_id" }` |

Example:

```http
GET /api/v1/history?search=example&limit=20&offset=0
Authorization: Bearer <access_token>
```

## Error format

FastAPI validation and application errors generally use:

```json
{
  "detail": "A human-readable error."
}
```

Common status codes:

| Status | Meaning |
|---|---|
| 400 | Invalid format, color, path, or content |
| 401 | Missing or invalid JWT |
| 404 | QR or history record not owned by the authenticated user |
| 413 | Upload exceeds its size limit |
| 422 | Invalid JSON or missing required field |
| 500 | Supabase, database, or server failure |
