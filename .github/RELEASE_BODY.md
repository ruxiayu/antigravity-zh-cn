### 本次更新内容（v2.34.0）

- **全面适配 Antigravity v2.34.0 新模型与编排器（Orchestrator）体系**：
  - 完整汉化模型选择器中的 **Orchestrator（编排器）** 标签、模型+档位组合显示（如 `编排器 Gemini 4 Neon 超高` / `中` / `高` / `低`）以及新版分流提示 Tooltip（`Offloads routine steps to a faster executor. Same quality, fewer tokens used.` $\rightarrow$ `将常规步骤分流至更快的执行器。保持同等质量，消耗更少 Token。`）。
  - 汉化新增的 **思考力度（Thinking effort）** 子菜单标题及其说明提示。
  - 完整汉化设置页 **编排器设置（Orchestrator Settings）** 板块（含「编排器模型」与「执行器模型」标题与说明）。
- **补全高频交互细节汉化**：
  - 汉化对话中链接点击菜单的 `Open In`（打开方式）、`Built-in Browser (Default)`（内置浏览器（默认））、`External Browser (Default)`（外部浏览器（默认））等子菜单项。
  - 汉化 `/compact` 斜杠命令说明（`立即压缩当前对话（总结历史记录以释放上下文窗口）。`）。
- **适配 v2.34.0 新增客户端内核模块**：
  - 适配新版桌面控制浮窗（`computer/hud.js`、`computer/hudState.js`）的「再次允许（Allow again）」按钮、状态机文案及多智能体控制提示。
  - 汉化浏览器流采集窗口（`browserStream/capturePage.js`）标题，并完整保留 SSH 远程管理、右键上下文菜单、应用内热更新等全量汉化能力。
- **质量校验**：全量词典扩充至 **6775 条**，E2E 自动化测试（191 项 DOM 断言 + MutationObserver）与 19 个主进程模块语法检查全部通过。

---

## 中文汉化更新入口在哪？新手如何升级？（图文说明）

很多同学更新官方 Antigravity 后不知道在哪里看汉化版本或重新升级汉化，本工具已在 **Antigravity 设置面板** 内直接加入清晰入口：

![Antigravity 中文汉化更新界面位置与新手升级指南](https://raw.githubusercontent.com/ruxiayu/antigravity-zh-cn/main/docs/images/update-ui-guide.png)

### 一眼找到汉化更新界面（见上图标注 ① ② ③ ④）

1. **① 左侧边栏底部胶囊**：打开 Antigravity **设置**（左下角齿轮图标或按 `Ctrl + ,`），在左下角 **`提交反馈` 正上方** 即可看到汉化状态胶囊；点击它会自动定位到「`通用`」页底部的汉化卡片（仅在汉化注入后显示；若刚通过官方渠道升级覆盖了原版 `app.asar`，重新运行一次本工具选 `1` 即可恢复）。
2. **② 「通用」页底部「中文汉化与更新」卡片**：展示当前补丁版本、客户端版本及 GitHub 最新版本；支持**应用内一键检查、直接下载最新版补丁并重启更新**。
3. **③ 手动覆盖 / 重注只需 3 步**：
   - 第 1 步：点击卡片内的 **「应用内下载更新」** 或前往 GitHub Release 下载最新 **`Antigravity-zh-cn-win-x64.exe`** 免安装单文件版；
   - 第 2 步：**务必先完全关闭 Antigravity 客户端**（Windows 下运行期间会锁定 `app.asar` 文件；应用内一键重启会自动处理）；
   - 第 3 步：双击 `Antigravity-zh-cn-win-x64.exe`，输入 **`1`** 回车（默认保留官方更新），等待几秒自动重开软件即完成汉化/重注！
4. **④ 每日自动检查开关（可随时关闭）**：默认每 24 小时仅发 1 次只读请求检查 GitHub Releases 版本号（不上传任何本机数据），可在卡片内一键关闭；也可直接运行工具选 **`[5]` 检查 GitHub 最新汉化包更新**。

---

### 本次下载文件说明

| 平台 | 下载文件 | 使用方法 |
| :--- | :--- | :--- |
| **Windows 10/11 (x64)** | `Antigravity-zh-cn-win-x64.exe` | 免安装、无需 Python/Node，关闭 Antigravity 后双击运行选 `1` |
| **Linux (x64)** | `antigravity-zh-cn-linux-x64` | `chmod +x antigravity-zh-cn-linux-x64 && ./antigravity-zh-cn-linux-x64 install` |
| **macOS (Apple Silicon)** | `antigravity-zh-cn-macos-arm64` | `chmod +x antigravity-zh-cn-macos-arm64 && ./antigravity-zh-cn-macos-arm64 install` |
| **校验文件** | `SHA256SUMS.txt` | 用于校验二进制文件完整性 |
