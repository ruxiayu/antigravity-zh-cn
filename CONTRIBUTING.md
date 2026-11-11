# 贡献指南 (Contributing)

感谢您关注并帮助完善 **Antigravity 深度中文汉化项目**！

## 目录结构说明

- `dict/master_merged_dict.json`：主 UI 词典（扁平键值对 `"English": "中文"`，按需维护与扩充）。
- `src/engine_preload.js`：前端动态 DOM 汉化引擎源码模板（支持跨节点数字感知、配额倒计时正则、Shadow DOM 监听、Tooltip / Dialog 穿透等）。
- `src/patches_main.py`：Electron 主进程模块化补丁逻辑（菜单、托盘、右键上下文、WebAuthn、更新器等）。
- `src/localize.py`：跨平台一键注入 / 备份还原 / 状态检查 / 离线构建 CLI 工具。
- `tests/verify_e2e.js`：无浏览器依赖的 DOM 模拟与主进程模块自动化自检测试。

## 词条贡献规范

1. **避免包含隐私或项目特定内容**
   - 切勿向 `dict/master_merged_dict.json` 提交个人会话标题、项目名称、用户名、文件路径或账户邮箱等词条。
2. **保持 JSON 合法性与编码格式**
   - 请使用 **UTF-8（无 BOM）** 编码保存 `dict/master_merged_dict.json`。
   - 避免修改非目标功能或引入空翻译。
3. **动态占位符与特殊语境**
   - 若词条包含动态数字、模型名称或跨 DOM 节点文本（例如 `77% left`、`Resets in 2d 17h`、`Models within this group: ...`），建议在 `src/engine_preload.js` 的规则函数中添加正则匹配，并在 `tests/verify_e2e.js` 中补充对应断言用例。

## 本地验证流程

在提交 Pull Request 前，请确保在项目根目录执行以下检查且全部通过：

```bash
# 1. Python 语法编译检查
python -m py_compile src/patches_main.py src/localize.py

# 2. JavaScript 语法检查
node --check src/engine_preload.js
node --check tests/verify_e2e.js

# 3. 运行端到端自动化测试
npm test
# 或直接运行
node tests/verify_e2e.js
```

若您本机同时拥有解包后的 `dist/` 目录，也可以追加主进程模块校验：

```bash
node tests/verify_e2e.js --dist-dir "/path/to/extracted/dist"
```

## 分支与提交建议

- 新词条或版本适配建议按功能模块拆分提交（例如 `dict: add settings voice mode translations` 或 `engine: handle nested model group tooltip`）。
- 适配新的 Antigravity 上游版本时，建议先使用 `python src/localize.py build --input-asar <官方app.asar> --output-asar <测试output.asar>` 验证 `patches_main.py` 中的全部正则与字符串锚点是否仍完整命中。
