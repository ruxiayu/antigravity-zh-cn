# Antigravity Deep Chinese Localization (`antigravity-zh-cn`)

[简体中文](README.md) | **English**

> An open-source, non-destructive Simplified Chinese localization patcher for **Antigravity Desktop (Electron)**, featuring a **6,618-entry UI dictionary**, a **dynamic Shadow DOM & regex translation engine**, native main-process patching, automatic backup, and one-click lossless restore.

## Key Features

- **Zero-Config Path Discovery**
  - **Windows**: Automatically reads the Windows Uninstall Registry (`InstallLocation`) and standard folders (`%LOCALAPPDATA%\Programs\antigravity`, `Program Files\Antigravity`).
  - **macOS / Linux**: Automatically probes `/Applications/Antigravity.app`, `/opt/Antigravity`, `/usr/share/antigravity`, and accepts `--app-dir` or `--asar`.
- **Two-Layer Deep Localization (Main Process + Renderer)**
  - **Dynamic DOM Engine (`src/engine_preload.js`)**:
    - `MutationObserver` with Shadow DOM traversal covering dialogs, tooltips, popovers, settings pages, model pickers, and quota cards.
    - Context-aware formatters: cross-node quota restructuring (`77% left` -> `77% 剩余`), reset timers (`5h limit` -> `5小时限额`, `Resets in 2d 17h` -> `2天17小时后重置`), dynamic model group tooltips, and voice/notification labels.
  - **Main-Process Native Patches (`src/patches_main.py`)**:
    - Native application menus (`dist/menu.js`), native conversation context menus & dialogs (`dist/ipcHandlers.js`), tray menus (`dist/tray.js`), updater UI + optional silent update protection (`dist/updater.js`), Passkey/WebAuthn prompts (`dist/webauthn.js`, `dist/cablev2.js`), and setup wizards (`dist/ideInstall/wizardHtml.js`, etc.).
- **Safe, Reversible & Built-in Verification**
  - Preserves original archive as `app.asar.original.bak` before patching so `restore` rolls back cleanly.
  - Built-in pure-Python ASAR extraction/packing fallback requires **no Node.js runtime** for end users (when `node` is present, pre-pack `node --check` syntax verification runs automatically).
  - Ships **no** proprietary Antigravity installers, binaries, or modified `.asar` files.

## Dual-Layer Setup Recommendation

Because Antigravity combines VS Code with custom Electron views:

1. **Base Layer (VS Code UI)**: Install Microsoft's **`Chinese (Simplified) (简体中文) Language Pack for Visual Studio Code`** from Extensions inside Antigravity and set display language to `zh-cn`.
2. **Core Layer (Antigravity Views & Native Menus)**: Apply this patcher to localize the Agent chat UI, quota cards, settings panels, native menus, tray status, and WebAuthn prompts.

## Quick Start

### Option A: Zero-Dependency Windows Executable (Recommended for End Users)

1. Download the standalone executable from [GitHub Releases](../../releases) (or build it locally via `python scripts/build_standalone.py`).
2. Double-click `Antigravity-zh-cn-win-x64.exe` — no Python or Node.js required.
3. Choose **`[1] 注入深度汉化`** in the interactive menu.

### Option B: Run From Source (Windows / macOS / Linux)

Requirements: **Python 3.8+** (optional **Node.js 18+** for pre-pack JS syntax verification & E2E tests).

```bash
# Inspect detected installation & localization status
python src/localize.py status

# Backup original ASAR and apply localization (disables silent auto-update overwrite by default)
python src/localize.py install

# Keep upstream silent auto-update enabled
python src/localize.py install --keep-auto-update

# Lossless rollback to original app.asar
python src/localize.py restore

# Specify custom install directory or ASAR file
python src/localize.py install --app-dir "/path/to/Antigravity"
```

Windows source users can also double-click `scripts/Antigravity一键汉化工具.bat`; macOS/Linux users can run `scripts/localize.sh`.

## Offline Build & Verification

```bash
# Build localized ASAR offline without touching local installation
python src/localize.py build \
  --input-asar "/path/to/vanilla/app.asar" \
  --output-asar "/path/to/output/app.asar"

# Run automated E2E DOM + dictionary checks (Node.js 18+)
npm test

# Optional: also verify extracted dist/ main-process modules
node tests/verify_e2e.js --dist-dir "/path/to/extracted/dist"
```

## Disclaimer & License

This project only provides local UI localization scripts and dictionaries for personal convenience. It is not affiliated with Google or Antigravity. No official proprietary binaries are distributed here.

Licensed under the [MIT License](LICENSE).
