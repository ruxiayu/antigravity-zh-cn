# -*- coding: utf-8 -*-
"""Antigravity Chinese Localization CLI (Install / Restore / Status / Build)."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from asar_codec import (
    collect_unpacked_paths,
    extract_asar,
    pack_asar,
    read_header as read_asar_header,
    read_text_entry as read_asar_text_entry,
)
from patches_main import PATCH_VERSION, PRELOAD_MARKERS, REPO_URL, apply_all_patches

BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
DEFAULT_DICT = BUNDLE_ROOT / "dict" / "master_merged_dict.json"
DEFAULT_ENGINE = BUNDLE_ROOT / "src" / "engine_preload.js"

WIN_UNINSTALL_GUID = "121a0be4-63bd-531e-acf8-fc3924c7e984"
BACKUP_SUFFIX = ".original.bak"


def md5_file(path: Path) -> str:
    """Compute hexadecimal MD5 digest of a file."""
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def is_asar_localized(asar_path: Path) -> bool:
    """Check whether dist/preload.js inside the ASAR contains the engine marker."""
    try:
        preload = read_asar_text_entry(asar_path, ("dist", "preload.js"))
    except Exception:
        return False
    if not preload:
        return False
    return any(marker in preload for marker in PRELOAD_MARKERS)


def read_asar_version(asar_path: Path) -> str:
    """Read Antigravity app version from package.json inside ASAR."""
    try:
        pkg = read_asar_text_entry(asar_path, ("package.json",))
        if pkg:
            return str(json.loads(pkg).get("version", "unknown"))
    except Exception:
        pass
    return "unknown"


def _win_registry_install_dirs() -> list[Path]:
    """Query Windows registry for Antigravity InstallLocation."""
    if platform.system() != "Windows":
        return []
    try:
        import winreg
    except ImportError:
        return []

    dirs: list[Path] = []
    subkeys = [
        (winreg.HKEY_CURRENT_USER, rf"Software\Microsoft\Windows\CurrentVersion\Uninstall\{WIN_UNINSTALL_GUID}"),
        (winreg.HKEY_CURRENT_USER, rf"Software\{WIN_UNINSTALL_GUID}"),
        (winreg.HKEY_LOCAL_MACHINE, rf"Software\Microsoft\Windows\CurrentVersion\Uninstall\{WIN_UNINSTALL_GUID}"),
        (winreg.HKEY_LOCAL_MACHINE, rf"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\{WIN_UNINSTALL_GUID}"),
    ]
    for hive, sub in subkeys:
        try:
            with winreg.OpenKey(hive, sub) as key:
                val, _ = winreg.QueryValueEx(key, "InstallLocation")
                if val:
                    p = Path(str(val).strip().strip('"'))
                    if p not in dirs:
                        dirs.append(p)
        except OSError:
            continue
    return dirs


def _resolve_target_from_dir(base: Path) -> tuple[Path, Path | None] | None:
    """Resolve (app.asar, exe_path) from a candidate installation or resources directory."""
    if not base.exists():
        return None
    if base.is_file() and base.name == "app.asar":
        resources_dir = base.parent
        root_dir = resources_dir.parent
        exe = _find_exe(root_dir)
        return base, exe

    candidates = [
        base / "resources" / "app.asar",
        base / "Contents" / "Resources" / "app.asar",
        base / "app.asar",
    ]
    for asar in candidates:
        if asar.is_file():
            root_dir = asar.parent.parent
            if root_dir.name == "Contents":
                root_dir = root_dir.parent
            return asar, _find_exe(root_dir)
    return None


def _find_exe(app_root: Path) -> Path | None:
    """Locate launchable executable for the given app root."""
    sys_name = platform.system()
    if sys_name == "Windows":
        exe = app_root / "Antigravity.exe"
        return exe if exe.is_file() else None
    if sys_name == "Darwin":
        if app_root.suffix == ".app" and app_root.exists():
            return app_root
        mac_bin = app_root / "Contents" / "MacOS" / "Antigravity"
        return mac_bin if mac_bin.is_file() else None
    lin_bin = app_root / "antigravity"
    return lin_bin if lin_bin.is_file() else None


def discover_installation(app_dir: str | None = None, asar_override: str | None = None) -> tuple[Path, Path | None]:
    """Find Antigravity resources/app.asar and executable path automatically."""
    if asar_override:
        p = Path(asar_override).expanduser().resolve()
        if p.is_file():
            root_dir = p.parent.parent
            if root_dir.name == "Contents":
                root_dir = root_dir.parent
            return p, _find_exe(root_dir)
        resolved = _resolve_target_from_dir(p)
        if not resolved:
            raise FileNotFoundError(f"app.asar not found at: {p}")
        return resolved

    if app_dir:
        p = Path(app_dir).expanduser().resolve()
        resolved = _resolve_target_from_dir(p)
        if not resolved:
            raise FileNotFoundError(f"Could not locate resources/app.asar under: {p}")
        return resolved

    candidates: list[Path] = []
    sys_name = platform.system()
    if sys_name == "Windows":
        candidates.extend(_win_registry_install_dirs())
        local_app = os.environ.get("LOCALAPPDATA", "")
        prog_files = os.environ.get("ProgramFiles", r"C:\Program Files")
        if local_app:
            candidates.append(Path(local_app) / "Programs" / "antigravity")
        candidates.append(Path(prog_files) / "Antigravity")
    elif sys_name == "Darwin":
        candidates.extend([
            Path("/Applications/Antigravity.app"),
            Path.home() / "Applications" / "Antigravity.app",
        ])
    else:
        candidates.extend([
            Path("/opt/Antigravity"),
            Path("/usr/share/antigravity"),
            Path.home() / ".local" / "share" / "Antigravity",
        ])

    for cand in candidates:
        resolved = _resolve_target_from_dir(cand)
        if resolved:
            return resolved

    raise FileNotFoundError(
        "Unable to auto-detect Antigravity installation. "
        "Pass --app-dir <install_dir> or --asar <path/to/app.asar>."
    )


def run_cmd(cmd: list[str], err_prefix: str) -> None:
    """Execute a subprocess command and raise detailed error on failure."""
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        detail = (res.stderr or res.stdout or "").strip()
        raise RuntimeError(f"{err_prefix} (exit {res.returncode}):\n{detail}")


def verify_js_syntax(extracted_dir: Path, touched_rel_paths: list[str]) -> None:
    """Verify patched module integrity with `node --check` when Node.js is available."""
    dist_dir = extracted_dir / "dist"
    node_bin = shutil.which("node")
    if node_bin:
        for rel in touched_rel_paths:
            target = dist_dir / rel
            if target.exists():
                run_cmd([node_bin, "--check", str(target)], f"Syntax check failed in dist/{rel}")
        return

    print("      Notice: `node` not found in PATH; running built-in UTF-8/JSON integrity checks.")
    pkg = extracted_dir / "package.json"
    if pkg.exists():
        json.loads(pkg.read_text(encoding="utf-8"))
    for rel in touched_rel_paths:
        target = dist_dir / rel
        if target.exists() and not target.read_text(encoding="utf-8").strip():
            raise RuntimeError(f"Patched file unexpectedly empty: dist/{rel}")


def build_patched_asar(
    source_asar: Path,
    output_asar: Path,
    dict_path: Path,
    engine_path: Path,
    block_auto_update: bool = True,
) -> dict[str, Any]:
    """Extract source ASAR, inject localization patches, verify integrity & parity, and repack."""
    dictionary = json.loads(dict_path.read_text(encoding="utf-8"))
    engine_template = engine_path.read_text(encoding="utf-8")
    orig_header, _, orig_unpacked = read_asar_header(source_asar)
    orig_unpacked_files = collect_unpacked_paths(orig_header)
    app_ver = read_asar_version(source_asar)

    with tempfile.TemporaryDirectory(prefix="antigravity_zh_") as tmp:
        tmp_path = Path(tmp)
        extracted_dir = tmp_path / "extracted"
        packed_asar = tmp_path / "app.asar"

        print(f"[1/5] Extracting source ASAR (v{app_ver}, {orig_unpacked} unpacked files)...")
        extract_asar(source_asar, extracted_dir)

        print(f"[2/5] Applying patches with {len(dictionary)} dictionary entries...")
        touched = apply_all_patches(
            extracted_dir,
            engine_template=engine_template,
            dictionary=dictionary,
            block_auto_update=block_auto_update,
        )

        print(f"[3/5] Verifying JS syntax across {len(touched)} modules...")
        verify_js_syntax(extracted_dir, touched)

        print("[4/5] Repacking ASAR archive...")
        pack_asar(
            extracted_dir,
            packed_asar,
            unpack_dirs=("node_modules/chrome-devtools-mcp",),
            unpack_files=orig_unpacked_files,
        )

        _, _, new_unpacked = read_asar_header(packed_asar)
        if orig_unpacked and new_unpacked != orig_unpacked:
            raise RuntimeError(
                f"Unpacked file parity mismatch: original={orig_unpacked}, packed={new_unpacked}"
            )

        output_asar.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(packed_asar, output_asar)
        except PermissionError as exc:
            raise PermissionError(
                f"Cannot write {output_asar}. Please close Antigravity completely and try again."
            ) from exc

        # Copy accompanying .unpacked dir if generated beside packed_asar in build mode
        packed_unpacked_dir = packed_asar.with_name(packed_asar.name + ".unpacked")
        target_unpacked_dir = output_asar.with_name(output_asar.name + ".unpacked")
        if packed_unpacked_dir.exists() and not target_unpacked_dir.exists():
            shutil.copytree(packed_unpacked_dir, target_unpacked_dir, symlinks=True)

    return {
        "version": app_ver,
        "dict_entries": len(dictionary),
        "unpacked_count": new_unpacked,
        "md5": md5_file(output_asar),
    }


def cmd_install(args: argparse.Namespace) -> int:
    """Backup clean original app.asar if needed and deploy localized app.asar."""
    target_asar, exe_path = discover_installation(args.app_dir, args.asar)
    backup_asar = target_asar.with_name(target_asar.name + BACKUP_SUFFIX)
    already_localized = is_asar_localized(target_asar)

    if not already_localized:
        print(f"[Backup] Saving clean original ASAR -> {backup_asar}")
        shutil.copy2(target_asar, backup_asar)
        source_asar = backup_asar
    elif backup_asar.is_file() and not is_asar_localized(backup_asar):
        print(f"[Source] Using preserved clean backup: {backup_asar}")
        source_asar = backup_asar
    else:
        print("[Source] Target is already localized without clean backup; re-patching idempotently.")
        source_asar = target_asar

    result = build_patched_asar(
        source_asar=source_asar,
        output_asar=target_asar,
        dict_path=Path(args.dict).resolve(),
        engine_path=Path(args.engine).resolve(),
        block_auto_update=not args.keep_auto_update,
    )
    print(f"[5/5] Localization installed successfully!")
    print(f"      Target ASAR : {target_asar}")
    print(f"      Version     : {result['version']}")
    print(f"      Dict Entries: {result['dict_entries']}")
    print(f"      Unpacked    : {result['unpacked_count']}")
    print(f"      MD5         : {result['md5']}")
    if exe_path:
        print(f"      Executable  : {exe_path}")
    return 0


def cmd_restore(args: argparse.Namespace) -> int:
    """Restore target app.asar from app.asar.original.bak."""
    target_asar, _ = discover_installation(args.app_dir, args.asar)
    backup_asar = target_asar.with_name(target_asar.name + BACKUP_SUFFIX)
    if not backup_asar.is_file():
        print(f"Backup not found: {backup_asar}", file=sys.stderr)
        return 1
    read_asar_header(backup_asar)
    try:
        shutil.copy2(backup_asar, target_asar)
    except PermissionError:
        print(f"Cannot overwrite {target_asar}. Please close Antigravity first.", file=sys.stderr)
        return 1
    print(f"Restored original ASAR cleanly: {target_asar}")
    print(f"Restored MD5: {md5_file(target_asar)}")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    """Inspect Antigravity installation path, localization status, and backup availability."""
    target_asar, exe_path = discover_installation(args.app_dir, args.asar)
    backup_asar = target_asar.with_name(target_asar.name + BACKUP_SUFFIX)
    dictionary = json.loads(Path(args.dict).read_text(encoding="utf-8"))
    _, _, unpacked = read_asar_header(target_asar)
    print(f"Install ASAR   : {target_asar}")
    print(f"Executable     : {exe_path or 'Not found'}")
    print(f"App Version    : {read_asar_version(target_asar)}")
    print(f"Patch Version  : {PATCH_VERSION}")
    print(f"Localized      : {'Yes' if is_asar_localized(target_asar) else 'No (Official)'}")
    print(f"Backup Present : {'Yes (' + str(backup_asar) + ')' if backup_asar.is_file() else 'No'}")
    print(f"Unpacked Files : {unpacked}")
    print(f"Dict Entries   : {len(dictionary)}")
    return 0


def _parse_semver_tuple(ver: str) -> tuple[int, ...]:
    cleaned = ver.strip().lstrip("vV").split("-", 1)[0].split("+", 1)[0]
    parts = []
    for seg in cleaned.split("."):
        try:
            parts.append(int(seg))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def cmd_check_update(_args: argparse.Namespace | None = None) -> int:
    """Query GitHub latest release cleanly using stdlib urllib (read-only)."""
    api_url = "https://api.github.com/repos/ruxiayu/antigravity-zh-cn/releases/latest"
    print(f"Current Patch  : v{PATCH_VERSION}")
    print(f"Release Source : {REPO_URL}/releases")
    req = urllib.request.Request(
        api_url,
        headers={
            "User-Agent": f"antigravity-zh-cn/{PATCH_VERSION}",
            "Accept": "application/vnd.github+json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(f"Check Status   : HTTP {exc.code} (可前往 Releases 页面查看最新版本)", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Check Status   : 请求失败 ({exc})", file=sys.stderr)
        return 1

    latest_tag = str(data.get("tag_name") or "").strip()
    latest_ver = latest_tag.lstrip("vV")
    html_url = str(data.get("html_url") or f"{REPO_URL}/releases/latest")
    if not latest_ver:
        print("Check Status   : 未解析到最新 Release 版本号", file=sys.stderr)
        return 1

    has_update = _parse_semver_tuple(latest_ver) > _parse_semver_tuple(PATCH_VERSION)
    print(f"Latest Release : {latest_tag}")
    print(f"Download URL   : {html_url}")
    if has_update:
        print("Update Advice  : 发现新版本汉化！请下载新版发布包或更新本地仓库后执行 install。")
    else:
        print("Update Advice  : 当前本地汉化工具已是最新版本。")
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    """Offline build mode: transform --input-asar into --output-asar."""
    result = build_patched_asar(
        source_asar=Path(args.input_asar).resolve(),
        output_asar=Path(args.output_asar).resolve(),
        dict_path=Path(args.dict).resolve(),
        engine_path=Path(args.engine).resolve(),
        block_auto_update=not args.keep_auto_update,
    )
    print(
        f"Build complete: {args.output_asar} "
        f"(v{result['version']}, {result['dict_entries']} entries, "
        f"unpacked={result['unpacked_count']}, MD5={result['md5']})"
    )
    return 0


def _configure_console_utf8() -> None:
    """Configure UTF-8 console encoding on Windows so localized output renders cleanly."""
    if platform.system() == "Windows":
        try:
            import ctypes

            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleOutputCP(65001)
            kernel32.SetConsoleCP(65001)
        except Exception:
            pass
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _stop_antigravity_processes() -> None:
    """Stop running Antigravity desktop processes on Windows before modifying ASAR."""
    if platform.system() != "Windows":
        return
    import time

    killed = False
    for proc_name in ("Antigravity.exe", "language_server_windows_x64.exe"):
        res = subprocess.run(
            ["taskkill", "/F", "/IM", proc_name],
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            killed = True
    if killed:
        time.sleep(1.5)


def _launch_antigravity_detached(exe_path: Path | None) -> None:
    """Offer to relaunch Antigravity detached from the console window on Windows."""
    if platform.system() != "Windows" or not exe_path or not exe_path.is_file():
        return
    ans = input("\n是否立即独立启动 Antigravity？[Y/n]: ").strip().lower()
    if ans == "n":
        return
    env = os.environ.copy()
    env["ELECTRON_NO_ATTACH_CONSOLE"] = "1"
    subprocess.Popen(["explorer.exe", str(exe_path)], env=env)
    print(f"[已启动] {exe_path}")


def _resolve_interactive_target(base_args: argparse.Namespace) -> Path | None:
    """Ensure base_args points to a valid installation, prompting the user if auto-detection fails."""
    try:
        _, exe_path = discover_installation(base_args.app_dir, base_args.asar)
        return exe_path
    except FileNotFoundError:
        print("\n[提示] 未在默认位置或注册表自动检测到 Antigravity。")
        raw = input("请输入 Antigravity 安装目录或 app.asar 路径（直接回车取消）: ").strip().strip('"')
        if not raw:
            raise
        if Path(raw).expanduser().is_file() or raw.lower().endswith(".asar"):
            base_args.asar = raw
            base_args.app_dir = None
        else:
            base_args.app_dir = raw
            base_args.asar = None
        _, exe_path = discover_installation(base_args.app_dir, base_args.asar)
        return exe_path


def run_interactive_menu(base_args: argparse.Namespace) -> int:
    """Interactive menu for double-click zero-dependency execution."""
    print("========================================================================")
    print("              Antigravity 深度中文汉化工具 (独立免环境版)")
    print("========================================================================")

    while True:
        print(
            "\n请选择操作:\n"
            "  [1] 注入深度汉化（推荐：含防官方后台静默升级覆盖）\n"
            "  [2] 注入深度汉化（保留官方自动更新）\n"
            "  [3] 恢复官方原版（从 app.asar.original.bak 无损还原）\n"
            "  [4] 查看当前 Antigravity 安装与汉化状态\n"
            "  [5] 检查 GitHub 最新汉化包更新\n"
            "  [0] 退出\n"
        )
        choice = input("请输入选项编号 [0-5]: ").strip()
        if choice == "0":
            return 0
        if choice not in {"1", "2", "3", "4", "5"}:
            print(f"[提示] 无效输入: {choice!r}")
            continue

        try:
            if choice == "5":
                cmd_check_update(base_args)
                input("\n按回车键返回主菜单...")
                continue

            exe_path = _resolve_interactive_target(base_args)
            run_args = argparse.Namespace(
                app_dir=base_args.app_dir,
                asar=base_args.asar,
                dict=base_args.dict,
                engine=base_args.engine,
                keep_auto_update=(choice == "2"),
            )
            if choice in {"1", "2"}:
                print("\n[准备] 正在检查并关闭运行中的 Antigravity 进程...")
                _stop_antigravity_processes()
                rc = cmd_install(run_args)
                if rc == 0:
                    print("\n[完成] 深度汉化注入成功！建议在扩展商店确认安装微软官方简体中文包，实现双层全中文。")
                    _launch_antigravity_detached(exe_path)
            elif choice == "3":
                print("\n[准备] 正在检查并关闭运行中的 Antigravity 进程...")
                _stop_antigravity_processes()
                rc = cmd_restore(run_args)
                if rc == 0:
                    _launch_antigravity_detached(exe_path)
            else:
                cmd_status(run_args)
        except KeyboardInterrupt:
            print("\n[已取消]")
        except Exception as exc:
            print(f"\n[错误] {exc}", file=sys.stderr)

        input("\n按回车键返回主菜单...")


def parse_args(argv: list[str]) -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Antigravity Chinese Localization CLI (Install / Restore / Status / Build)"
    )
    parser.add_argument("-i", "--interactive", action="store_true", help="Launch interactive menu")
    parser.add_argument("--print-exe", action="store_true", help="Print detected Antigravity executable path and exit")
    parser.add_argument("--app-dir", help="Custom Antigravity installation folder")
    parser.add_argument("--asar", help="Custom path to resources/app.asar")
    parser.add_argument("--dict", default=str(DEFAULT_DICT), help="Path to dictionary JSON")
    parser.add_argument("--engine", default=str(DEFAULT_ENGINE), help="Path to engine_preload.js")

    sub = parser.add_subparsers(dest="command")

    p_install = sub.add_parser("install", help="Backup original ASAR and apply Chinese localization (default)")
    p_install.add_argument("--app-dir", default=argparse.SUPPRESS, help="Custom Antigravity installation folder")
    p_install.add_argument("--asar", default=argparse.SUPPRESS, help="Custom path to resources/app.asar")
    p_install.add_argument(
        "--keep-auto-update",
        action="store_true",
        help="Do not disable silent autoDownload/autoInstallOnAppQuit in dist/updater.js",
    )

    p_restore = sub.add_parser("restore", help="Restore official original app.asar from backup")
    p_restore.add_argument("--app-dir", default=argparse.SUPPRESS, help="Custom Antigravity installation folder")
    p_restore.add_argument("--asar", default=argparse.SUPPRESS, help="Custom path to resources/app.asar")

    p_status = sub.add_parser("status", help="Inspect installation status and backup")
    p_status.add_argument("--app-dir", default=argparse.SUPPRESS, help="Custom Antigravity installation folder")
    p_status.add_argument("--asar", default=argparse.SUPPRESS, help="Custom path to resources/app.asar")

    p_build = sub.add_parser("build", help="Build a patched ASAR offline from --input-asar to --output-asar")
    p_build.add_argument("--input-asar", required=True, help="Clean upstream app.asar")
    p_build.add_argument("--output-asar", required=True, help="Output localized app.asar")
    p_build.add_argument("--keep-auto-update", action="store_true", help="Keep silent auto-update enabled")

    sub.add_parser("check-update", help="Check latest Chinese localization release on GitHub")

    args = parser.parse_args(argv)
    if not hasattr(args, "keep_auto_update"):
        args.keep_auto_update = False
    return args


def main(argv: list[str] | None = None) -> int:
    """CLI entrypoint."""
    _configure_console_utf8()
    raw_argv = sys.argv[1:] if argv is None else argv
    args = parse_args(raw_argv)
    try:
        if args.interactive or (getattr(sys, "frozen", False) and not raw_argv):
            return run_interactive_menu(args)

        if args.print_exe:
            _, exe = discover_installation(args.app_dir, args.asar)
            if not exe:
                return 1
            print(exe)
            return 0

        cmd = args.command or "install"
        if cmd == "install":
            return cmd_install(args)
        if cmd == "restore":
            return cmd_restore(args)
        if cmd == "status":
            return cmd_status(args)
        if cmd == "build":
            return cmd_build(args)
        if cmd == "check-update":
            return cmd_check_update(args)
        return 2
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
