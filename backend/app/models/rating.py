from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, CheckConstraint, UniqueConstraint
from sqlalchemy.sql import func
from app.models.base import Base


class Rating(Base):
    """
    Rating model for users to rate each other after package delivery.

    Business Rules:
    - Only one rating per rater per package (sender rates courier, courier rates sender)
    - Score must be between 1 and 5
    - Can only rate after package is delivered
    - Rater must be either sender or courier of the package
    - Rated user must be the other party (sender rates courier, courier rates sender)
    """
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)

    # Who is rating whom
    rater_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rated_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Which package this rating is for
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False, index=True)

    # Rating details
    score = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(Text, nullable=True)  # Optional review text

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Constraints
    __table_args__ = (
        # Score must be between 1 and 5
        CheckConstraint('score >= 1 AND score <= 5', name='valid_score'),
        # One rating per rater per package
        UniqueConstraint('rater_id', 'package_id', name='unique_rating_per_package'),
        # Rater cannot rate themselves
        CheckConstraint('rater_id != rated_user_id', name='no_self_rating'),
    )

    def __repr__(self):
        return f"<Rating {self.id} - {self.rater_id} rated {self.rated_user_id}: {self.score}/5>"
