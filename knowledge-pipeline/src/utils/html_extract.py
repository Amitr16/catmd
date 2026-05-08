"""Clean HTML → readable text using trafilatura.

trafilatura is purpose-built for content extraction (strips nav, footer,
ads) and consistently beats readability.js on comprehensiveness.
"""
from __future__ import annotations

import trafilatura


def extract_main_text(html: str, *, url: str | None = None) -> tuple[str | None, str | None]:
    """Return (text, title). Either can be None if extraction failed.

    `url` helps trafilatura with heuristics but isn't required.
    """
    if not html or not html.strip():
        return None, None
    text = trafilatura.extract(
        html,
        url=url,
        favor_precision=True,
        include_comments=False,
        include_tables=True,
        no_fallback=False,
    )
    meta = trafilatura.extract_metadata(html, default_url=url) if html else None
    title = meta.title if meta and meta.title else None
    return text, title
