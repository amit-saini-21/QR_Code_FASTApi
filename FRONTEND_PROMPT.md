# Frontend AI Prompt

Build a polished, responsive QR Generator frontend using React and TypeScript for the existing FastAPI backend. The delivered app must be production-ready, mobile-first, accessible, and closely connected to every endpoint in `API_CONTRACT.md`.

## Product goals

Create an authenticated application where users can:

- Register and log in.
- Generate custom QR codes.
- Preview every visual change before saving.
- Upload a logo and optionally upload media.
- Generate a QR that opens uploaded media.
- Download the final QR.
- Search, browse, edit, duplicate, and delete QR history.
- View history statistics.
- Log out safely.

## Visual direction

- Use a modern dark/indigo or warm creative design with strong contrast.
- Use a three-column desktop layout: content fields, customization controls, and live preview.
- Collapse into clear stacked sections on mobile.
- Use rounded cards, restrained shadows, clean typography, and accessible focus states.
- Never make the preview visually dominate incorrectly sized content.
- Include loading, empty, success, validation, unauthorized, and server-error states.

## Required screens

1. Authentication:
   - Login form
   - Registration form
   - Password visibility controls
   - Password-complexity feedback

2. Generator:
   - Title
   - QR type
   - Content or URL
   - Format: PNG/JPG
   - Size control
   - QR color
   - Background color
   - Corner-eye color
   - QR pattern style
   - Corner-eye style
   - Logo upload
   - Media upload and media QR generation

3. Live preview:
   - Show a debounced preview of `/api/v1/qr/preview`.
   - Call preview only after content and valid color values are present.
   - Display preview loading state without flicker.
   - Cancel stale preview requests.
   - Never persist preview images.
   - Let the user reset customization values.

4. History:
   - Paginated cards or table
   - Search and QR type filters
   - Thumbnail, title, content, format, date, and media details
   - Download, edit, duplicate, and delete actions
   - Confirmation dialog before deleting

5. Edit flow:
   - Load existing data through `/api/v1/qr/{qr_id}`.
   - Preview edits through `/api/v1/qr/preview`.
   - Save through `/api/v1/qr/update/{qr_id}`.
   - Preserve media fields and logos without exposing storage paths as editable values.

## API integration

- Base URL: environment variable `VITE_API_BASE_URL`, default `http://127.0.0.1:8000`.
- Store the access token in memory or a secure http-only flow if the backend provides it; do not expose secrets.
- Attach `Authorization: Bearer <token>` to protected requests.
- Handle 401 by clearing auth state and redirecting to login.
- Render FastAPI `detail` errors clearly.
- Use `FormData` for logo and media uploads.
- Use `Blob` and object URLs for preview and downloads.
- Revoke preview and download object URLs after use.

## UX details

- Debounce preview requests by 300-500 ms.
- Keep the last valid preview visible while a new preview loads.
- Do not call generate or update just to preview changes.
- Show a warning for QR content that is too long or unsupported.
- Validate hex colors and file types before requests.
- Add copy-to-clipboard for media or QR public URLs.
- Provide aria labels for colors and icon-only buttons.
- Support keyboard navigation and visible focus states.

## Backend contract files

Read and implement:

- `API_CONTRACT.md`
- `README.md`
- `app/models/model.py`
- `app/routers/auth.py`
- `app/routers/qr.py`
- `app/routers/history.py`

Do not invent endpoint names or fields. Do not send Supabase service-role keys or secrets to the frontend.

## Deliverables

- Complete source code
- Central API client
- Auth context/store
- Typed request and response models
- Live preview hook
- Reusable components
- Environment example
- Setup instructions
- Basic tests for authentication, preview, save, history, and delete flows
