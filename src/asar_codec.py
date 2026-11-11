# -*- coding: utf-8 -*-
"""Pure-Python Electron ASAR reader, extractor, and packer (with SHA-256 block integrity)."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import struct
from pathlib import Path
from typing import Any

ASAR_BLOCK_SIZE = 4 * 1024 * 1024
COPY_CHUNK_SIZE = 1024 * 1024


def compute_integrity(file_path: Path, block_size: int = ASAR_BLOCK_SIZE) -> dict[str, Any]:
    """Compute SHA-256 whole-file and block hashes matching Electron ASAR integrity format."""
    whole = hashlib.sha256()
    blocks: list[str] = []
    with file_path.open("rb") as f:
        while True:
            chunk = f.read(block_size)
            if not chunk:
                break
            whole.update(chunk)
            blocks.append(hashlib.sha256(chunk).hexdigest())

    if not blocks:
        blocks.append(hashlib.sha256(b"").hexdigest())

    return {
        "algorithm": "SHA256",
        "hash": whole.hexdigest(),
        "blockSize": block_size,
        "blocks": blocks,
    }


def read_header(asar_path: Path) -> tuple[dict[str, Any], int, int]:
    """Read ASAR JSON tree, payload byte offset, and total unpacked file count."""
    with asar_path.open("rb") as f:
        magic, header_pickle_size, _str_hdr_size, json_size = struct.unpack("<IIII", f.read(16))
        if magic != 4:
            raise ValueError(f"Invalid ASAR magic header in {asar_path}")
        header = json.loads(f.read(json_size).decode("utf-8"))
    payload_offset = 8 + header_pickle_size

    unpacked = 0

    def walk(node: dict[str, Any]) -> None:
        nonlocal unpacked
        files = node.get("files")
        if files is not None:
            for child in files.values():
                walk(child)
        elif node.get("unpacked"):
            unpacked += 1

    walk(header)
    return header, payload_offset, unpacked


def read_text_entry(asar_path: Path, rel_parts: tuple[str, ...]) -> str | None:
    """Read a packed UTF-8 text entry inside an ASAR archive without full extraction."""
    header, payload_offset, _ = read_header(asar_path)
    cur: dict[str, Any] | None = header
    for part in rel_parts:
        files = cur.get("files") if cur else None
        if not files or part not in files:
            return None
        cur = files[part]
    if not cur or cur.get("unpacked") or "offset" not in cur or "size" not in cur:
        return None
    offset = payload_offset + int(cur["offset"])
    size = int(cur["size"])
    with asar_path.open("rb") as f:
        f.seek(offset)
        return f.read(size).decode("utf-8", errors="replace")


def _safe_dest(dest_root: Path, rel_parts: tuple[str, ...]) -> Path:
    """Resolve destination path safely and reject path-traversal components."""
    for part in rel_parts:
        if not part or part in (".", "..") or "/" in part or "\\" in part:
            raise ValueError(f"Unsafe ASAR path component: {part!r}")
    candidate = dest_root.joinpath(*rel_parts)
    resolved_root = dest_root.resolve()
    resolved_cand = candidate.resolve(strict=False)
    try:
        resolved_cand.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError(f"ASAR path escapes destination root: {candidate}") from exc
    return candidate


def _copy_exact(src_file, dst_path: Path, size: int) -> None:
    """Copy `size` bytes from an open binary stream to `dst_path`."""
    remaining = size
    with dst_path.open("wb") as out:
        while remaining > 0:
            chunk = src_file.read(min(COPY_CHUNK_SIZE, remaining))
            if not chunk:
                raise EOFError(f"Unexpected EOF while reading ASAR entry {dst_path}")
            out.write(chunk)
            remaining -= len(chunk)


def extract_asar(asar_path: Path, dest_dir: Path, unpacked_src_dir: Path | None = None) -> int:
    """Extract all packed, unpacked, and symlink entries from `asar_path` into `dest_dir`."""
    header, payload_offset, unpacked_count = read_header(asar_path)
    if unpacked_src_dir is None:
        cand_same = asar_path.with_name(asar_path.name + ".unpacked")
        cand_std = asar_path.parent / "app.asar.unpacked"
        unpacked_src_dir = cand_same if cand_same.is_dir() else (cand_std if cand_std.is_dir() else None)

    if unpacked_count > 0 and (unpacked_src_dir is None or not unpacked_src_dir.is_dir()):
        raise FileNotFoundError(
            f"ASAR expects {unpacked_count} unpacked files, but companion .unpacked directory "
            f"was not found next to {asar_path}"
        )

    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted_count = 0

    with asar_path.open("rb") as f:
        def walk(node: dict[str, Any], parts: tuple[str, ...]) -> None:
            nonlocal extracted_count
            files = node.get("files")
            if files is not None:
                if parts:
                    _safe_dest(dest_dir, parts).mkdir(parents=True, exist_ok=True)
                for name, child in files.items():
                    walk(child, parts + (name,))
                return

            target = _safe_dest(dest_dir, parts)
            target.parent.mkdir(parents=True, exist_ok=True)

            if "link" in node:
                if target.exists() or target.is_symlink():
                    target.unlink()
                os.symlink(node["link"], target)
                extracted_count += 1
                return

            if node.get("unpacked"):
                src_unpacked = unpacked_src_dir.joinpath(*parts)  # type: ignore[union-attr]
                if not src_unpacked.is_file():
                    raise FileNotFoundError(f"Missing unpacked ASAR asset: {src_unpacked}")
                shutil.copy2(src_unpacked, target)
                extracted_count += 1
                return

            size = int(node.get("size", 0))
            offset = int(node.get("offset", 0))
            f.seek(payload_offset + offset)
            _copy_exact(f, target, size)
            if os.name != "nt" and node.get("executable"):
                target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            extracted_count += 1

        walk(header, ())

    return extracted_count


def collect_unpacked_paths(header: dict[str, Any]) -> set[str]:
    """Collect POSIX relative paths of all entries marked `unpacked` in an ASAR header."""
    paths: set[str] = set()

    def walk(node: dict[str, Any], parts: tuple[str, ...]) -> None:
        files = node.get("files")
        if files is not None:
            for name, child in files.items():
                walk(child, parts + (name,))
        elif node.get("unpacked"):
            paths.add("/".join(parts))

    walk(header, ())
    return paths


def _should_unpack(
    rel_posix: str,
    unpack_prefixes: tuple[str, ...],
    unpack_files: set[str],
) -> bool:
    """Return True if `rel_posix` falls inside an unpacked directory prefix or explicit file set."""
    if rel_posix in unpack_files:
        return True
    for prefix in unpack_prefixes:
        if rel_posix == prefix or rel_posix.startswith(prefix + "/"):
            return True
    return False


def pack_asar(
    src_dir: Path,
    out_asar: Path,
    unpack_dirs: tuple[str, ...] = (),
    unpack_files: set[str] | None = None,
) -> tuple[int, int]:
    """Pack `src_dir` into an Electron-compatible ASAR archive at `out_asar`.

    Returns `(packed_count, unpacked_count)`.
    """
    src_root = src_dir.resolve()
    prefixes = tuple(p.strip("/\\").replace("\\", "/") for p in unpack_dirs if p.strip("/\\"))
    exact_unpacked = {p.replace("\\", "/").lstrip("/") for p in (unpack_files or set())}
    unpacked_out_dir = out_asar.with_name(out_asar.name + ".unpacked")
    if unpacked_out_dir.exists():
        shutil.rmtree(unpacked_out_dir)

    payload_files: list[Path] = []
    offset_cursor = 0
    packed_count = 0
    unpacked_count = 0

    def build_dir_node(cur_dir: Path, rel_parts: tuple[str, ...]) -> dict[str, Any]:
        nonlocal offset_cursor, packed_count, unpacked_count
        entries: dict[str, Any] = {}
        children = sorted(cur_dir.iterdir(), key=lambda p: p.name)
        for child in children:
            child_rel = rel_parts + (child.name,)
            rel_posix = "/".join(child_rel)
            if child.is_symlink():
                entries[child.name] = {"link": os.readlink(child)}
            elif child.is_dir():
                entries[child.name] = build_dir_node(child, child_rel)
            elif child.is_file():
                st = child.stat()
                size = st.st_size
                meta: dict[str, Any] = {"size": size}
                if _should_unpack(rel_posix, prefixes, exact_unpacked):
                    meta["unpacked"] = True
                    meta["integrity"] = compute_integrity(child)
                    dest_unpacked = unpacked_out_dir.joinpath(*child_rel)
                    dest_unpacked.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(child, dest_unpacked)
                    unpacked_count += 1
                else:
                    meta["offset"] = str(offset_cursor)
                    meta["integrity"] = compute_integrity(child)
                    payload_files.append(child)
                    offset_cursor += size
                    packed_count += 1
                if os.name != "nt" and (st.st_mode & stat.S_IXUSR):
                    meta["executable"] = True
                entries[child.name] = meta
        return {"files": entries}

    root_header = build_dir_node(src_root, ())
    json_bytes = json.dumps(root_header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_size = len(json_bytes)
    aligned_len = (json_size + 3) & ~3
    pad_bytes = b"\x00" * (aligned_len - json_size)
    str_hdr_size = aligned_len + 4
    header_pickle_size = str_hdr_size + 4

    out_asar.parent.mkdir(parents=True, exist_ok=True)
    with out_asar.open("wb") as out:
        out.write(struct.pack("<IIII", 4, header_pickle_size, str_hdr_size, json_size))
        out.write(json_bytes)
        out.write(pad_bytes)
        for item in payload_files:
            with item.open("rb") as src_f:
                shutil.copyfileobj(src_f, out, length=COPY_CHUNK_SIZE)

    return packed_count, unpacked_count
