# -*- coding: utf-8 -*-
"""Modular ASAR patchers for Antigravity desktop (main process & preload)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Callable

PATCH_VERSION = "2.31.5"
REPO_URL = "https://github.com/ruxiayu/antigravity-zh-cn"

PRELOAD_MARKERS = (
    "// Antigravity Chinese Localization Engine",
    "// Antigravity v",
    "// === Antigravity",
)

MENU_DICT_CODE = """
const menuTranslationMap = {
  'File': '文件',
  'Edit': '编辑',
  'View': '视图',
  'Window': '窗口',
  'Help': '帮助',
  'New Window': '新建窗口',
  'Docs': '使用文档',
  'Toggle Developer Tools': '开发者工具',
  'Check for Updates': '检查更新',
  'Checking for Updates...': '正在检查更新...',
  'Downloading Update...': '正在下载更新...',
  'Restart to Update': '重启以应用更新',
  'Connect to WSL': '连接到 WSL',
  'Reopen Locally': '在本地重新打开',
  'Undo': '撤销',
  'Redo': '重做',
  'Cut': '剪切',
  'Copy': '复制',
  'Paste': '粘贴',
  'Select All': '全选',
  'Minimize': '最小化',
  'Close': '关闭',
  'Quit Antigravity': '退出 Antigravity',
  'About Antigravity': '关于 Antigravity',
  'New Conversation': '新建对话',
  'Open Project': '打开项目',
  'Command Palette': '命令面板',
  'Preferences': '首选项',
  'Settings': '设置',
  'Reload': '重新加载',
  'Force Reload': '强制重新加载',
  'Actual Size': '实际大小',
  'Zoom In': '放大',
  'Zoom Out': '缩小',
  'Toggle Full Screen': '切换全屏',
  'Services': '服务',
  'Hide Antigravity': '隐藏 Antigravity',
  'Hide Others': '隐藏其他',
  'Show All': '显示全部'
};

function translateMenu(item) {
  if (!item) return;
  if (item.label && menuTranslationMap[item.label]) {
    item.label = menuTranslationMap[item.label];
  }
  if (item.submenu && item.submenu.items) {
    item.submenu.items.forEach(translateMenu);
  }
}
"""

CONTEXT_MENU_DICT_AND_FN = """
const contextMenuDict = {
    'Rename': '重命名',
    'Rename Conversation': '重命名会话',
    'Pin': '置顶',
    'Pin Conversation': '置顶会话',
    'Unpin': '取消置顶',
    'Unpin Conversation': '取消置顶会话',
    'Mark Unread': '标记为未读',
    'Mark as Unread': '标记为未读',
    'Mark Read': '标记为已读',
    'Mark as Read': '标记为已读',
    'Copy': '复制',
    'Copy Cascade ID': '复制 Cascade ID',
    'Copy Conversation ID': '复制会话 ID',
    'Copy ID': '复制 ID',
    'Copy Link': '复制链接',
    'Copy link': '复制链接',
    'Copy Path': '复制路径',
    'Copy Relative Path': '复制相对路径',
    'Copy Title': '复制标题',
    'Copy Message': '复制消息',
    'Copy Text': '复制文本',
    'Copy text': '复制文本',
    'Copy Code': '复制代码',
    'Copy All': '复制全部',
    'Copy Image': '复制图片',
    'Copy Full Path': '复制完整路径',
    'Copy Markdown': '复制 Markdown',
    'Copy conversation markdown': '复制对话 Markdown',
    'Save Image As...': '图片另存为...',
    'Inspect Element': '检查元素',
    'Search in Conversation': '在对话中搜索',
    'Rename Project': '重命名项目',
    'Delete Project': '删除项目',
    'Archive Project': '归档项目',
    'Unarchive Project': '取消归档项目',
    'Remove Folder from Project': '从项目中移除文件夹',
    'New Conversation in Project': '项目内新建对话',
    'Open in Terminal': '在终端中打开',
    'Connection info…': '连接信息…',
    'Split': '拆分',
    'Split from here': '从此处拆分',
    'Split Conversation': '拆分会话',
    'Split to New Session': '拆分至新会话',
    'Archive': '归档',
    'Archive Conversation': '归档会话',
    'Archive conversation': '归档会话',
    'Unarchive': '取消归档',
    'Unarchive Conversation': '取消归档会话',
    'Unarchive conversation': '取消归档会话',
    'Delete': '删除',
    'Delete Conversation': '删除会话',
    'Delete conversation': '删除会话',
    'Permanently Delete': '彻底删除',
    'Permanently delete': '彻底删除',
    'Delete Permanently': '彻底删除',
    'Delete permanently': '彻底删除',
    'Restore': '恢复',
    'Restore Conversation': '恢复会话',
    'Restore conversation': '恢复会话',
    'Cut': '剪切',
    'Paste': '粘贴',
    'Select All': '全选',
    'Open': '打开',
    'Open in New Window': '在新窗口中打开',
    'Open in Editor': '在编辑器中打开',
    'Reveal in File Explorer': '在文件资源管理器中显示',
    'Reveal in Finder': '在访达中显示',
    'Share': '分享',
    'Export': '导出',
    'Duplicate': '创建副本',
    'Conversation Name': '对话名称',
    'Conversation ID': '对话 ID',
    'Workspace Name': '工作区名称',
    'Worktree Name': '工作树名称',
    'Project Name': '项目名称',
    'Split Right': '向右拆分',
    'Split Down': '向下拆分',
    'Replace with New': '替换为新对话',
    'Remove from Split': '从拆分视图移除',
    'View Debug': '查看调试',
    'Fork': '派生',
    'Fork in Current Workspace': '在当前工作区中创建分支对话',
    'Fork in Shared Workspace': '在共享工作区中创建分支对话',
    'Fork in New Workspace': '在新工作区中创建分支对话',
    'Stop': '停止',
    'Telemetry': '遥测数据',
    'Move to Group': '移动到分组',
    'New Group': '新建分组',
    'Remove from Group': '从分组移除'
};
function translateContextMenuLabel(label) {
    if (!label) return '';
    if (label.startsWith('Move to Group: ')) {
        return '移动到分组：' + label.slice(15);
    }
    return contextMenuDict[label] || contextMenuDict[label.trim()] || label;
}

function buildContextMenuTemplate(items, onSelect) {
"""

REPLACEMENT_TABLES = {
    "updater.js": [
        ('MenuUpdateStep["CheckForUpdates"] = "Check for Updates";', 'MenuUpdateStep["CheckForUpdates"] = "检查更新";'),
        ('MenuUpdateStep["CheckingForUpdates"] = "Checking for Updates...";', 'MenuUpdateStep["CheckingForUpdates"] = "正在检查更新...";'),
        ('MenuUpdateStep["DownloadingUpdate"] = "Downloading Update...";', 'MenuUpdateStep["DownloadingUpdate"] = "正在下载更新...";'),
        ('MenuUpdateStep["RestartToUpdate"] = "Restart to Update";', 'MenuUpdateStep["RestartToUpdate"] = "重启以应用更新";'),
        ("title: 'Check for Updates',", "title: '检查更新',"),
        ("message: 'No updates available',", "message: '当前已是最新版本',"),
        ("buttons: ['OK'],", "buttons: ['确定'],"),
    ],
    "ipcHandlers.js": [
        ("showErrorBox('Cannot open folder', t.error);", "showErrorBox('无法打开文件夹', t.error);"),
        ("message: 'Folder is on the Windows filesystem',", "message: '文件夹位于 Windows 文件系统中',"),
        ("title: 'Open workspace',", "title: '打开工作区',"),
        ("title: 'Open workspaces',", "title: '打开工作区（可多选）',"),
        ("title: 'Select Download Folder',", "title: '选择下载文件夹',"),
    ],
    "webauthn.js": [
        ("return `Account ${index + 1}`;", "return `账户 ${index + 1}`;"),
        ("title: 'Choose a Passkey',", "title: '选择通行密钥 (Passkey)',"),
        ("message: `Sign in to ${rpLabel}`,", "message: `登录至 ${rpLabel}`,"),
        ("detail: 'Choose a passkey account to continue:',", "detail: '请选择用于继续操作的通行密钥账户：',"),
        ("detail: 'Select a passkey account to continue:',", "detail: '请选择用于继续操作的通行密钥账户：',"),
        ("buttons: [...accountLabels, 'Cancel'],", "buttons: [...accountLabels, '取消'],"),
    ],
    "cablev2.js": [
        ("<title>Passkeys</title>", "<title>通行密钥 (Passkeys)</title>"),
        ('<h1 class="sheet-title">Passkeys</h1>', '<h1 class="sheet-title">通行密钥 (Passkeys)</h1>'),
        ('<p class="mechanism-header">Use your phone or tablet</p>', '<p class="mechanism-header">使用手机或平板电脑</p>'),
        ("Scan this QR code with the camera on the device that has your passkey for ${safeRpId}", "使用包含 ${safeRpId} 通行密钥的设备摄像头扫描此二维码"),
        ('<button type="button" class="cancel-btn" onclick="window.close()">Cancel</button>', '<button type="button" class="cancel-btn" onclick="window.close()">取消</button>'),
        ("updateStatus('Connecting to your device…');", "updateStatus('正在连接至您的设备…');"),
        ("updateStatus('Verify on your device to continue…');", "updateStatus('请在您的设备上确认以继续…');"),
    ],
    "ideInstall/wizardHtml.js": [
        ("<title>Welcome to Antigravity</title>", "<title>欢迎使用 Antigravity</title>"),
        ("Setting up…", "正在准备中…"),
        ("<h1>Welcome to the new Antigravity!</h1>", "<h1>欢迎使用全新 Antigravity！</h1>"),
        (
            "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named <b>Antigravity IDE</b>.",
            "Antigravity 现已全面重构，以智能体（Agent）为核心带来诸多全新能力。如果您仍需要代码编辑器，可单独下载 <b>Antigravity IDE</b> 配合使用。",
        ),
        ("<span>Download the Antigravity IDE</span>", "<span>下载 Antigravity IDE</span>"),
        ("Explore the new Antigravity", "开始探索全新 Antigravity"),
    ],
    "main.js": [
        (
            r"const msg = `language_server binary not found at:\n${languageServer_1.LS_BINARY}\n\nPlease build set a valid location.`;",
            r"const msg = `未在以下路径找到 language_server 二进制文件：\n${languageServer_1.LS_BINARY}\n\n请重新编译或设置有效的路径。`;",
        ),
        ("showErrorBox('Binary not found', msg);", "showErrorBox('未找到核心程序', msg);"),
        ("title: 'WSL distro not found',", "title: '未找到 WSL 发行版',"),
        ('message: `The WSL distro "${WSL_DISTRO}" is no longer installed.`,', 'message: `WSL 发行版“${WSL_DISTRO}”已不再处于安装状态。`,'),
        ("detail: 'Antigravity opened on Windows instead.',", "detail: 'Antigravity 已改为在 Windows 本地打开。',"),
        (
            r'const msg = `Failed to install the server into WSL distro "${WSL_DISTRO}":\n${err.message}`;',
            r'const msg = `无法将服务端安装到 WSL 发行版“${WSL_DISTRO}”：\n${err.message}`;',
        ),
        ("showErrorBox('WSL setup failed', msg);", "showErrorBox('WSL 配置失败', msg);"),
        ("showErrorBox('Startup failed', msg);", "showErrorBox('启动失败', msg);"),
        (
            "            const dockMenu = electron_1.Menu.buildFromTemplate([\n                {\n                    label: 'New Window',",
            "            const dockMenu = electron_1.Menu.buildFromTemplate([\n                {\n                    label: '新建窗口',",
        ),
        ("buttons: ['Cancel', 'Quit'],", "buttons: ['取消', '退出'],"),
        ("title: 'Confirm Quit',", "title: '确认退出',"),
        ("message: 'Are you sure you want to quit?',", "message: '确定要退出吗？',"),
        ("detail: 'There may be agents or background tasks running.',", "detail: '当前仍有智能体或后台任务正在运行。',"),
    ],
    "deviceChooser.js": [
        ("hid: 'HID device',", "hid: 'HID 设备',"),
        ("usb: 'USB device',", "usb: 'USB 设备',"),
        ("serial: 'serial port',", "serial: '串口设备',"),
        ("'Unknown device'", "'未知设备'"),
        ("title: 'Connect a device',", "title: '连接设备',"),
        ("message: `${origin} wants to connect to a ${KIND_NOUNS[kind]}`,", "message: `${origin} 请求连接到${KIND_NOUNS[kind]}`,"),
        ("? 'Select a device:'", "? '请选择一个设备：'"),
        (": 'No compatible devices found.',", ": '未找到兼容的设备。',"),
        ("buttons: [...snapshot.map(({ label }) => label), 'Cancel'],", "buttons: [...snapshot.map(({ label }) => label), '取消'],"),
    ],
    "provisionSplash.js": [
        ("<div>Setting up WSL: ${escapeHtml(distro)}</div>", "<div>正在配置 WSL：${escapeHtml(distro)}</div>"),
    ],
    "webviewPopupSecurity.js": [
        ("insecure: 'Not secure',", "insecure: '不安全',"),
        ("dangerous: '⚠ Not secure',", "dangerous: '⚠ 不安全',"),
        (
            "    'Your connection to this site is not secure',\n    'You should not enter any sensitive information on this site (for ' +\n        'example, passwords or credit cards), because it could be stolen by ' +\n        'attackers.',",
            "    '您与此网站的连接不安全',\n    '建议您不要在此网站上输入任何敏感信息（例如密码或信用卡号），因为这些信息可能会被攻击者窃取。',",
        ),
        (
            "        'Connection is secure',\n        'Your information (for example, passwords or credit card numbers) is ' +\n            'private when it is sent to this site.',",
            "        '连接是安全的',\n        '您的信息（例如密码或信用卡号）在发送至此网站时会进行私密传输。',",
        ),
        ("neutral: ['Connection security information is not available for this page'],", "neutral: ['无法获取此页面的连接安全信息'],"),
        ("return ms > 0 ? new Date(ms).toLocaleString() : 'unknown';", "return ms > 0 ? new Date(ms).toLocaleString() : '未知';"),
        ("lines.push('', state.level === 'secure' ? 'Certificate is valid' : 'Certificate details');", "lines.push('', state.level === 'secure' ? '证书有效' : '证书详情');"),
        ("lines.push(`Error: ${state.certificateError}`);", "lines.push(`错误：${state.certificateError}`);"),
        (
            "lines.push(`Issued to: ${certificate.subjectName}`, `Issued by: ${certificate.issuer}`, `Valid from: ${formatDate(certificate.validFromMs)}`, `Valid until: ${formatDate(certificate.validToMs)}`);",
            "lines.push(`颁发给：${certificate.subjectName}`, `颁发者：${certificate.issuer}`, `有效期自：${formatDate(certificate.validFromMs)}`, `有效期至：${formatDate(certificate.validToMs)}`);",
        ),
        ("lines.push(`Protocol: ${certificate.protocol}`);", "lines.push(`协议：${certificate.protocol}`);"),
        ("message: extractOrigin(state.url) ?? (state.url || 'This page'),", "message: extractOrigin(state.url) ?? (state.url || '当前页面'),"),
        ("label: 'Connection info…',", "label: '连接信息…',"),
        ("title: 'Connection info',", "title: '连接信息',"),
        ("buttons: ['OK'],", "buttons: ['确定'],"),
    ],
    "wsl.js": [
        (
            'error: `This folder belongs to the WSL distro "${unc[1]}", but this window is connected to "${distro}".`,',
            'error: `此文件夹属于 WSL 发行版“${unc[1]}”，但当前窗口连接到的是“${distro}”。`,',
        ),
        (
            "warning: 'This folder is on the Windows filesystem. Accessing it from WSL (via /mnt) can be slow — for best performance keep projects inside the WSL filesystem.',",
            "warning: '此文件夹位于 Windows 文件系统中。通过 WSL（/mnt）访问速度可能较慢 — 为获得最佳性能，建议将项目存放在 WSL 文件系统内部。',",
        ),
        (
            "return { error: `This location cannot be opened in WSL: ${winPath}` };",
            "return { error: `无法在 WSL 中打开此位置：${winPath}` };",
        ),
    ],
}


def apply_pairs(text: str, pairs: list[tuple[str, str]]) -> str:
    """Apply literal string replacements sequentially."""
    for old, new in pairs:
        if old in text:
            text = text.replace(old, new)
    return text


def build_preload_engine(
    engine_template: str,
    dictionary: dict[str, str],
    target_app_version: str = "2.31.0",
    patch_version: str = PATCH_VERSION,
    is_test_preview: bool = False,
) -> str:
    """Embed dictionary JSON and metadata cleanly into engine_preload.js."""
    meta_json = json.dumps(
        {
            "patchVersion": patch_version,
            "targetAppVersion": target_app_version,
            "repoUrl": "https://github.com/ruxiayu/antigravity-zh-cn",
            "releasesUrl": "https://github.com/ruxiayu/antigravity-zh-cn/releases/latest",
            "isTestPreview": is_test_preview,
        },
        ensure_ascii=False,
    )
    meta_placeholder = "const AGY_ZH_META = {};"
    if meta_placeholder in engine_template:
        engine_template = engine_template.replace(meta_placeholder, f"const AGY_ZH_META = {meta_json};", 1)

    dict_json = json.dumps(dictionary, ensure_ascii=False)
    placeholder = "const MERGED_DICT = {};"
    if placeholder in engine_template:
        return engine_template.replace(placeholder, f"const MERGED_DICT = {dict_json};", 1)

    start_marker = "const MERGED_DICT = {"
    end_marker = "for (const [k, v] of Object.entries(MERGED_DICT))"
    idx_start = engine_template.find(start_marker)
    idx_end = engine_template.find(end_marker)
    if idx_start == -1 or idx_end == -1:
        raise ValueError("Failed to locate MERGED_DICT boundary in engine template")
    return engine_template[:idx_start] + f"const MERGED_DICT = {dict_json};\n\n  " + engine_template[idx_end:]


def strip_existing_preload_patch(preload_text: str) -> str:
    """Return upstream preload content before any previously injected engine."""
    cutoff = len(preload_text)
    for marker in PRELOAD_MARKERS:
        idx = preload_text.find(marker)
        if idx != -1 and idx < cutoff:
            cutoff = idx
    return preload_text[:cutoff].rstrip()


def patch_preload(dist_dir: Path, engine_code: str) -> None:
    """Patch dist/preload.js with the localized DOM engine."""
    target = dist_dir / "preload.js"
    original = strip_existing_preload_patch(target.read_text(encoding="utf-8"))
    target.write_text(original + "\n\n" + engine_code, encoding="utf-8")


def patch_menu(dist_dir: Path) -> None:
    """Patch dist/menu.js adaptively across Antigravity versions (including async WSL submenu)."""
    target = dist_dir / "menu.js"
    text = target.read_text(encoding="utf-8")

    dict_part = MENU_DICT_CODE.strip().split("function translateMenu")[0].strip()
    if "menuTranslationMap" not in text:
        text = text.rstrip() + "\n" + MENU_DICT_CODE
    else:
        text = re.sub(
            r"\b(?:const|let|var)\s+menuTranslationMap\s*=\s*\{[\s\S]*?\n\s*\};?",
            dict_part,
            text,
            count=1,
        )

    set_menu_re = re.compile(
        r"([ \t]*)((?:[A-Za-z_$][\w$]*\.)?Menu\.setApplicationMenu\(\s*([A-Za-z_$][\w$]*)\s*\);)"
    )

    def _hook_set_menu(match: re.Match[str]) -> str:
        indent, call_stmt, menu_var = match.groups()
        preceding = text[max(0, match.start() - 180) : match.start()]
        if "translateMenu" in preceding:
            return match.group(0)
        return (
            f'{indent}if (typeof translateMenu === "function") {{ {menu_var}.items.forEach(translateMenu); }}\n'
            f"{indent}{call_stmt}"
        )

    text = set_menu_re.sub(_hook_set_menu, text)

    add_sub_re = re.compile(
        r"const\s+submenuItem\s*=\s*([A-Za-z_$][\w$]*)\.items\.find\(\s*\(([A-Za-z_$][\w$]*)\)\s*=>\s*\2\.label\s*===\s*submenuLabel\s*\);"
    )
    text = add_sub_re.sub(
        lambda m: (
            f"const submenuItem = {m.group(1)}.items.find(({m.group(2)}) => "
            f"{m.group(2)}.label === submenuLabel || "
            f'(typeof menuTranslationMap !== "undefined" && {m.group(2)}.label === menuTranslationMap[submenuLabel]));'
        ),
        text,
    )

    target.write_text(text, encoding="utf-8")


def patch_tray(dist_dir: Path) -> None:
    """Patch dist/tray.js menu actions and running agent status adaptively & idempotently."""
    target = dist_dir / "tray.js"
    text = target.read_text(encoding="utf-8")

    # Use block-scoped unique variables & dynamic parameter capture across versions
    if "__agyZhCreateTrayMap" not in text:
        create_re = re.compile(
            r"(function\s+createTray\(\s*([A-Za-z_$][\w$]*)(?:\s*,[^)]*)?\)\s*\{)",
            re.MULTILINE,
        )
        text = create_re.sub(
            lambda m: (
                f"{m.group(1)}\n"
                "    {\n"
                "      const __agyZhCreateTrayMap = {\n"
                "        'No agents running': '无运行中的 Agent',\n"
                "        'Open Antigravity': '打开 Antigravity',\n"
                "        'Quit': '退出',\n"
                "        'Connect to WSL': '连接到 WSL'\n"
                "      };\n"
                f"      for (const __agyItem of ({m.group(2)} || [])) {{\n"
                "        if (__agyItem && __agyZhCreateTrayMap[__agyItem.label]) {\n"
                "          __agyItem.label = __agyZhCreateTrayMap[__agyItem.label];\n"
                "        }\n"
                "      }\n"
                "    }"
            ),
            text,
            count=1,
        )

    if "__agyZhInsertTrayMap" not in text:
        insert_re = re.compile(
            r"(function\s+insertTrayMenuItem\(\s*[^,]+,\s*([A-Za-z_$][\w$]*)\s*\)\s*\{)",
            re.MULTILINE,
        )
        text = insert_re.sub(
            lambda m: (
                f"{m.group(1)}\n"
                "    {\n"
                "      const __agyZhInsertTrayMap = {\n"
                "        'Connect to WSL': '连接到 WSL',\n"
                "        'Reopen Locally': '在本地重新打开'\n"
                "      };\n"
                f"      if ({m.group(2)} && {m.group(2)}.label && __agyZhInsertTrayMap[{m.group(2)}.label]) {{\n"
                f"        {m.group(2)}.label = __agyZhInsertTrayMap[{m.group(2)}.label];\n"
                "      }\n"
                "    }"
            ),
            text,
            count=1,
        )

    count_rep = """if (countItem) {
            countItem.label = count > 0 ? `${count} 个 Agent 运行中` : '无运行中的 Agent';
            tray.setContextMenu(contextMenu);
        }"""
    count_pat_v228 = re.compile(
        r"if\s*\(countItem\)\s*\{\s*countItem\.label\s*=\s*\(count\s*>\s*0\s*\?\s*`\$\{count\}`\s*:\s*'No'\)\s*\+\s*' agent'\s*\+\s*\(count\s*===\s*1\s*\?\s*''\s*:\s*'s'\)\s*\+\s*' running';\s*tray\.setContextMenu\(contextMenu\);\s*\}"
    )
    count_pat_v231 = re.compile(
        r"if\s*\(countItem\)\s*\{\s*countItem\.label\s*=\s*\(count\s*>\s*0\s*\?\s*`\$\{count\} running agents`\s*:\s*'No agents running'\);\s*tray\.setContextMenu\(contextMenu\);\s*\}"
    )
    count_pat_generic = re.compile(
        r"if\s*\(\s*countItem\s*\)\s*\{\s*countItem\.label\s*=[\s\S]*?running[\s\S]*?tray\.setContextMenu\(contextMenu\);\s*\}"
    )
    if "个 Agent 运行中" not in text:
        text, c1 = count_pat_v228.subn(count_rep, text, count=1)
        if c1 == 0:
            text, c2 = count_pat_v231.subn(count_rep, text, count=1)
            if c2 == 0:
                text = count_pat_generic.sub(count_rep, text, count=1)

    target.write_text(text, encoding="utf-8")


def patch_updater(
    dist_dir: Path,
    block_auto_update: bool = False,
    warn: Callable[[str], None] = print,
) -> None:
    """Patch dist/updater.js for reliable top-right updates & UI localization across versions."""
    target = dist_dir / "updater.js"
    text = target.read_text(encoding="utf-8")

    elec_m = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['\"]electron['\"]\);", text)
    upd_m = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['\"]electron-updater['\"]\);", text)
    types_m = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['\"]\.\/types['\"]\);", text)
    elec_mod = elec_m.group(1) if elec_m else "electron_1"
    upd_mod = upd_m.group(1) if upd_m else "electron_updater_1"
    types_mod = types_m.group(1) if types_m else "types_1"

    # 1. Helper state & toast channel (idempotent)
    text = re.sub(
        r"\r?\n?[ \t]*// --- AGY_ZH_UPDATER_HELPER_START ---[\s\S]*?// --- AGY_ZH_UPDATER_HELPER_END ---\r?\n?",
        "\n",
        text,
    )
    helper_block = (
        "// --- AGY_ZH_UPDATER_HELPER_START ---\n"
        "let __agyZhApplyOnDownload = false;\n"
        "function __agyZhBroadcastDownloadStatus(phase, percent, detail) {\n"
        "    try {\n"
        f"        const wins = typeof {elec_mod} !== 'undefined' && {elec_mod}.BrowserWindow ? {elec_mod}.BrowserWindow.getAllWindows() : [];\n"
        "        for (const w of wins) {\n"
        "            try {\n"
        "                if (w && !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) {\n"
        "                    w.webContents.send('zh-localization:official-update-status', {\n"
        "                        phase: phase || '',\n"
        "                        percent: Number(percent || 0),\n"
        "                        detail: detail || ''\n"
        "                    });\n"
        "                }\n"
        "            } catch (_e) {}\n"
        "        }\n"
        "    } catch (_e) {}\n"
        "}\n"
        "// --- AGY_ZH_UPDATER_HELPER_END ---\n"
    )
    if "function broadcastState(" in text:
        text = text.replace("function broadcastState(", helper_block + "function broadcastState(", 1)
    else:
        text = helper_block + text

    # 2. Configure autoDownload & autoInstallOnAppQuit idempotently in BOTH directions
    desired_auto_install = "false" if block_auto_update else f"{elec_mod}.app.isPackaged"
    desired_auto_download = "false" if block_auto_update else "true"

    text, c1 = re.subn(
        re.escape(upd_mod) + r"\.autoUpdater\.autoInstallOnAppQuit\s*=\s*[^;]+;",
        f"{upd_mod}.autoUpdater.autoInstallOnAppQuit = {desired_auto_install};",
        text,
    )
    if c1 == 0:
        warn("Notice: autoInstallOnAppQuit pattern did not match in dist/updater.js")

    text, c2 = re.subn(
        re.escape(upd_mod) + r"\.autoUpdater\.autoDownload\s*=\s*(?:true|false)\s*;",
        f"{upd_mod}.autoUpdater.autoDownload = {desired_auto_download};",
        text,
    )
    if c2 == 0:
        warn("Notice: autoDownload pattern did not match in dist/updater.js")

    # 3. Do not falsely lock Help menu to "Downloading Update..." before download starts
    avail_re = re.compile(
        r"(on\(\s*['\"]update-available['\"][\s\S]{0,350}?)updateMenuState\(\s*MenuUpdateStep\.DownloadingUpdate\s*\)\s*;"
    )
    text = avail_re.sub(
        lambda m: f"{m.group(1)}updateMenuState({upd_mod}.autoUpdater.autoDownload ? MenuUpdateStep.DownloadingUpdate : MenuUpdateStep.CheckForUpdates);",
        text,
        count=1,
    )

    # 4. Track & broadcast live download progress when user initiated apply
    prog_block = (
        "// --- AGY_ZH_DL_PROG_START ---\n"
        f"    {upd_mod}.autoUpdater.on('download-progress', (progressObj) => {{\n"
        f"        broadcastState({{ type: {types_mod}.UpdateState.Downloading }});\n"
        "        updateMenuState(MenuUpdateStep.DownloadingUpdate);\n"
        "        if (typeof __agyZhApplyOnDownload !== 'undefined' && __agyZhApplyOnDownload) {\n"
        "            __agyZhBroadcastDownloadStatus('downloading', Math.round((progressObj && progressObj.percent) || 0), (getLastState() && getLastState().update && getLastState().update.version) || '');\n"
        "        }\n"
        "    });\n"
        "    // --- AGY_ZH_DL_PROG_END ---"
    )
    if "// --- AGY_ZH_DL_PROG_START ---" in text:
        text = re.sub(
            r"// --- AGY_ZH_DL_PROG_START ---[\s\S]*?// --- AGY_ZH_DL_PROG_END ---",
            prog_block,
            text,
            count=1,
        )
    else:
        prog_orig_re = re.compile(
            re.escape(upd_mod)
            + r"\.autoUpdater\.on\(\s*'download-progress'\s*,\s*\(\)\s*=>\s*\{\s*broadcastState\(\s*\{\s*type:\s*"
            + re.escape(types_mod)
            + r"\.UpdateState\.Downloading\s*\}\s*\);\s*updateMenuState\(\s*MenuUpdateStep\.DownloadingUpdate\s*\);\s*\}\s*\);"
        )
        text = prog_orig_re.sub(prog_block, text, count=1)

    # 5. Auto-launch installer after download completes if user already clicked top-right Update
    text = re.sub(
        r"\r?\n?[ \t]*// --- AGY_ZH_DL_DONE_START ---[\s\S]*?// --- AGY_ZH_DL_DONE_END ---",
        "",
        text,
    )
    done_anchor = "updateMenuState(MenuUpdateStep.RestartToUpdate);"
    if done_anchor in text:
        done_hook = (
            done_anchor
            + "\n        // --- AGY_ZH_DL_DONE_START ---\n"
            "        if (typeof __agyZhApplyOnDownload !== 'undefined' && __agyZhApplyOnDownload) {\n"
            "            __agyZhApplyOnDownload = false;\n"
            "            __agyZhBroadcastDownloadStatus('ready', 100, (info && info.version) || '');\n"
            f"            if ({elec_mod}.app.isPackaged) {{\n"
            "                setTimeout(() => { quitAndInstall(); }, 250);\n"
            "            }\n"
            "        }\n"
            "        // --- AGY_ZH_DL_DONE_END ---"
        )
        text = text.replace(done_anchor, done_hook, 1)

    # 6. Reset apply-on-download state cleanly on updater error
    text = re.sub(
        r"\r?\n?[ \t]*// --- AGY_ZH_DL_ERR_START ---[\s\S]*?// --- AGY_ZH_DL_ERR_END ---",
        "",
        text,
    )
    err_re = re.compile(
        r"(on\(\s*['\"]error['\"][\s\S]{0,250}?updateMenuState\(\s*MenuUpdateStep\.CheckForUpdates\s*\);)"
    )
    text = err_re.sub(
        lambda m: (
            m.group(1)
            + "\n        // --- AGY_ZH_DL_ERR_START ---\n"
            "        if (typeof __agyZhApplyOnDownload !== 'undefined' && __agyZhApplyOnDownload) {\n"
            "            __agyZhApplyOnDownload = false;\n"
            "            __agyZhBroadcastDownloadStatus('error', 0, String((err && err.message) || err || ''));\n"
            "        }\n"
            "        // --- AGY_ZH_DL_ERR_END ---"
        ),
        text,
        count=1,
    )

    # 7. Guarantee top-right Update button click downloads + auto-installs in BOTH modes
    apply_block = (
        "// --- AGY_ZH_APPLY_HOST_START ---\n"
        f"        case {types_mod}.UpdateState.AvailableForDownload:\n"
        "            console.log('[AutoUpdater] User clicked update button. Starting download...');\n"
        "            __agyZhApplyOnDownload = true;\n"
        f"            broadcastState({{ type: {types_mod}.UpdateState.Downloading, update: state.update }});\n"
        "            updateMenuState(MenuUpdateStep.DownloadingUpdate);\n"
        "            __agyZhBroadcastDownloadStatus('downloading', 0, (state.update && state.update.version) || '');\n"
        f"            {upd_mod}.autoUpdater.downloadUpdate().catch((err) => {{\n"
        "                console.error('[AutoUpdater] Download failed:', err?.message || err);\n"
        "                __agyZhApplyOnDownload = false;\n"
        "                __agyZhBroadcastDownloadStatus('error', 0, String((err && err.message) || err || ''));\n"
        f"                broadcastState({{ type: {types_mod}.UpdateState.Idle }});\n"
        "                updateMenuState(MenuUpdateStep.CheckForUpdates);\n"
        "            });\n"
        "            return true;\n"
        f"        case {types_mod}.UpdateState.Downloading:\n"
        "            console.log('[AutoUpdater] Update already in progress; will apply automatically upon completion.');\n"
        "            __agyZhApplyOnDownload = true;\n"
        "            __agyZhBroadcastDownloadStatus('downloading', 0, (state.update && state.update.version) || '');\n"
        "            return true;\n"
        "        // --- AGY_ZH_APPLY_HOST_END ---"
    )
    if "// --- AGY_ZH_APPLY_HOST_START ---" in text:
        text = re.sub(
            r"// --- AGY_ZH_APPLY_HOST_START ---[\s\S]*?// --- AGY_ZH_APPLY_HOST_END ---",
            apply_block,
            text,
            count=1,
        )
    else:
        dl_regex = (
            r"case "
            + re.escape(types_mod)
            + r"\.UpdateState\.AvailableForDownload:[\s\S]*?case "
            + re.escape(types_mod)
            + r"\.UpdateState\.Downloading:[\s\S]*?return true;"
        )
        text, c3 = re.subn(dl_regex, apply_block, text, count=1)
        if c3 != 1:
            warn("Notice: AvailableForDownload handler did not match in dist/updater.js")

    text = text.replace("message: '当前已是最新版本，暂无可用更新',", "message: '当前已是最新版本',")
    text = apply_pairs(text, REPLACEMENT_TABLES["updater.js"])
    target.write_text(text, encoding="utf-8")


def _build_update_ipc_block(target_app_version: str, patch_version: str) -> str:
    """Build idempotent main-process IPC handler snippet for in-app download, update & restart."""
    return f"""    // --- AGY_ZH_UPDATE_IPC_START ---
    const __agyZhRepoBase = {json.dumps(REPO_URL)};
    const __agyZhApiUrl = 'https://api.github.com/repos/ruxiayu/antigravity-zh-cn/releases/latest';
    const __agyZhPatchVer = {json.dumps(patch_version)};
    const __agyZhTargetAppVer = {json.dumps(target_app_version)};
    let __agyZhDownloadState = {{
        status: 'idle',
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        error: '',
        stagedPath: '',
        assetName: ''
    }};

    function __agyZhCompareVer(a, b) {{
        const pa = String(a || '').replace(/^v/i, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
        const pb = String(b || '').replace(/^v/i, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {{
            const da = pa[i] || 0, db = pb[i] || 0;
            if (da !== db) return da > db ? 1 : -1;
        }}
        return 0;
    }}
    function __agyZhFetchLatestRelease(timeoutMs = 5000) {{
        return new Promise((resolve) => {{
            let settled = false;
            let req = null;
            const done = (res) => {{
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(res);
            }};
            const timer = setTimeout(() => {{
                try {{ if (req) req.abort(); }} catch {{}}
                done({{ ok: false, error: '请求超时（GitHub API 响应较慢）' }});
            }}, timeoutMs);
            try {{
                req = electron_1.net.request({{ method: 'GET', url: __agyZhApiUrl }});
                req.setHeader('User-Agent', 'antigravity-zh-cn/' + __agyZhPatchVer);
                req.setHeader('Accept', 'application/vnd.github+json');
                let raw = '';
                req.on('response', (resp) => {{
                    if (resp.statusCode && resp.statusCode >= 400) {{
                        done({{ ok: false, error: 'GitHub API HTTP ' + resp.statusCode }});
                        return;
                    }}
                    resp.on('data', (chunk) => {{
                        raw += chunk.toString('utf8');
                        if (raw.length > 524288) {{
                            try {{ if (req) req.abort(); }} catch {{}}
                            done({{ ok: false, error: '响应体积超出限制' }});
                        }}
                    }});
                    resp.on('end', () => {{
                        try {{
                            const data = JSON.parse(raw);
                            const latestTag = String(data.tag_name || '');
                            const latestVersion = latestTag.replace(/^v/i, '');
                            if (!latestVersion) {{
                                done({{ ok: false, error: '未解析到发布版本号' }});
                                return;
                            }}
                            const body = String(data.body || '').replace(/\\r\\n/g, '\\n').trim();
                            let assetUrl = '';
                            let assetName = '';
                            let assetSize = 0;
                            if (Array.isArray(data.assets)) {{
                                const pickAsset = (ext) => data.assets.find((a) => String(a.name || '').toLowerCase().endsWith(ext));
                                const chosen = (process.platform === 'win32'
                                    ? (pickAsset('.exe') || pickAsset('.asar') || pickAsset('.zip'))
                                    : (pickAsset('.asar') || pickAsset('.zip') || pickAsset('.exe')));
                                if (chosen) {{
                                    assetUrl = String(chosen.browser_download_url || '');
                                    assetName = String(chosen.name || '');
                                    assetSize = Number(chosen.size || 0);
                                }}
                            }}
                            done({{
                                ok: true,
                                latestTag,
                                latestVersion,
                                htmlUrl: String(data.html_url || (__agyZhRepoBase + '/releases/latest')),
                                publishedAt: String(data.published_at || ''),
                                releaseTitle: String(data.name || latestTag),
                                notesPreview: body.slice(0, 260),
                                hasUpdate: __agyZhCompareVer(latestVersion, __agyZhPatchVer) > 0,
                                assetUrl,
                                assetName,
                                assetSize,
                            }});
                        }} catch (_err) {{
                            done({{ ok: false, error: '响应 JSON 解析失败' }});
                        }}
                    }});
                }});
                req.on('error', (err) => done({{ ok: false, error: String((err && err.message) || err || '网络错误') }}));
                req.end();
            }} catch (err) {{
                done({{ ok: false, error: String((err && err.message) || err || '请求异常') }});
            }}
        }});
    }}
    if (typeof electron_1.ipcMain?.handle === 'function') {{
        try {{ electron_1.ipcMain.removeHandler('zh-localization:get-meta'); }} catch {{}}
        try {{ electron_1.ipcMain.removeHandler('zh-localization:check-update'); }} catch {{}}
        try {{ electron_1.ipcMain.removeHandler('zh-localization:open-release'); }} catch {{}}
        try {{ electron_1.ipcMain.removeHandler('zh-localization:get-download-status'); }} catch {{}}
        try {{ electron_1.ipcMain.removeHandler('zh-localization:download-update'); }} catch {{}}
        try {{ electron_1.ipcMain.removeHandler('zh-localization:apply-and-restart'); }} catch {{}}

        electron_1.ipcMain.handle('zh-localization:get-meta', () => {{
            const appVer = String(electron_1.app?.getVersion?.() || __agyZhTargetAppVer);
            return {{
                appVersion: appVer,
                patchVersion: __agyZhPatchVer,
                targetAppVersion: __agyZhTargetAppVer,
                versionMismatch: __agyZhCompareVer(appVer, __agyZhTargetAppVer) !== 0,
                repoUrl: __agyZhRepoBase,
                releasesUrl: __agyZhRepoBase + '/releases/latest',
            }};
        }});

        electron_1.ipcMain.handle('zh-localization:check-update', async () => {{
            const appVer = String(electron_1.app?.getVersion?.() || __agyZhTargetAppVer);
            const res = await __agyZhFetchLatestRelease(5000);
            return Object.assign({{
                appVersion: appVer,
                patchVersion: __agyZhPatchVer,
                targetAppVersion: __agyZhTargetAppVer,
                versionMismatch: __agyZhCompareVer(appVer, __agyZhTargetAppVer) !== 0,
                checkedAt: Date.now(),
            }}, res);
        }});

        electron_1.ipcMain.handle('zh-localization:open-release', (_event, targetUrl) => {{
            const url = typeof targetUrl === 'string' ? targetUrl.trim() : '';
            const safeUrl = url.startsWith(__agyZhRepoBase) ? url : (__agyZhRepoBase + '/releases/latest');
            return electron_1.shell.openExternal(safeUrl);
        }});

        electron_1.ipcMain.handle('zh-localization:get-download-status', () => {{
            return __agyZhDownloadState;
        }});

        electron_1.ipcMain.handle('zh-localization:download-update', async (_event, opts = {{}}) => {{
            const isSimulated = Boolean(opts && opts.isSimulated);
            if (isSimulated) {{
                __agyZhDownloadState = {{
                    status: 'downloading',
                    percent: 0,
                    receivedBytes: 0,
                    totalBytes: 25 * 1024 * 1024,
                    error: '',
                    stagedPath: 'simulated',
                    assetName: 'app.asar (测试预览模拟)'
                }};
                let p = 0;
                const simTimer = setInterval(() => {{
                    p += 20;
                    if (p >= 100) {{
                        p = 100;
                        clearInterval(simTimer);
                        __agyZhDownloadState.status = 'ready';
                        __agyZhDownloadState.percent = 100;
                        __agyZhDownloadState.receivedBytes = __agyZhDownloadState.totalBytes;
                    }} else {{
                        __agyZhDownloadState.percent = p;
                        __agyZhDownloadState.receivedBytes = Math.floor((p / 100) * __agyZhDownloadState.totalBytes);
                    }}
                }}, 250);
                return {{ ok: true, simulated: true }};
            }}

            const downloadUrl = (opts && opts.downloadUrl) || '';
            if (!downloadUrl) {{
                __agyZhDownloadState = {{
                    status: 'error',
                    percent: 0,
                    receivedBytes: 0,
                    totalBytes: 0,
                    error: '未获取到新版下载链接，请前往 GitHub 手动下载',
                    stagedPath: '',
                    assetName: ''
                }};
                return {{ ok: false, error: __agyZhDownloadState.error }};
            }}

            const fs = require('fs');
            const path = require('path');
            const tempDir = path.join(electron_1.app.getPath('temp'), 'antigravity-zh-update');
            if (!fs.existsSync(tempDir)) {{
                try {{ fs.mkdirSync(tempDir, {{ recursive: true }}); }} catch (_e) {{}}
            }}
            const filename = path.basename(downloadUrl.split('?')[0]) || 'app.asar';
            const stagedFile = path.join(tempDir, filename);

            __agyZhDownloadState = {{
                status: 'downloading',
                percent: 0,
                receivedBytes: 0,
                totalBytes: Number(opts.totalBytes || 0),
                error: '',
                stagedPath: stagedFile,
                assetName: filename
            }};

            return new Promise((resolve) => {{
                try {{
                    const outStream = fs.createWriteStream(stagedFile);
                    const req = electron_1.net.request({{ method: 'GET', url: downloadUrl }});
                    req.setHeader('User-Agent', 'antigravity-zh-cn/' + __agyZhPatchVer);
                    req.on('response', (resp) => {{
                        if (resp.statusCode >= 400) {{
                            __agyZhDownloadState.status = 'error';
                            __agyZhDownloadState.error = '下载响应异常: HTTP ' + resp.statusCode;
                            outStream.close();
                            resolve({{ ok: false, error: __agyZhDownloadState.error }});
                            return;
                        }}
                        const len = parseInt(resp.headers['content-length'] || opts.totalBytes || 0, 10);
                        if (len > 0) __agyZhDownloadState.totalBytes = len;

                        resp.on('data', (chunk) => {{
                            outStream.write(chunk);
                            __agyZhDownloadState.receivedBytes += chunk.length;
                            if (__agyZhDownloadState.totalBytes > 0) {{
                                __agyZhDownloadState.percent = Math.min(99, Math.floor((__agyZhDownloadState.receivedBytes / __agyZhDownloadState.totalBytes) * 100));
                            }}
                        }});
                        resp.on('end', () => {{
                            outStream.end(() => {{
                                __agyZhDownloadState.status = 'ready';
                                __agyZhDownloadState.percent = 100;
                                resolve({{ ok: true, stagedPath: stagedFile }});
                            }});
                        }});
                    }});
                    req.on('error', (err) => {{
                        outStream.close();
                        __agyZhDownloadState.status = 'error';
                        __agyZhDownloadState.error = String((err && err.message) || err || '网络中断');
                        resolve({{ ok: false, error: __agyZhDownloadState.error }});
                    }});
                    req.end();
                }} catch (e) {{
                    __agyZhDownloadState.status = 'error';
                    __agyZhDownloadState.error = String((e && e.message) || e);
                    resolve({{ ok: false, error: __agyZhDownloadState.error }});
                }}
            }});
        }});

        electron_1.ipcMain.handle('zh-localization:apply-and-restart', async (_event, opts = {{}}) => {{
            const fs = require('fs');
            const path = require('path');
            const cp = require('child_process');
            const isSimulated = Boolean(opts && opts.isSimulated);

            const exePath = electron_1.app?.getPath('exe') || process.execPath;
            const appDir = path.dirname(exePath);
            const targetAsar = path.join(appDir, 'resources', 'app.asar');
            const tempDir = electron_1.app.getPath('temp');

            if (isSimulated || __agyZhDownloadState.stagedPath === 'simulated') {{
                const batPath = path.join(tempDir, 'agy_zh_simulated_restart.bat');
                const batContent = [
                    '@echo off',
                    'chcp 65001 >nul',
                    'echo 正在执行测试预览模拟重启...',
                    'ping -n 3 127.0.0.1 >nul',
                    'set "ELECTRON_NO_ATTACH_CONSOLE=1"',
                    'start "" "' + exePath + '"',
                    'exit /b 0'
                ].join('\\r\\n');
                fs.writeFileSync(batPath, batContent, 'utf8');
                const child = cp.spawn('cmd.exe', ['/c', batPath], {{
                    detached: true,
                    stdio: 'ignore',
                    windowsHide: true,
                }});
                child.unref();
                setTimeout(() => {{ electron_1.app.quit(); }}, 150);
                return {{ ok: true, restarted: true, simulated: true }};
            }}

            const stagedPath = __agyZhDownloadState.stagedPath;
            if (!stagedPath || !fs.existsSync(stagedPath)) {{
                return {{ ok: false, error: '未找到已下载补丁文件: ' + stagedPath }};
            }}

            const backupDir = fs.existsSync('G:\\\\Anget backup')
                ? 'G:\\\\Anget backup\\\\Antigravity_auto_update_backup'
                : path.join(appDir, 'resources');
            const batPath = path.join(tempDir, 'agy_zh_apply_update.bat');

            const batLines = [
                '@echo off',
                'chcp 65001 >nul',
                'title Antigravity 中文汉化热更新中...',
                'set /a tries=0',
                ':WAIT_LOOP',
                'set /a tries+=1',
                'tasklist /FI "IMAGENAME eq Antigravity.exe" 2>nul | find /I "Antigravity.exe" >nul',
                'if not errorlevel 1 (',
                '    if %tries% GEQ 6 taskkill /F /IM Antigravity.exe >nul 2>&1',
                '    ping -n 2 127.0.0.1 >nul',
                '    goto WAIT_LOOP',
                ')',
                'taskkill /F /IM language_server_windows_x64.exe >nul 2>&1',
                'ping -n 2 127.0.0.1 >nul',
                'if not exist "' + backupDir + '" mkdir "' + backupDir + '" >nul 2>&1',
                'copy /y "' + targetAsar + '" "' + backupDir + '\\\\app.asar.before_hot_update" >nul',
            ];

            if (stagedPath.toLowerCase().endsWith('.exe')) {{
                batLines.push('"' + stagedPath + '" install --app-dir "' + appDir + '"');
                batLines.push('set "ELECTRON_NO_ATTACH_CONSOLE=1"');
                batLines.push('start "" "' + exePath + '"');
            }} else {{
                batLines.push('copy /y "' + stagedPath + '" "' + targetAsar + '" >nul');
                batLines.push('set "ELECTRON_NO_ATTACH_CONSOLE=1"');
                batLines.push('start "" "' + exePath + '"');
            }}
            batLines.push('exit /b 0');

            fs.writeFileSync(batPath, batLines.join('\\r\\n'), 'utf8');
            const child = cp.spawn('cmd.exe', ['/c', batPath], {{
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            }});
            child.unref();
            setTimeout(() => {{ electron_1.app.quit(); }}, 150);
            return {{ ok: true, applied: true }};
        }});
    }}
    // --- AGY_ZH_UPDATE_IPC_END ---
"""


def patch_ipc_handlers(
    dist_dir: Path,
    target_app_version: str = "2.31.0",
    patch_version: str = PATCH_VERSION,
    warn: Callable[[str], None] = print,
) -> None:
    """Patch dist/ipcHandlers.js adaptively across versions (context menus, native dialogs, updater:apply, update IPC)."""
    target = dist_dir / "ipcHandlers.js"
    text = target.read_text(encoding="utf-8")

    elec_m = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['\"]electron['\"]\);", text)
    upd_m = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['\"]\.\/updater['\"]\);", text)
    types_m = re.search(r"const\s+([A-Za-z_$][\w$]*)\s*=\s*require\(['\"]\.\/types['\"]\);", text)
    elec_mod = elec_m.group(1) if elec_m else "electron_1"
    upd_mod = upd_m.group(1) if upd_m else "updater_1"
    types_mod = types_m.group(1) if types_m else "types_1"

    dict_only = CONTEXT_MENU_DICT_AND_FN.strip().rsplit("function buildContextMenuTemplate", 1)[0].strip()
    if "translateContextMenuLabel" not in text:
        if re.search(r"\b(?:const|let|var)\s+contextMenuDict\s*=", text):
            text = re.sub(
                r"\b(?:const|let|var)\s+contextMenuDict\s*=\s*\{[\s\S]*?\n\s*\};?",
                "",
                text,
                count=1,
            )
        ctx_fn_re = re.compile(r"function\s+buildContextMenuTemplate\s*\([^)]*\)\s*\{")
        text, ctx_cnt = ctx_fn_re.subn(
            lambda m: dict_only + "\n\n" + m.group(0),
            text,
            count=1,
        )
        if ctx_cnt == 0:
            text = dict_only + "\n\n" + text
        text = re.sub(
            r"label:\s*(?!translateContextMenuLabel\()(item(?:\?\.)?\.label(?:\s*\?\?\s*['\"]{2})?)\s*,",
            lambda m: (
                f"label: translateContextMenuLabel({m.group(1).split('??')[0].strip()}) ?? '',"
                if "??" in m.group(1)
                else f"label: translateContextMenuLabel({m.group(1).strip()}),"
            ),
            text,
        )
    else:
        text = re.sub(
            r"\b(?:const|let|var)\s+contextMenuDict\s*=\s*\{[\s\S]*?\n\s*\};?\s*\nfunction\s+translateContextMenuLabel\([^\)]*\)\s*\{[\s\S]*?\n\}",
            dict_only,
            text,
            count=1,
        )

    # Fix updater:apply so invoking updater:apply directly delegates to applyHostUpdate()
    # rather than blindly marking un-downloaded state as Ready.
    updater_apply_re = re.compile(
        r"("
        + re.escape(elec_mod)
        + r"\.ipcMain\.handle\(\s*['\"]updater:apply['\"]\s*,\s*async\s*\(\)\s*=>\s*\{)[\s\S]{0,220}?(\n\s*\}\);)"
    )
    text = updater_apply_re.sub(
        lambda m: (
            f"{m.group(1)}\n"
            f"        if (typeof (0, {upd_mod}.applyHostUpdate) === 'function') {{\n"
            f"            return (0, {upd_mod}.applyHostUpdate)();\n"
            "        }\n"
            f"        (0, {upd_mod}.broadcastState)({{ type: {types_mod}.UpdateState.Ready }});"
            f"{m.group(2)}"
        ),
        text,
        count=1,
    )

    text = re.sub(
        r"\r?\n[ \t]*// --- AGY_ZH_UPDATE_IPC_START ---[\s\S]*?// --- AGY_ZH_UPDATE_IPC_END ---\r?\n?",
        "\n",
        text,
    )
    ipc_block = _build_update_ipc_block(target_app_version=target_app_version, patch_version=patch_version)
    if elec_mod != "electron_1":
        ipc_block = ipc_block.replace("electron_1.", f"{elec_mod}.")

    reg_anchor = "(0, wcvIpcHandlers_1.registerWcvIpcHandlers)(undefined, undefined, storageManager);"
    reg_fn_re = re.compile(r"(function\s+registerIpcHandlers\s*\([^)]*\)\s*\{)")
    if reg_anchor in text:
        text = text.replace(reg_anchor, ipc_block + "    " + reg_anchor, 1)
    elif reg_fn_re.search(text):
        text = reg_fn_re.sub(lambda m: m.group(1) + "\n" + ipc_block, text, count=1)
    else:
        warn("Notice: registerIpcHandlers anchor did not match in dist/ipcHandlers.js")

    text = apply_pairs(text, REPLACEMENT_TABLES["ipcHandlers.js"])
    target.write_text(text, encoding="utf-8")


def patch_table_modules(dist_dir: Path) -> list[str]:
    """Patch auxiliary main-process & wizard JS modules via mapping tables."""
    touched: list[str] = []
    for rel in (
        "webauthn.js",
        "cablev2.js",
        "ideInstall/wizardHtml.js",
        "main.js",
        "deviceChooser.js",
        "provisionSplash.js",
        "webviewPopupSecurity.js",
        "wsl.js",
    ):
        target = dist_dir / rel
        if not target.exists():
            continue
        text = target.read_text(encoding="utf-8")
        updated = apply_pairs(text, REPLACEMENT_TABLES[rel])
        if updated != text:
            target.write_text(updated, encoding="utf-8")
        touched.append(rel)
    return touched


def apply_all_patches(
    extracted_dir: Path,
    engine_template: str,
    dictionary: dict[str, str],
    block_auto_update: bool = False,
    is_test_preview: bool = False,
    warn: Callable[[str], None] = print,
) -> list[str]:
    """Run all localization patches inside an extracted ASAR directory."""
    dist_dir = extracted_dir / "dist"
    app_ver = "2.31.0"
    pkg_path = extracted_dir / "package.json"
    if pkg_path.exists():
        try:
            app_ver = str(json.loads(pkg_path.read_text(encoding="utf-8")).get("version", app_ver))
        except Exception:
            pass
    engine_code = build_preload_engine(
        engine_template,
        dictionary,
        target_app_version=app_ver,
        patch_version=PATCH_VERSION,
        is_test_preview=is_test_preview,
    )
    patch_preload(dist_dir, engine_code)
    patch_menu(dist_dir)
    patch_tray(dist_dir)
    patch_updater(dist_dir, block_auto_update=block_auto_update, warn=warn)
    patch_ipc_handlers(dist_dir, target_app_version=app_ver, patch_version=PATCH_VERSION, warn=warn)
    touched = patch_table_modules(dist_dir)
    return ["preload.js", "menu.js", "tray.js", "updater.js", "ipcHandlers.js"] + touched
