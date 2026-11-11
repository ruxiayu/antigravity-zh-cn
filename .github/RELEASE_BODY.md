## 中文汉化更新入口在哪？新手如何升级？（图文说明）

很多同学更新官方 Antigravity 后不知道在哪里看汉化版本或重新升级汉化，本次发布已在 **Antigravity 设置面板** 内直接加入清晰入口：

![Antigravity 中文汉化更新界面位置与新手升级指南](https://raw.githubusercontent.com/ruxiayu/antigravity-zh-cn/main/docs/images/update-ui-guide.png)

### 一眼找到汉化更新界面（见上图标注 ① ② ③ ④）

1. **① 左侧边栏底部胶囊**：打开 Antigravity **设置**（左下角齿轮图标或按 `Ctrl + ,`），在左下角 **`提交反馈` 正上方** 即可看到汉化状态胶囊；点击它会自动定位到设置卡片（在外观/模型等其他设置页点击也会自动跳回 `通用`）。
2. **② 「通用」页底部「中文汉化与更新」卡片**：展示当前补丁版本、客户端版本及 GitHub 最新版本；当有新版汉化或官方客户端刚升级时，胶囊和卡片会变蓝提醒。
3. **③ 小白升级汉化只需 3 步**：
   - 第 1 步：点击卡片里的 **「前往 GitHub 下载」**（Windows 普通用户下载下方的 **`Antigravity-zh-cn-win-x64.exe`** 免安装单文件版即可）；
   - 第 2 步：**务必先完全关闭 Antigravity 客户端**（Windows 下运行期间会锁定 `app.asar` 文件）；
   - 第 3 步：双击下载好的新版 `Antigravity-zh-cn-win-x64.exe`，输入 **`1`** 回车，等待几秒自动重开软件即完成升级！
4. **④ 每日自动检查开关（可随时关闭）**：默认每 24 小时仅发 1 次只读请求检查 GitHub Releases 版本号（不上传任何本机数据），可在卡片内一键关闭；也可直接运行工具选 **`[5]` 检查 GitHub 最新汉化包更新**。

---

### 本次下载文件说明

| 平台 | 下载文件 | 使用方法 |
| :--- | :--- | :--- |
| **Windows 10/11 (x64)** | `Antigravity-zh-cn-win-x64.exe` | 免安装、无需 Python/Node，关闭 Antigravity 后双击运行选 `1` |
| **Linux (x64)** | `antigravity-zh-cn-linux-x64` | `chmod +x antigravity-zh-cn-linux-x64 && ./antigravity-zh-cn-linux-x64 install` |
| **macOS (Apple Silicon)** | `antigravity-zh-cn-macos-arm64` | `chmod +x antigravity-zh-cn-macos-arm64 && ./antigravity-zh-cn-macos-arm64 install` |
| **校验文件** | `SHA256SUMS.txt` | 用于校验二进制文件完整性 |
