# -*- coding: utf-8 -*-
"""Build a standalone zero-dependency single-file executable via PyInstaller."""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def default_artifact_name() -> str:
    """Choose deterministic cross-platform artifact basename."""
    sys_name = platform.system().lower()
    arch = platform.machine().lower()
    if arch in {"amd64", "x86_64"}:
        arch = "x64"
    elif arch in {"arm64", "aarch64"}:
        arch = "arm64"
    if sys_name == "windows":
        return f"Antigravity-zh-cn-win-{arch}"
    if sys_name == "darwin":
        return f"antigravity-zh-cn-macos-{arch}"
    return f"antigravity-zh-cn-{sys_name}-{arch}"


def main(argv: list[str] | None = None) -> int:
    """Invoke PyInstaller to produce a single-file binary under `release/`."""
    parser = argparse.ArgumentParser(description="Build standalone Antigravity Chinese localization binary")
    parser.add_argument("--name", default=default_artifact_name(), help="Output executable name (without .exe)")
    parser.add_argument("--out-dir", default=str(ROOT_DIR / "release"), help="Output directory")
    args = parser.parse_args(argv)

    try:
        import PyInstaller  # noqa: F401
    except ImportError as exc:
        print("[ERROR] PyInstaller is required. Run: pip install pyinstaller", file=sys.stderr)
        return 1

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    name = args.name[:-4] if platform.system() == "Windows" and args.name.lower().endswith(".exe") else args.name
    sep = os.pathsep

    with tempfile.TemporaryDirectory(prefix="agy_pyi_") as tmp:
        tmp_path = Path(tmp)
        cmd = [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--console",
            "--name",
            name,
            "--distpath",
            str(out_dir),
            "--workpath",
            str(tmp_path / "work"),
            "--specpath",
            str(tmp_path / "spec"),
            "--paths",
            str(ROOT_DIR / "src"),
            "--add-data",
            f"{ROOT_DIR / 'dict' / 'master_merged_dict.json'}{sep}dict",
            "--add-data",
            f"{ROOT_DIR / 'src' / 'engine_preload.js'}{sep}src",
            str(ROOT_DIR / "src" / "localize.py"),
        ]
        print(f"Building standalone binary: {name} -> {out_dir}")
        res = subprocess.run(cmd)
        if res.returncode != 0:
            return res.returncode

    suffix = ".exe" if platform.system() == "Windows" else ""
    target = out_dir / f"{name}{suffix}"
    if not target.is_file():
        print(f"[ERROR] Expected output missing: {target}", file=sys.stderr)
        return 1
    print(f"Standalone build complete: {target} ({target.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
