from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Response
from io import BytesIO
from sqlalchemy.orm import Session

from database.schema import AuthUser, QRCode
from database.database import (
    get_db,
    save_qr_code,
    get_qr_code,
    update_qr_code,
)
from database.supabase_db import (
    ALLOWED_FORMATS,
    IMAGE_BUCKET,
    get_supabase_client,
    upload_image,
    upload_media_file,
    upload_logo_file,
    remove_owned_storage_objects,
)
from models.model import QRCodeData, QRCodeNewData
from services.qr_generate import generate_qr_code_image
from utils.jwt import token_required


qr_router = APIRouter(prefix="/api/v1/qr", tags=["QR Code"])


def _owned_logo_path(path: str | None, user_id: int) -> str | None:
    if not path:
        return None
    if path.startswith(f"logos/{int(user_id)}/"):
        return path
    raise HTTPException(status_code=400, detail="Logo must be uploaded by your account.")


def _owned_qr_logo(qr_code, user_id: int) -> str | None:
    path = getattr(qr_code, "qr_logo", None)
    if isinstance(path, str) and path.startswith(f"logos/{int(user_id)}/"):
        return path
    return None


def _preview_response(image, qr_format: str) -> Response:
    output = BytesIO()
    if qr_format == "png":
        image.save(output, format="PNG")
        media_type = "image/png"
    else:
        image.convert("RGB").save(output, format="JPEG", quality=95)
        media_type = "image/jpeg"
    return Response(
        content=output.getvalue(),
        media_type=media_type,
        headers={"Cache-Control": "no-store"},
    )


def _qr_response(qr_code, db_public_url: bool = True) -> dict:
    public_url = None
    try:
        client = get_supabase_client()
        public_url = client.storage.from_(str(IMAGE_BUCKET)).get_public_url(qr_code.qr_path)
    except Exception:
        public_url = qr_code.qr_path

    return {
        "qr_id": qr_code.id,
        "qr_type": qr_code.qr_type,
        "title": qr_code.title,
        "content": qr_code.content,
        "qr_format": qr_code.qr_format,
        "qr_size": qr_code.qr_size,
        "qr_color": qr_code.qr_color,
        "background_color": qr_code.background_color,
        "corner_eye_color": qr_code.corner_eye_color,
        "qr_pattern_style": qr_code.qr_pattern_style,
        "corner_eye_style": qr_code.corner_eye_style,
        "qr_logo": qr_code.qr_logo,
        "media_path": getattr(qr_code, "media_path", None),
        "media_url": getattr(qr_code, "media_url", None),
        "media_name": getattr(qr_code, "media_name", None),
        "media_type": getattr(qr_code, "media_type", None),
        "media_size": getattr(qr_code, "media_size", None),
        "image": qr_code.qr_path,
        "public_url": public_url,
        "created_at": qr_code.created_at,
    }


@qr_router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_qr_code(
    data: QRCodeData,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_format = (data.qr_format or "png").lower()
    if qr_format not in ("png", "jpg", "jpeg"):
        raise HTTPException(status_code=400, detail="Format must be png, jpg, or jpeg.")
    if qr_format == "jpeg":
        qr_format = "jpg"

    logo_path = _owned_logo_path(data.qr_logo, int(current_user.id))

    try:
        generated = generate_qr_code_image(
            content=data.content,
            qr_color=data.qr_color or "#111827",
            background_color=data.background_color or "#FFFFFF",
            corner_eye_color=data.corner_eye_color or data.qr_color or "#111827",
            qr_size=data.qr_size or 1024,
            qr_pattern_style=data.qr_pattern_style or "rounded",
            corner_eye_style=data.corner_eye_style or "rounded",
            logo_path=logo_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    content_type = "image/png" if qr_format == "png" else "image/jpeg"
    upload = await upload_image(generated["image"], content_type, int(current_user.id))
    image_path = upload["path"]

    qr_code = save_qr_code(
        db,
        int(current_user.id),
        data.qr_type,
        data.content.strip(),
        data.title or "Untitled QR",
        qr_format,
        image_path,
        qr_size=data.qr_size or 1024,
        qr_color=data.qr_color or "#111827",
        background_color=data.background_color or "#FFFFFF",
        corner_eye_color=data.corner_eye_color or data.qr_color or "#111827",
        qr_pattern_style=data.qr_pattern_style or "rounded",
        corner_eye_style=data.corner_eye_style or "rounded",
        qr_logo=logo_path,
    )
    return _qr_response(qr_code)


@qr_router.post("/preview", status_code=status.HTTP_200_OK)
def preview_qr_code(
    data: QRCodeData,
    current_user: AuthUser = Depends(token_required),
):
    qr_format = (data.qr_format or "png").lower()
    if qr_format not in ("png", "jpg", "jpeg"):
        raise HTTPException(status_code=400, detail="Format must be png, jpg, or jpeg.")
    if qr_format == "jpeg":
        qr_format = "jpg"

    logo_path = _owned_logo_path(data.qr_logo, int(current_user.id))
    try:
        generated = generate_qr_code_image(
            content=data.content,
            qr_color=data.qr_color or "#111827",
            background_color=data.background_color or "#FFFFFF",
            corner_eye_color=data.corner_eye_color or data.qr_color or "#111827",
            qr_size=data.qr_size or 1024,
            qr_pattern_style=data.qr_pattern_style or "rounded",
            corner_eye_style=data.corner_eye_style or "rounded",
            logo_path=logo_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _preview_response(generated["image"], qr_format)


@qr_router.post("/media/upload", status_code=status.HTTP_201_CREATED)
async def upload_shareable_media(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(token_required),
):
    return await upload_media_file(file, int(current_user.id))


@qr_router.post("/logo/upload", status_code=status.HTTP_201_CREATED)
async def upload_qr_logo(
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(token_required),
):
    return await upload_logo_file(file, int(current_user.id))


@qr_router.post("/media/generate", status_code=status.HTTP_201_CREATED)
async def generate_media_qr(
    file: UploadFile = File(...),
    title: str = Form("Shared media"),
    qr_format: str = Form("png"),
    qr_size: int = Form(1024),
    qr_color: str = Form("#111827"),
    background_color: str = Form("#FFFFFF"),
    corner_eye_color: str = Form("#111827"),
    qr_pattern_style: str = Form("rounded"),
    corner_eye_style: str = Form("rounded"),
    qr_logo: str | None = Form(None),
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_format = qr_format.lower()
    if qr_format not in ("png", "jpg", "jpeg"):
        raise HTTPException(status_code=400, detail="Format must be png, jpg, or jpeg.")
    if qr_format == "jpeg":
        qr_format = "jpg"

    logo_path = _owned_logo_path(qr_logo, int(current_user.id))
    media = await upload_media_file(file, int(current_user.id))
    try:
        generated = generate_qr_code_image(
            content=media["public_url"],
            qr_color=qr_color,
            background_color=background_color,
            corner_eye_color=corner_eye_color,
            qr_size=qr_size,
            qr_pattern_style=qr_pattern_style,
            corner_eye_style=corner_eye_style,
            logo_path=logo_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    content_type = "image/png" if qr_format == "png" else "image/jpeg"
    qr_upload = await upload_image(generated["image"], content_type, int(current_user.id))
    qr_code = save_qr_code(
        db,
        int(current_user.id),
        "media",
        media["public_url"],
        title.strip() or "Shared media",
        qr_format,
        qr_upload["path"],
        qr_size=qr_size,
        qr_color=qr_color,
        background_color=background_color,
        corner_eye_color=corner_eye_color,
        qr_pattern_style=qr_pattern_style,
        corner_eye_style=corner_eye_style,
        qr_logo=logo_path,
        media_path=media["path"],
        media_url=media["public_url"],
        media_name=media["file_name"],
        media_type=media["content_type"],
        media_size=media["file_size"],
    )
    return _qr_response(qr_code)


@qr_router.get("", status_code=status.HTTP_200_OK)
def list_qr_codes(
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_codes = (
        db.query(QRCode)
        .filter(QRCode.user_id == current_user.id)
        .order_by(QRCode.created_at.desc())
        .all()
    )
    return [_qr_response(qr_code) for qr_code in qr_codes]


@qr_router.get("/{qr_id}", status_code=status.HTTP_200_OK)
def get_qr_code_by_id(
    qr_id: int,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_code = get_qr_code(db, qr_id, int(current_user.id))
    if not qr_code:
        raise HTTPException(status_code=404, detail="QR code not found.")
    return _qr_response(qr_code)


def _download_stored_qr(qr_id: int, current_user: AuthUser, db: Session) -> Response:
    qr_code = get_qr_code(db, qr_id, int(current_user.id))
    if not qr_code:
        raise HTTPException(status_code=404, detail="QR code not found.")
    try:
        client = get_supabase_client()
        image_bytes = client.storage.from_(str(IMAGE_BUCKET)).download(qr_code.qr_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Stored QR image could not be downloaded.") from exc

    qr_format = (qr_code.qr_format or "png").lower()
    media_type = "image/png" if qr_format == "png" else "image/jpeg"
    extension = "png" if qr_format == "png" else "jpg"
    safe_title = "".join(
        character if character.isalnum() or character in ("-", "_") else "_"
        for character in (qr_code.title or "qr-code")
    ).strip("_") or "qr-code"
    headers = {"Content-Disposition": f'attachment; filename="{safe_title}.{extension}"'}
    return Response(content=image_bytes, media_type=media_type, headers=headers)


@qr_router.post("/download", status_code=status.HTTP_200_OK)
def download_qr_code(
    data: QRCodeData,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    if not data.qr_id:
        raise HTTPException(status_code=400, detail="QR code ID is required.")
    return _download_stored_qr(int(data.qr_id), current_user, db)


@qr_router.get("/download/{qr_id}", status_code=status.HTTP_200_OK)
def download_qr_code_get(
    qr_id: int,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    return _download_stored_qr(qr_id, current_user, db)


@qr_router.put("/update/{qr_id}", status_code=status.HTTP_200_OK)
async def update_qr_code_by_id(
    qr_id: int,
    data: QRCodeNewData,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_code = get_qr_code(db, qr_id, int(current_user.id))
    if not qr_code:
        raise HTTPException(status_code=404, detail="QR code not found.")

    qr_format = (data.qr_format or qr_code.qr_format or "png").lower()
    if qr_format not in ("png", "jpg", "jpeg"):
        raise HTTPException(status_code=400, detail="Format must be png, jpg, or jpeg.")
    if qr_format == "jpeg":
        qr_format = "jpg"

    qr_type = data.qr_type or qr_code.qr_type
    content = data.content if data.content is not None else qr_code.content
    title = data.title if data.title is not None else qr_code.title
    qr_size = data.qr_size or qr_code.qr_size or 1024
    qr_color = data.qr_color or qr_code.qr_color or "#111827"
    background_color = data.background_color or qr_code.background_color or "#FFFFFF"
    corner_eye_color = data.corner_eye_color or qr_code.corner_eye_color or qr_color
    pattern_style = data.qr_pattern_style or qr_code.qr_pattern_style or "rounded"
    eye_style = data.corner_eye_style or qr_code.corner_eye_style or "rounded"
    logo_path = (
        _owned_logo_path(data.qr_logo, int(current_user.id))
        if data.qr_logo is not None
        else _owned_qr_logo(qr_code, int(current_user.id))
    )
    media_path = getattr(qr_code, "media_path", None)
    media_url = getattr(qr_code, "media_url", None)
    media_name = getattr(qr_code, "media_name", None)
    media_type = getattr(qr_code, "media_type", None)
    media_size = getattr(qr_code, "media_size", None)

    try:
        generated = generate_qr_code_image(
            content=content or "",
            qr_color=qr_color,
            background_color=background_color,
            corner_eye_color=corner_eye_color,
            qr_size=qr_size,
            qr_pattern_style=pattern_style,
            corner_eye_style=eye_style,
            logo_path=logo_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    content_type = "image/png" if qr_format == "png" else "image/jpeg"
    upload = await upload_image(generated["image"], content_type, int(current_user.id))

    updated = update_qr_code(
        db,
        qr_id,
        int(current_user.id),
        qr_type,
        content,
        title,
        qr_format,
        upload["path"],
        qr_size=qr_size,
        qr_color=qr_color,
        background_color=background_color,
        corner_eye_color=corner_eye_color,
        qr_pattern_style=pattern_style,
        corner_eye_style=eye_style,
        qr_logo=logo_path,
        media_path=media_path,
        media_url=media_url,
        media_name=media_name,
        media_type=media_type,
        media_size=media_size,
    )
    return _qr_response(updated)


@qr_router.post("/update_qr", status_code=status.HTTP_200_OK)
async def update_qr_code_legacy(
    data: QRCodeNewData,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    if not data.qr_id:
        raise HTTPException(status_code=400, detail="QR code ID is required.")
    return await update_qr_code_by_id(data.qr_id, data, current_user, db)


@qr_router.delete("/{qr_id}", status_code=status.HTTP_200_OK)
def delete_qr_code(
    qr_id: int,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_code = get_qr_code(db, qr_id, int(current_user.id))
    if not qr_code:
        raise HTTPException(status_code=404, detail="QR code not found.")

    try:
        remove_owned_storage_objects(qr_code, int(current_user.id))
    except Exception:
        pass
    db.delete(qr_code)
    db.commit()
    return {"message": "QR code deleted successfully.", "qr_id": qr_id}
