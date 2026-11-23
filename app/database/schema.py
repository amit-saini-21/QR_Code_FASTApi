from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
import datetime
import os
from pathlib import Path

import dotenv
from sqlalchemy import create_engine

PROJECT_ROOT = Path(__file__).resolve().parents[2]
dotenv.load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set.")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

Base = declarative_base()


class AuthUser(Base):
    __tablename__ = "auth_users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    qrcodes = relationship("QRCode", back_populates="user")

class QRCode(Base):
    __tablename__ = "qrcodes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("auth_users.id"), nullable=False)
    content = Column(String, nullable=True)
    title = Column(String, nullable=True)
    qr_format = Column(String, nullable=True)
    qr_type = Column(String, nullable=True)
    qr_size = Column(Integer, nullable=True, default=1024)
    qr_color = Column(String, nullable=True, default="#111827")
    background_color = Column(String, nullable=True, default="#FFFFFF")
    corner_eye_color = Column(String, nullable=True, default="#111827")
    qr_pattern_style = Column(String, nullable=True, default="rounded")
    corner_eye_style = Column(String, nullable=True, default="rounded")
    qr_logo = Column(String, nullable=True)
    media_path = Column(String, nullable=True)
    media_url = Column(String, nullable=True)
    media_name = Column(String, nullable=True)
    media_type = Column(String, nullable=True)
    media_size = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    qr_path = Column(String, nullable=True)

    user = relationship("AuthUser", back_populates="qrcodes")

Base.metadata.create_all(bind=engine)

# Existing databases are created before these appearance columns existed.
# Add missing columns without requiring a separate migration command.
from sqlalchemy import inspect, text

inspector = inspect(engine)
if "qrcodes" in inspector.get_table_names():
    existing_columns = {column["name"] for column in inspector.get_columns("qrcodes")}
    migrations = {
        "qr_size": "INTEGER",
        "qr_color": "VARCHAR",
        "background_color": "VARCHAR",
        "corner_eye_color": "VARCHAR",
        "qr_pattern_style": "VARCHAR",
        "corner_eye_style": "VARCHAR",
        "qr_logo": "VARCHAR",
        "media_path": "VARCHAR",
        "media_url": "VARCHAR",
        "media_name": "VARCHAR",
        "media_type": "VARCHAR",
        "media_size": "INTEGER",
    }
    with engine.begin() as connection:
        for column_name, column_type in migrations.items():
            if column_name not in existing_columns:
                connection.execute(text(
                    f'ALTER TABLE qrcodes ADD COLUMN {column_name} {column_type}'
                ))