from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
import enum


class NoteAuthorType(str, enum.Enum):
    SENDER = "SENDER"
    COURIER = "COURIER"
    SYSTEM = "SYSTEM"


class PackageNote(Base):
    __tablename__ = "package_notes"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Nullable for system notes
    author_type = Column(Enum(NoteAuthorType), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    package = relationship("Package", backref="notes")
    author = relationship("User", backref="package_notes")

    def __repr__(self):
        return f"<PackageNote {self.id} by {self.author_type} on package {self.package_id}>"
