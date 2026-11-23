from io import BytesIO
from pathlib import Path
import qrcode
from PIL import Image, ImageColor, ImageDraw

from app.database.supabase_db import IMAGE_BUCKET, get_supabase_client


DEFAULT_LOGO_PATH = Path(__file__).resolve().parent / "default_logo.png"


def _valid_color(value: str | None, fallback: str) -> str:
    value = (value or "").strip()
    if value:
        try:
            ImageColor.getrgb(value)
            return value
        except ValueError:
            pass
    return fallback


def _is_finder_cell(row: int, column: int, size: int) -> bool:
    return (
        (row < 7 and column < 7)
        or (row < 7 and column >= size - 7)
        or (row >= size - 7 and column < 7)
    )


def _draw_finder(
    draw: ImageDraw.ImageDraw,
    left: int,
    top: int,
    module: int,
    background: str,
    eye_color: str,
    eye_style: str,
) -> None:
    outer_left = round(left)
    outer_top = round(top)
    outer_right = round(left + 7 * module)
    outer_bottom = round(top + 7 * module)
    box = (outer_left, outer_top, outer_right, outer_bottom)
    if eye_style == "dot":
        draw.ellipse(box, fill=eye_color)
        draw.ellipse(
            (round(left + module), round(top + module),
             round(left + 6 * module), round(top + 6 * module)),
            fill=background,
        )
        draw.ellipse(
            (round(left + 2 * module), round(top + 2 * module),
             round(left + 5 * module), round(top + 5 * module)),
            fill=eye_color,
        )
    elif eye_style == "rounded":
        radius = max(module, module * 2)
        draw.rounded_rectangle(box, radius=radius, fill=eye_color)
        draw.rounded_rectangle(
            (left + module, top + module, left + 6 * module, top + 6 * module),
            radius=radius,
            fill=background,
        )
        draw.rounded_rectangle(
            (round(left + 2 * module), round(top + 2 * module),
             round(left + 5 * module), round(top + 5 * module)),
            radius=radius,
            fill=eye_color,
        )
    else:
        draw.rectangle(box, fill=eye_color)
        draw.rectangle(
            (left + module, top + module, left + 6 * module, top + 6 * module),
            fill=background,
        )
        draw.rectangle(
            (left + 2 * module, top + 2 * module, left + 5 * module, top + 5 * module),
            fill=eye_color,
        )


def generate_qr_code_image(
    content: str,
    qr_color: str = "#111827",
    background_color: str = "#FFFFFF",
    corner_eye_color: str = "#111827",
    qr_size: int = 1024,
    qr_pattern_style: str = "rounded",
    corner_eye_style: str = "rounded",
    logo_path: str | None = None,
) -> dict:
    content = (content or "").strip()
    if not content:
        raise ValueError("QR content cannot be empty.")

    qr_color = _valid_color(qr_color, "#111827")
    background_color = _valid_color(background_color, "#FFFFFF")
    corner_eye_color = _valid_color(corner_eye_color, qr_color)
    qr_size = max(256, min(int(qr_size or 1024), 2048))

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(content)
    qr.make(fit=True)

    matrix = qr.get_matrix()
    matrix_size = len(matrix)
    module = qr_size / (matrix_size + 8)
    canvas_size = qr_size
    image = Image.new("RGB", (canvas_size, canvas_size), background_color)
    draw = ImageDraw.Draw(image)
    offset = 4 * module

    for row, modules in enumerate(matrix):
        for column, enabled in enumerate(modules):
            if not enabled or _is_finder_cell(row, column, matrix_size):
                continue
            left = round(offset + column * module)
            top = round(offset + row * module)
            right = round(offset + (column + 1) * module)
            bottom = round(offset + (row + 1) * module)
            box = (left, top, right, bottom)
            if qr_pattern_style == "dot":
                inset = max(1, round(module / 5))
                draw.ellipse(
                    (left + inset, top + inset, right - inset, bottom - inset),
                    fill=qr_color,
                )
            elif qr_pattern_style == "rounded":
                draw.rounded_rectangle(
                    box,
                    radius=max(1, round(module / 3)),
                    fill=qr_color,
                )
            else:
                draw.rectangle(box, fill=qr_color)

    for left, top in (
        (offset, offset),
        (offset + (matrix_size - 7) * module, offset),
        (offset, offset + (matrix_size - 7) * module),
    ):
        _draw_finder(
            draw,
            left,
            top,
            module,
            background_color,
            corner_eye_color,
            corner_eye_style,
        )

    logo_loaded = False
    if logo_path:
        try:
            client = get_supabase_client()
            logo_bytes = client.storage.from_(str(IMAGE_BUCKET)).download(logo_path)
            logo = Image.open(BytesIO(logo_bytes)).convert("RGBA")
            logo_loaded = True
        except Exception:
            logo_loaded = False
    else:
        try:
            logo = Image.open(DEFAULT_LOGO_PATH).convert("RGBA")
            logo_loaded = True
        except Exception:
            logo_loaded = False

    if logo_loaded:
        logo_size = max(round(canvas_size * 0.18), 40)
        logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
        pad = max(round(module * 1.25), 6)
        card = Image.new(
            "RGBA",
            (logo.width + pad * 2, logo.height + pad * 2),
            (*ImageColor.getrgb(background_color), 255),
        )
        card.paste(logo, (pad, pad), logo)
        position = (
            (canvas_size - card.width) // 2,
            (canvas_size - card.height) // 2,
        )
        image.paste(card, position, card)

    if canvas_size != qr_size:
        image = image.resize((qr_size, qr_size), Image.Resampling.LANCZOS)

    return {"message": "QR code generated successfully.", "image": image}


def update_qr_code_image(qr_data) -> dict:
    return generate_qr_code_image(
        content=qr_data.content,
        qr_color=qr_data.qr_color or "#111827",
        background_color=qr_data.background_color or "#FFFFFF",
        corner_eye_color=qr_data.corner_eye_color or qr_data.qr_color or "#111827",
        qr_size=qr_data.qr_size or 1024,
        qr_pattern_style=qr_data.qr_pattern_style or "rounded",
        corner_eye_style=qr_data.corner_eye_style or "rounded",
        logo_path=qr_data.qr_logo,
    )
