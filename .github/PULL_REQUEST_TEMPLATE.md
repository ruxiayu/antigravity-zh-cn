## 变更说明

<!-- 请简述本次 PR 新增/修正了哪些词条、正则或主进程模块 -->

## 自检清单

- [ ] 已确认 `dict/master_merged_dict.json` 及代码注释中**不包含**任何个人用户名、本地绝对路径、项目名或私人会话标题
- [ ] 已使用 UTF-8（无 BOM）编码保存变更文件
- [ ] 已通过本地验证命令：
  - `python -m py_compile src/patches_main.py src/localize.py`
  - `node --check src/engine_preload.js && node --check tests/verify_e2e.js`
  - `npm test`
