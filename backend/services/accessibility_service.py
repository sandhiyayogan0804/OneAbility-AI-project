from sqlalchemy.orm import Session
from models.user import User
from models.accessibility import AccessibilityPreference
from schemas.accessibility import AccessibilityPreferenceUpdateRequest

class AccessibilityService:

    @classmethod
    def get_or_create_preferences(cls, db: Session, user: User) -> AccessibilityPreference:
        """Loads user accessibility preferences or creates default profile if missing."""
        prefs = db.query(AccessibilityPreference).filter(
            AccessibilityPreference.user_id == user.id
        ).first()

        if not prefs:
            prefs = AccessibilityPreference(
                user_id=user.id,
                high_contrast=False,
                font_size_scale="medium",
                screen_reader_optimized=False,
                voice_guidance=True,
                haptic_feedback=True,
                simple_mode=False,
                reduced_motion=False,
                captions_enabled=True,
                color_blind_mode="none",
                preferred_language="en"
            )
            db.add(prefs)
            db.commit()
            db.refresh(prefs)

        return prefs

    @classmethod
    def update_preferences(
        cls,
        db: Session,
        user: User,
        req: AccessibilityPreferenceUpdateRequest
    ) -> AccessibilityPreference:
        """Updates accessibility preferences for the authenticated user."""
        prefs = cls.get_or_create_preferences(db=db, user=user)

        update_data = req.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(prefs, field):
                setattr(prefs, field, value)

        db.commit()
        db.refresh(prefs)
        return prefs
