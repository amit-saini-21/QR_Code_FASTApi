from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database.database import get_db, get_qr_code
from database.schema import AuthUser, QRCode
from database.supabase_db import (
    IMAGE_BUCKET,
    get_supabase_client,
    remove_owned_storage_objects,
)
from utils.jwt import token_required


history_router = APIRouter(prefix="/api/v1/history", tags=["History"])


def _history_item(qr_code: QRCode) -> dict:
    public_url = qr_code.qr_path
    try:
        client = get_supabase_client()
        public_url = client.storage.from_(str(IMAGE_BUCKET)).get_public_url(qr_code.qr_path)
    except Exception:
        pass

    media_public_url = getattr(qr_code, "media_url", None)
    if not media_public_url:
        media_public_url = None

    return {
        "qr_id": qr_code.id,
        "title": qr_code.title,
        "qr_type": qr_code.qr_type,
        "content": qr_code.content,
        "qr_format": qr_code.qr_format,
        "qr_size": getattr(qr_code, "qr_size", None),
        "qr_color": getattr(qr_code, "qr_color", None),
        "background_color": getattr(qr_code, "background_color", None),
        "corner_eye_color": getattr(qr_code, "corner_eye_color", None),
        "qr_pattern_style": getattr(qr_code, "qr_pattern_style", None),
        "corner_eye_style": getattr(qr_code, "corner_eye_style", None),
        "media_name": getattr(qr_code, "media_name", None),
        "media_type": getattr(qr_code, "media_type", None),
        "media_size": getattr(qr_code, "media_size", None),
        "media_url": media_public_url,
        "qr_public_url": public_url,
        "created_at": qr_code.created_at,
    }


@history_router.get("", status_code=status.HTTP_200_OK)
def get_history(
    search: str | None = Query(None),
    qr_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    query = db.query(QRCode).filter(QRCode.user_id == current_user.id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (QRCode.title.ilike(pattern))
            | (QRCode.content.ilike(pattern))
            | (QRCode.media_name.ilike(pattern))
        )
    if qr_type:
        query = query.filter(QRCode.qr_type == qr_type)

    total = query.count()
    items = (
        query.order_by(QRCode.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_history_item(item) for item in items],
    }


@history_router.get("/stats", status_code=status.HTTP_200_OK)
def get_history_stats(
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    items = db.query(QRCode).filter(QRCode.user_id == current_user.id).all()
    types: dict[str, int] = {}
    media_count = 0
    media_bytes = 0
    for item in items:
        qr_type = item.qr_type or "text"
        types[qr_type] = types.get(qr_type, 0) + 1
        if getattr(item, "media_path", None):
            media_count += 1
            media_bytes += getattr(item, "media_size", None) or 0
    return {
        "total_qr_codes": len(items),
        "media_qr_codes": media_count,
        "media_bytes": media_bytes,
        "by_type": types,
    }


@history_router.get("/{qr_id}", status_code=status.HTTP_200_OK)
def get_history_item(
    qr_id: int,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_code = get_qr_code(db, qr_id, int(current_user.id))
    if not qr_code:
        raise HTTPException(status_code=404, detail="History item not found.")
    return _history_item(qr_code)


@history_router.delete("/{qr_id}", status_code=status.HTTP_200_OK)
def delete_history_item(
    qr_id: int,
    current_user: AuthUser = Depends(token_required),
    db: Session = Depends(get_db),
):
    qr_code = get_qr_code(db, qr_id, int(current_user.id))
    if not qr_code:
        raise HTTPException(status_code=404, detail="History item not found.")
    try:
        remove_owned_storage_objects(qr_code, int(current_user.id))
    except Exception:
        pass
    db.delete(qr_code)
    db.commit()
    return {"message": "History item deleted successfully.", "qr_id": qr_id}
