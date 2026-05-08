"""Tiny JSONL read/write helpers — used throughout the pipeline."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Iterator, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def write_jsonl(path: Path, items: Iterable[BaseModel]) -> int:
    """Write pydantic models as JSONL. Returns count written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for item in items:
            f.write(item.model_dump_json() + "\n")
            n += 1
    return n


def read_jsonl(path: Path, model: type[T]) -> Iterator[T]:
    """Read JSONL into pydantic models."""
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield model.model_validate_json(line)


def read_jsonl_list(path: Path, model: type[T]) -> list[T]:
    """Read all JSONL into a list (small files only)."""
    return list(read_jsonl(path, model))
