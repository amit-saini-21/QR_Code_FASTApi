import io
import os
import uuid
from pathlib import Path

import dotenv
from fastapi import File, HTTPException, UploadFile
from PIL import Image
from typing import cast
from supabase import Client, create_client


PROJECT_ROOT = Path(__file__).resolve().parents[2]
dotenv.load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv(
    "SUPABASE_PUBLISHABLE_KEY"
)
IMAGE_BUCKET = os.getenv("IMAGE_BUCKET_NAME")

ALLOWED_FORMATS = {
    "image/png": ("PNG", ".png"),
    "image/jpeg": ("JPEG", ".jpg"),
}

ALLOWED_MEDIA_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
}

MAX_MEDIA_SIZE = 50 * 1024 * 1024

_supabase: Client | None = None


def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "Missing SUPABASE_URL or a Supabase key in the project .env file."
        )
    if not IMAGE_BUCKET:
        raise RuntimeError("Missing IMAGE_BUCKET_NAME in the project .env file.")

    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def image_to_bytes(image: Image.Image, content_type: str = "image/png") -> tuple[bytes, str]:
    if content_type not in ALLOWED_FORMATS:
        raise ValueError("Only PNG and JPEG images are supported.")

    pil_format, extension = ALLOWED_FORMATS[content_type]
    output = io.BytesIO()
    prepared_image = image.copy()

    if pil_format == "JPEG" and prepared_image.mode in ("RGBA", "P"):
        prepared_image = prepared_image.convert("RGB")

    prepared_image.save(output, format=pil_format)
    return output.getvalue(), extension


# def upload_pillow_image(image: Image.Image, content_type: str = "image/png") -> dict:
#     file_bytes, extension = image_to_bytes(image, content_type)
#     unique_path = f"uploads/{uuid.uuid4()}{extension}"

#     try:
#         client = get_supabase_client()
#         client.storage.from_(cast(str, IMAGE_BUCKET)).upload(
#             path=unique_path,
#             file=file_bytes,
#             file_options={
#                 "content-type": content_type,
#                 "cache-control": "3600",
#                 "upsert": "false",
#             },
#         )
#         public_url = client.storage.from_(cast(str, IMAGE_BUCKET)).get_public_url(unique_path)
#     except Exception as exc:
#         raise RuntimeError(f"Supabase storage upload failed: {exc}") from exc

#     return {
#         "message": "Image uploaded successfully.",
#         "path": unique_path,
#         "public_url": public_url,
#     }



async def upload_image(
    image: Image.Image,
    content_type: str = "image/png",
    user_id: int | None = None,
) -> dict:
    if content_type not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PNG and JPEG images are allowed.",
        )

    file_bytes = image_to_bytes(image, content_type)[0]
    owner_folder = f"{int(user_id)}" if user_id is not None else "unowned"
    unique_path = f"qrs/{owner_folder}/{uuid.uuid4()}{ALLOWED_FORMATS[content_type][1]}"

    try:
        client = get_supabase_client()
        client.storage.from_(cast(str, IMAGE_BUCKET)).upload(
            path=unique_path,
            file=file_bytes,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "false",
            },
        )
        public_url = client.storage.from_(cast(str, IMAGE_BUCKET)).get_public_url(unique_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Storage upload failed: {exc}",
        ) from exc

    return {
        "message": "Image uploaded successfully.",
        "path": unique_path,
        "public_url": public_url,
    }


async def upload_media_file(file: UploadFile, user_id: int) -> dict:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported media type.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_MEDIA_SIZE:
        raise HTTPException(status_code=413, detail="Media file must be 50 MB or smaller.")

    extension = ALLOWED_MEDIA_TYPES[content_type]
    unique_path = f"media/{int(user_id)}/{uuid.uuid4()}{extension}"

    try:
        client = get_supabase_client()
        client.storage.from_(cast(str, IMAGE_BUCKET)).upload(
            path=unique_path,
            file=file_bytes,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "false",
            },
        )
        public_url = client.storage.from_(cast(str, IMAGE_BUCKET)).get_public_url(unique_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Media upload failed: {exc}",
        ) from exc

    return {
        "message": "Media uploaded successfully.",
        "path": unique_path,
        "public_url": public_url,
        "file_name": file.filename or unique_path.rsplit("/", 1)[-1],
        "content_type": content_type,
        "file_size": len(file_bytes),
    }


async def upload_logo_file(file: UploadFile, user_id: int) -> dict:
    content_type = (file.content_type or "").lower()
    if content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=400, detail="Logo must be PNG, JPEG, or WebP.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Logo file is empty.")
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Logo must be 5 MB or smaller.")

    try:
        image = Image.open(io.BytesIO(file_bytes)).convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, format="PNG")
        file_bytes = output.getvalue()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid logo image.") from exc

    unique_path = f"logos/{int(user_id)}/{uuid.uuid4()}.png"
    try:
        client = get_supabase_client()
        client.storage.from_(cast(str, IMAGE_BUCKET)).upload(
            path=unique_path,
            file=file_bytes,
            file_options={
                "content-type": "image/png",
                "cache-control": "3600",
                "upsert": "false",
            },
        )
        public_url = client.storage.from_(cast(str, IMAGE_BUCKET)).get_public_url(unique_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Logo upload failed: {exc}") from exc

    return {
        "message": "Logo uploaded successfully.",
        "path": unique_path,
        "public_url": public_url,
    }


def remove_owned_storage_objects(qr_code, user_id: int) -> None:
    owner_prefixes = (
        f"qrs/{int(user_id)}/",
        f"media/{int(user_id)}/",
        f"logos/{int(user_id)}/",
    )
    paths: list[str] = []
    candidates = [
        getattr(qr_code, "qr_path", None),
        getattr(qr_code, "media_path", None),
        getattr(qr_code, "qr_logo", None),
    ]
    for path in candidates:
        if isinstance(path, str) and path.startswith(owner_prefixes):
            paths.append(path)
    if not paths:
        return

    client = get_supabase_client()
    client.storage.from_(cast(str, IMAGE_BUCKET)).remove(list(dict.fromkeys(paths)))
#manully uploading the default logo to supabase storage bucket
# from PIL import Image

# image = Image.open(r"D:\\Development\\Projects\\QR Generator\\app\services\\qr default logo.png")
# result = upload_pillow_image(image)

# print(result)