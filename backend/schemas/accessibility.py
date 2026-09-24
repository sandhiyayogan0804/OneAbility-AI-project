from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AccessibilityPreferenceResponse(BaseModel):
    user_id: int
    high_contrast: bool = False
    font_size_scale: str = "medium"  # "normal" / "medium", "large", "x-large"
    screen_reader_optimized: bool = False
    voice_guidance: bool = True
    haptic_feedback: bool = True
    simple_mode: bool = False
    reduced_motion: bool = False
    captions_enabled: bool = True
    color_blind_mode: str = "none"
    preferred_language: str = "en"
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AccessibilityPreferenceUpdateRequest(BaseModel):
    high_contrast: Optional[bool] = None
    font_size_scale: Optional[str] = Field(None, description="'normal', 'medium', 'large', 'x-large'")
    screen_reader_optimized: Optional[bool] = None
    voice_guidance: Optional[bool] = None
    haptic_feedback: Optional[bool] = None
    simple_mode: Optional[bool] = None
    reduced_motion: Optional[bool] = None
    captions_enabled: Optional[bool] = None
    color_blind_mode: Optional[str] = Field(None, description="'none', 'protanopia', 'deuteranopia', 'tritanopia'")
    preferred_language: Optional[str] = Field(None, description="'en', 'ta', 'mixed'")
