# QR Generator

A FastAPI application for generating, customizing, storing, downloading, updating, and sharing QR codes and media.

## Features

- JWT authentication and user-scoped data
- Text, URL, and media QR codes
- Custom QR and background colors
- Custom corner-eye colors and styles
- Square, rounded, and dotted patterns
- Uploadable logos and Supabase media
- PNG, JPG, and JPEG export
- Live QR preview without database or storage writes
- QR history, search, pagination, statistics, download, update, and deletion
- Supabase user-namespaced storage folders

## Project structure

```text
app/
  database/
    database.py
    schema.py
    supabase_db.py
  models/
    model.py
  routers/
    auth.py
    dashboard.py
    history.py
    qr.py
  services/
    qr_generate.py
  utils/
    common_utils.py
    hash.py
    jwt.py
  main.py
supabase_security.sql
API_CONTRACT.md
FRONTEND_PROMPT.md
```

## Requirements

- Python 3.11+
- Supabase project
- PostgreSQL or Supabase PostgreSQL database

## Environment variables

Create a project-root `.env` file:

```env
DATABASE_URL=postgresql://...
SECRET_KEY=replace-with-a-long-random-secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-server-only-service-role-key
IMAGE_BUCKET_NAME=photo
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `SECRET_KEY` in browser code.

## Install and run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd app
python -m uvicorn main:app --reload
```

Open:

- API: `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/api/v1/`

## Supabase setup

1. Create the storage bucket named by `IMAGE_BUCKET_NAME`.
2. Enable public bucket access for directly shareable QR and media URLs.
3. Open Supabase **SQL Editor**.
4. Run `supabase_security.sql`.
5. In **Storage → Policies**, remove policies that allow authenticated browser users to insert, update, or delete objects.

The FastAPI service-role key is server-only and is used for uploads and authorized cleanup.

## Security rules

- Every QR record is owned by `AuthUser.id`.
- Read, update, download, and delete operations include both QR ID and JWT user ID.
- Storage paths for media, logos, and QR images are user-namespaced.
- Update requests cannot accept media or storage paths.
- Public media URLs are shareable, but broad storage listing policies should not be enabled.

## Live preview

`POST /api/v1/qr/preview` generates a temporary image response. It does not save a database record or upload an image. Use it for live color, pattern, eye, size, and logo previews before calling `/generate` or `/update/{qr_id}`.

## Next.js frontend

The QR Studio frontend lives in `frontend/` and talks to the FastAPI backend through a same-origin Next.js proxy. The backend JWT is kept in an HttpOnly cookie and is never stored in browser storage.

Start FastAPI using the instructions above, then in another terminal run:

```sh
cd frontend
npm install
npm run dev
```

Set `BACKEND_API_URL` in `frontend/.env.local` to the FastAPI base URL (defaults to `http://127.0.0.1:8000`). For a deployment, configure this server-only environment variable to a backend URL reachable by the Next.js server; do not use a `NEXT_PUBLIC_` variable for it. `frontend/.env.example` shows the local default.

Run frontend checks from `frontend/`:

```sh
npm test
npm run lint
npm run build
```
