from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from config.database import Base

class AccessibilityPreference(Base):
    __tablename__ = "accessibility_preferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    high_contrast = Column(Boolean, default=False, nullable=False)
    font_size_scale = Column(String(20), default="medium", nullable=False)  # small, medium, large, x-large
    screen_reader_optimized = Column(Boolean, default=False, nullable=False)
    voice_guidance = Column(Boolean, default=True, nullable=False)
    haptic_feedback = Column(Boolean, default=True, nullable=False)
    simple_mode = Column(Boolean, default=False, nullable=False)
    reduced_motion = Column(Boolean, default=False, nullable=False)
    captions_enabled = Column(Boolean, default=True, nullable=False)
    color_blind_mode = Column(String(30), default="none", nullable=False)  # none, protanopia, deuteranopia, tritanopia
    preferred_language = Column(String(10), default="en", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="accessibility_preference")
