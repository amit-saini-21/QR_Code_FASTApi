from .schema import AuthUser,QRCode, engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
import datetime




SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency function to get a database session.

    Returns:
        Session: A SQLAlchemy database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def creata_user(db: Session, name: str, email: str, password: str) -> AuthUser:
    """
    Creates a new user in the database.

    Args:
        db (Session): The database session.
        name (str): The name of the user.
        email (str): The email of the user.
        password (str): The hashed password of the user.

    Returns:
        AuthUser: The created user object.
    """
    new_user = AuthUser(
        name=name,
        email=email,
        password=password,
        is_active=True,
        created_at=datetime.datetime.utcnow()
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except SQLAlchemyError as e:
        db.rollback()
        raise e

def find_user_by_email(db: Session, email: str) -> AuthUser:
    """
    Finds a user in the database by email.

    Args:
        db (Session): The database session.
        email (str): The email of the user to find.

    Returns:
        AuthUser: The found user object, or None if not found.
    """
    return db.query(AuthUser).filter(AuthUser.email == email).first()

def find_user_by_id(db: Session, user_id: int) -> AuthUser:
    """
    Finds a user in the database by ID.

    Args:
        db (Session): The database session.
        user_id (int): The ID of the user to find.

    Returns:
        AuthUser: The found user object, or None if not found.
    """
    return db.query(AuthUser).filter(AuthUser.id == user_id).first()    

def save_qr_code(db: Session, user_id: int, qr_type: str, content: str, title: str, qr_format: str, image_path: str,
                 qr_size: int = 1024, qr_color: str = "#111827", background_color: str = "#FFFFFF",
                 corner_eye_color: str = "#111827", qr_pattern_style: str = "rounded",
                 corner_eye_style: str = "rounded", qr_logo: str | None = None,
                 media_path: str | None = None, media_url: str | None = None,
                 media_name: str | None = None, media_type: str | None = None,
                 media_size: int | None = None):
    """
    Saves a generated QR code to the database.

    Args:
        db (Session): The database session.
        user_id (int): The ID of the user who generated the QR code.
        qr_type (str): The type of the QR code (e.g., text, URL).
        content (str): The content encoded in the QR code.
        title (str): The title of the QR code.
        qr_format (str): The format of the QR code image (e.g., png).
        image_path (str): The path to the saved QR code image.

    Returns:
        QRCode: The saved QR code object.
    """
    if not find_user_by_id(db, user_id):
        raise ValueError(f"User with ID {user_id} does not exist.")

    
    new_qr_code = QRCode(
        user_id=user_id,
        qr_type=qr_type,
        content=content,
        title=title,
        qr_format=qr_format,
        qr_path=image_path,
        qr_size=qr_size,
        qr_color=qr_color,
        background_color=background_color,
        corner_eye_color=corner_eye_color,
        qr_pattern_style=qr_pattern_style,
        corner_eye_style=corner_eye_style,
        qr_logo=qr_logo,
        media_path=media_path,
        media_url=media_url,
        media_name=media_name,
        media_type=media_type,
        media_size=media_size,
        created_at=datetime.datetime.utcnow()
    )
    try:
        db.add(new_qr_code)
        db.commit()
        db.refresh(new_qr_code)
        return new_qr_code
    except SQLAlchemyError as e:
        db.rollback()
        raise e

def update_qr_code(db: Session, qr_id: int, user_id: int, qr_type: str, content: str, title: str,
                   qr_format: str, image_path: str, qr_size: int = 1024, qr_color: str = "#111827",
                   background_color: str = "#FFFFFF", corner_eye_color: str = "#111827",
                   qr_pattern_style: str = "rounded", corner_eye_style: str = "rounded",
                   qr_logo: str | None = None, media_path: str | None = None,
                   media_url: str | None = None, media_name: str | None = None,
                   media_type: str | None = None, media_size: int | None = None):
    """
    Updates an existing QR code in the database.

    Args:
        db (Session): The database session.
        qr_id (int): The ID of the QR code to update.
        user_id (int): The ID of the user who owns the QR code.
        qr_type (str): The updated type of the QR code.
        content (str): The updated content encoded in the QR code.
        title (str): The updated title of the QR code.
        qr_format (str): The updated format of the QR code image.
        image_path (str): The updated path to the saved QR code image.

    Returns:
        QRCode: The updated QR code object.
    """
    qr_code = get_qr_code(db, qr_id, user_id)
    if not qr_code:
        raise ValueError(f"QR code with ID {qr_id} does not exist for user ID {user_id}.")

    qr_code.qr_type = qr_type
    qr_code.content = content
    qr_code.title = title
    qr_code.qr_format = qr_format
    qr_code.qr_path = image_path
    qr_code.qr_size = qr_size
    qr_code.qr_color = qr_color
    qr_code.background_color = background_color
    qr_code.corner_eye_color = corner_eye_color
    qr_code.qr_pattern_style = qr_pattern_style
    qr_code.corner_eye_style = corner_eye_style
    qr_code.qr_logo = qr_logo
    qr_code.media_path = media_path
    qr_code.media_url = media_url
    qr_code.media_name = media_name
    qr_code.media_type = media_type
    qr_code.media_size = media_size
    try:
        db.commit()
        db.refresh(qr_code)
        return qr_code
    except SQLAlchemyError as e:
        db.rollback()
        raise e

def get_qr_code(db : Session, qr_id: int, user_id: int) -> QRCode:
   """Retrieves a QR code from the database by its ID."""
   return db.query(QRCode).filter(QRCode.id == qr_id, QRCode.user_id == user_id).first()