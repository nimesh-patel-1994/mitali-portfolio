"""FAQ categories and FAQs (tech-spec section 3.1)."""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import FALSE, Base, EntityMixin, max_length


class FaqCategory(EntityMixin, Base):
    __tablename__ = "faq_categories"

    name: Mapped[str] = mapped_column(unique=True)
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    faqs: Mapped[list[Faq]] = relationship(
        back_populates="category", order_by="[Faq.position, Faq.created_at]", passive_deletes="all"
    )

    __table_args__ = (max_length("name", 80),)


class Faq(EntityMixin, Base):
    __tablename__ = "faqs"

    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("faq_categories.id", ondelete="RESTRICT"))
    question: Mapped[str]
    answer: Mapped[str]
    show_in_preview: Mapped[bool] = mapped_column(server_default=FALSE)
    is_published: Mapped[bool] = mapped_column(server_default=FALSE)
    position: Mapped[int]
    seed_key: Mapped[str | None] = mapped_column(unique=True)

    category: Mapped[FaqCategory] = relationship(back_populates="faqs")

    __table_args__ = (
        max_length("question", 200),
        max_length("answer", 2000),
        Index("ix_faqs_category_id_position", "category_id", "position"),
        Index(
            "ix_faqs_preview_category_id_position",
            "category_id",
            "position",
            postgresql_where=text("show_in_preview AND is_published"),
        ),
    )
