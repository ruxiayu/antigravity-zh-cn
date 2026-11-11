# Antigravity 深度中文汉化工具 (`antigravity-zh-cn`)

**简体中文** | [English](README_EN.md)

> 专为 **Antigravity Desktop (Electron)** 打造的开源、非侵入式深度简体中文补丁工具，内置 **6,600+ 词条全量 UI 词典** 与 **前端动态 DOM / 主进程双层汉化引擎**，支持一键备份、自动检测安装目录、安全重装及无损还原。

## 核心特性

- **开箱即用，自动探测安装路径**
  - **Windows**：自动读取卸载注册表 (`InstallLocation`) 及常见安装路径（`%LOCALAPPDATA%\Programs\antigravity`、`Program Files\Antigravity`）。
  - **macOS / Linux**：自动探测 `/Applications/Antigravity.app`、`/opt/Antigravity`、`/usr/share/antigravity` 等常见目录，也支持 `--app-dir` / `--asar` 手动指定。
- **双层深度汉化覆盖（主进程 + 渲染进程）**
  - **前端动态 DOM 引擎 (`src/engine_preload.js`)**：
    - `MutationObserver` + Shadow DOM 穿透监听，支持弹窗 (`dialog` / `alertdialog`)、悬浮提示 (`tooltip` / `popover`)、设置面板、模型选择卡片与用量面板。
    - 智能动态规则：跨 DOM 节点剩余额度重组（如 `77% left` → `77% 剩余`）、限额与倒计时格式转换（`5h limit` → `5小时限额`、`Resets in 2d 17h` → `2天17小时后重置`）、动态模型组 Tooltip 拼接及语音/通知设置本地化。
    - 词典覆盖 **6,629 条**官方界面词条（持续维护）。
  - **Electron 主进程原生模块 (`src/patches_main.py`)**：
    - `dist/menu.js`：系统顶部原生应用菜单（文件/编辑/视图/窗口/帮助及动态 WSL 子菜单）。
    - `dist/ipcHandlers.js`：会话与消息原生右键上下文菜单及原生弹窗对话框。
    - `dist/tray.js`：系统任务栏托盘菜单及运行中的 Agent 实时计数。
    - `dist/updater.js`：检查更新提示与可选的后台静默更新拦截（默认启用防止官方英文覆盖，可通过 `--keep-auto-update` 关闭）。
    - `dist/webauthn.js` / `dist/cablev2.js`：Passkey 通行密钥二维码扫码与跨端设备握手提示。
    - `dist/ideInstall/wizardHtml.js` 等安装向导与辅助弹窗模块（`main.js`、`deviceChooser.js`、`provisionSplash.js`、`webviewPopupSecurity.js`、`wsl.js`）。
- **安全可逆与零外部运行依赖**
  - 首次注入前自动备份原始文件为 `app.asar.original.bak`，支持一键 `restore` 无损回滚至官方原版。
  - 内置纯 Python Electron ASAR 解包/打包编解码器（`src/asar_codec.py`，支持 SHA-256 块完整性校验），普通用户**无需安装 Node.js / `@electron/asar`**；当本机存在 `node` 时自动触发 `node --check` 语法复检，并始终校验 `unpacked` 文件数量一致。
  - 本仓库**不包含**任何 Antigravity 官方二进制、安装包、修改后的 `app.asar` 及任何个人数据。

## 双层完整汉化说明

Antigravity 基于 VS Code + 独立 Electron 界面架构，要实现全界面无死角中文，推荐配合使用以下两层：

1. **基础层（VS Code 框架与编辑器菜单）**：在 Antigravity 扩展商店搜索并安装微软官方插件 **`Chinese (Simplified) (简体中文) Language Pack for Visual Studio Code`**，按提示切换显示语言并重启。
2. **内核层（Antigravity 专属交互与原生主进程）**：使用本项目一键注入 `resources/app.asar` 汉化补丁，解决官方语言包无法覆盖的智能体对话流、模型配额卡、原生右键菜单、托盘菜单、设置面板及登录/密钥弹窗。

## 环境要求

- **免环境单文件版用户**：无需安装 Python 或 Node.js，直接运行独立可执行文件即可。
- **源码运行用户**：**Python 3.8+**；可选 **Node.js 18+**（仅用于执行 `node --check` 语法复检与运行 `npm test` 端到端测试）。
- **目标软件**：已安装官方 Antigravity（当前词典与锚点基于 **Antigravity v2.31.0** 验证，向下/向新版本可借助内置兼容逻辑或 `build` 命令测试适配）

## 快速开始

### 方式一：免环境单文件工具（推荐普通用户）

1. 从本项目的 [GitHub Releases](../../releases) 下载对应系统的单文件程序（Windows 下载 `Antigravity-zh-cn-win-x64.exe`），或在本机运行 `python scripts/build_standalone.py` 自行打包。
2. 双击运行单文件程序，在交互菜单中输入 **`1`** 并按回车，即可自动关闭 Antigravity、备份原版 `app.asar` 并完成注入。

### 方式二：Windows 源码一键交互脚本

1. 下载或克隆本仓库到本地目录。
2. 双击运行 [`scripts/Antigravity一键汉化工具.bat`](scripts/Antigravity一键汉化工具.bat)。
3. 在交互菜单中选择 **`[1]` 注入深度汉化**。

### 方式三：跨平台命令行 CLI（Windows / macOS / Linux）

```bash
# 查看当前安装检测与汉化状态
python src/localize.py status

# 一键备份原版并注入深度汉化（默认禁用官方后台静默覆盖）
python src/localize.py install

# 若希望保留官方后台自动下载/更新，可附加 --keep-auto-update
python src/localize.py install --keep-auto-update

# 恢复官方原版 app.asar（从 app.asar.original.bak 还原）
python src/localize.py restore

# 指定自定义安装目录或 app.asar 路径
python src/localize.py install --app-dir "/path/to/Antigravity"
python src/localize.py install --asar "/path/to/resources/app.asar"
```

macOS / Linux 也可使用包装脚本 [`scripts/localize.sh`](scripts/localize.sh)：

```bash
chmod +x scripts/localize.sh
./scripts/localize.sh status
./scripts/localize.sh install
./scripts/localize.sh restore
```

### 离线构建模式（开发者 / 版本适配调试）

如需对指定 `app.asar` 做离线测试打包而不改动当前本机安装：

```bash
python src/localize.py build \
  --input-asar "/path/to/vanilla/app.asar" \
  --output-asar "/path/to/output/app.asar"
```

> 提示：若源 `app.asar` 包含 `unpacked` 扩展目录（如 `node_modules/chrome-devtools-mcp`），请确保其同级目录下存在 `.unpacked` 文件夹（如 `app.asar.unpacked`）。

## 自动化自检测试

仓库内置基于纯 Node.js DOM 沙箱的端到端测试套件（无需真实浏览器或外部 npm 测试依赖）：

```bash
npm test
# 或
node tests/verify_e2e.js
```

如需同时校验解包后的主进程模块运行时行为，可附加 `--dist-dir` 参数：

```bash
node tests/verify_e2e.js --dist-dir "/path/to/extracted/dist"
```

## 目录结构

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/                   # 漏翻反馈与新版适配 Issue 模板
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/                        # GitHub Actions CI 测试与多平台 Release 打包
├── dict/master_merged_dict.json          # 主界面翻译词典（纯静态通用 UI 词条）
├── scripts/
│   ├── Antigravity一键汉化工具.bat        # Windows 一键交互式汉化与还原脚本
│   ├── build_standalone.py               # PyInstaller 单文件零依赖构建脚本
│   └── localize.sh                       # macOS / Linux Shell 入口脚本
├── src/
│   ├── asar_codec.py                     # 纯 Python ASAR 编解码引擎（零 Node 依赖）
│   ├── engine_preload.js                 # 前端动态 DOM / 正则 / Shadow DOM 引擎
│   ├── patches_main.py                   # 主进程模块自动化补丁器
│   └── localize.py                       # 跨平台安装检测、交互菜单、构建与还原 CLI
├── tests/
│   ├── test_asar_codec.py                # ASAR 编解码单元测试
│   └── verify_e2e.js                     # DOM 引擎 + 主进程模块 E2E 自检脚本
├── CONTRIBUTING.md                       # 贡献与词典提交流程说明
├── LICENSE                               # MIT 开源许可证
├── package.json
├── README.md                             # 中文说明文档
└── README_EN.md                          # English Documentation
```

## 注意事项与免责声明

1. **版本升级**：每当 Antigravity 发布大版本更新，如果你希望同步汉化新版 UI，建议先备份当前设置，等待本仓库更新对应版本适配词典，再重新执行 `install`。
2. **校验与权限**：若安装路径位于系统受保护目录（例如 `C:\Program Files\` 或 `/opt/`），请以管理员权限或 `sudo` 运行注入/还原命令。
3. **免责声明**：本项目仅提供本地 UI 资源汉化与学习交流用途，与 Google / Antigravity 官方无任何从属或合作关系。请通过官方渠道获取正版 Antigravity 客户端，本仓库绝不分发任何官方专有程序或安装包。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。欢迎通过 Issue 与 Pull Request 补充漏翻界面截图或优化词条。
