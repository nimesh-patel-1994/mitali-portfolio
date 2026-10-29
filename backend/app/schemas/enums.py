"""Enumerations shared by public and admin schemas (contract components ``WritingFormat``, ``ImageLayout``,
``CtaTarget``, ``EnquiryType``, ``BudgetRange``, ``EnquiryStatus``). Values match the CHECK constraints in
``app/models``; a unit test keeps both in sync."""

from __future__ import annotations

from typing import Literal

WritingFormat = Literal["blog", "web_copy", "email", "social", "landing_page", "newsletter"]
ImageLayout = Literal["full", "half"]
CtaTarget = Literal["booking", "contact"]
EnquiryType = Literal["content_strategy", "copywriting", "seo_content", "brand_messaging", "campaign_planning", "other"]
BudgetRange = Literal["under_1000", "1000_3000", "3000_7500", "7500_15000", "over_15000", "not_sure"]
EnquiryStatus = Literal["new", "replied", "archived"]
MediaMime = Literal["image/webp", "image/svg+xml"]
