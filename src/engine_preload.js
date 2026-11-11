// Antigravity Chinese Localization Engine (Dynamic DOM & Context Engine)

(function() {

  'use strict';



  const exactMap = new Map();

  const lowerMap = new Map();



  const MERGED_DICT = {};

  for (const [k, v] of Object.entries(MERGED_DICT)) {
    if (!k) continue;
    const trimmed = String(k).trim();
    exactMap.set(trimmed, v);
    if (trimmed.includes(' ') || trimmed.length >= 12) {
      lowerMap.set(trimmed.toLowerCase(), v);
    }
  }

  const BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'KBD', 'SAMP', 'INPUT', 'TEXTAREA', 'SVG', 'CANVAS']);
  const BLOCKED_CLASSES = [
    'monaco-editor', 'editor-container', 'editor-instance',
    'cm-editor', 'cm-content', 'katex', 'katex-html', 'font-mono',
    'terminal', 'xterm', 'xterm-screen', 'xterm-rows', 'xterm-cursor-layer',
    'thought-content', 'thinking-content', 'cursor-edit'
  ];

  function replaceTrimmed(str, trimmed, repl) {
    const idx = str.indexOf(trimmed);
    if (idx === -1) return repl;
    return str.slice(0, idx) + repl + str.slice(idx + trimmed.length);
  }

  function normalizeLookupKey(s) {
    return s
      .replace(/\u2026/g, '...')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u00a0/g, ' ');
  }

  function formatEnDateStr(ds) {
    if (!ds) return ds;
    const ms = { jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6', jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12' };
    const dmWithYear = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+([0-9]{1,2})(?:st|nd|rd|th)?,?\s+([0-9]{4})/i.exec(ds);
    if (dmWithYear) {
      const mon = dmWithYear[1].slice(0, 3).toLowerCase();
      return dmWithYear[3] + ' 年 ' + (ms[mon] || mon) + ' 月 ' + dmWithYear[2] + ' 日';
    }
    const dmNoYear = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+([0-9]{1,2})(?:st|nd|rd|th)?/i.exec(ds);
    if (dmNoYear) {
      const mon = dmNoYear[1].slice(0, 3).toLowerCase();
      return (ms[mon] || mon) + ' 月 ' + dmNoYear[2] + ' 日';
    }
    return ds;
  }

  function formatEnDurationStr(ds, spaced) {
    if (!ds) return '';
    const cleaned = ds.trim();
    if (/^less\s+than\s+a\s+minute$/i.test(cleaned) || /^<\s*1m$/i.test(cleaned)) return '不到 1 分钟';
    if (/^less\s+than\s+an\s+hour$/i.test(cleaned)) return '不到 1 小时';
    const dMatch = /([0-9]+)\s*(?:d\b|days?)/i.exec(cleaned);
    const hMatch = /([0-9]+)\s*(?:h\b|hours?|hrs?)/i.exec(cleaned);
    const mMatch = /([0-9]+)\s*(?:m\b|minutes?|mins?)/i.exec(cleaned);
    const sMatch = /([0-9]+)\s*(?:s\b|seconds?|secs?)/i.exec(cleaned);
    const parts = [];
    if (dMatch) parts.push(dMatch[1] + (spaced ? ' 天' : '天'));
    if (hMatch) parts.push(hMatch[1] + (spaced ? ' 小时' : '小时'));
    if (mMatch) parts.push(mMatch[1] + (spaced ? ' 分钟' : '分钟'));
    if (sMatch) parts.push(sMatch[1] + (spaced ? ' 秒' : '秒'));
    return parts.join(spaced ? ' ' : '');
  }

  const EFFORT_MAP = { low: '低', medium: '中', high: '高', xhigh: '超高', extra: '超高', max: '极高' };

  function isBlockedNode(el) {
    if (!el || !el.closest) return false;

    // 1. 先强力隔离终端、代码块、等宽命令/路径 (.font-mono) 及可编辑区域（即使位于 dialog/Settings 内）
    if (el.closest('pre, code, kbd, samp, .font-mono, .terminal, .xterm, .xterm-screen')) return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;

    for (let i = 0; i < BLOCKED_CLASSES.length; i++) {
      if (el.closest('.' + BLOCKED_CLASSES[i])) return true;
    }

    // 2. 用户自身输入与用户自定义代码块保护
    const userMsg = el.closest('[data-role="user"], [data-author="user"]');
    if (userMsg) return true;

    // 3. 系统菜单、弹窗、下拉项、提示气泡、单选/开关、按钮、操作条放行汉化
    if (el.closest('[role="dialog"], [role="alertdialog"], dialog, .modal, .dialog, [role="tooltip"], .tooltip, [data-tooltip], [role="status"], [role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="switch"], [role="menu"], [role="menubar"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-radix-menu-content], [data-radix-popper-content-wrapper], [data-floating-ui-portal], [data-menu], .menu, .context-menu, .dropdown-menu, popover, [popover], button, [role="button"], [aria-haspopup], [data-action]')) {
      return false;
    }

    return false;
  }

  function translateText(str) {
    if (!str) return str;
    const trimmed = str.trim();
    if (!trimmed || !/[a-zA-Z]/.test(trimmed)) return str;

    // 1. 完全匹配 (含Unicode标点归一回退)
    if (exactMap.has(trimmed)) {
      return replaceTrimmed(str, trimmed, exactMap.get(trimmed));
    }
    const normTrimmed = normalizeLookupKey(trimmed);
    if (normTrimmed !== trimmed && exactMap.has(normTrimmed)) {
      return replaceTrimmed(str, trimmed, exactMap.get(normTrimmed));
    }

    // 2. 小写完全匹配 (仅限短语/长词，避免误伤正文单个小写词)
    const lower = trimmed.toLowerCase();
    if (lowerMap.has(lower)) {
      return replaceTrimmed(str, trimmed, lowerMap.get(lower));
    }
    const normLower = normTrimmed.toLowerCase();
    if (normLower !== lower && lowerMap.has(normLower)) {
      return replaceTrimmed(str, trimmed, lowerMap.get(normLower));
    }
    const collapsed = normTrimmed.replace(/\s+/g, ' ');
    if (collapsed !== normTrimmed) {
      if (exactMap.has(collapsed)) return replaceTrimmed(str, trimmed, exactMap.get(collapsed));
      const cLower = collapsed.toLowerCase();
      if (lowerMap.has(cLower)) return replaceTrimmed(str, trimmed, lowerMap.get(cLower));
    }

    // 3. 动态前缀加括号数字匹配：例如 "See all (16)", "Items (5+)"
    const countMatch = /^([\s\S]*?)\s*\(([0-9]+(?:\+)?)\)$/.exec(trimmed);
    if (countMatch) {
      const prefix = countMatch[1].trim();
      const normPref = normalizeLookupKey(prefix);
      const count = countMatch[2];
      const transPref = exactMap.get(prefix) || exactMap.get(normPref) || lowerMap.get(prefix.toLowerCase()) || lowerMap.get(normPref.toLowerCase());
      if (transPref) {
        return replaceTrimmed(str, trimmed, transPref + ' (' + count + ')');
      }
    }

    // 4. 快捷键文本支持：例如 "Save (Ctrl+S)"
    const shortcutMatch = /^(.+?)\s*\((Ctrl|Cmd|Alt|Shift|⌘|⌥|⇧|⌃)\+?([^)]*)\)$/i.exec(trimmed);
    if (shortcutMatch) {
      const p = shortcutMatch[1].trim();
      const tp = exactMap.get(p) || lowerMap.get(p.toLowerCase());
      if (tp) {
        return replaceTrimmed(str, trimmed, tp + ' (' + shortcutMatch[2] + (shortcutMatch[3] ? '+' + shortcutMatch[3] : '') + ')');
      }
    }

    // 4.1 首页动态问候语匹配 (Hey <name> / Welcome back / Good to see you)
    let m;
    if ((m = /^Hey\s+(.+?),\s+what should we build today\??$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '你好 ' + m[1] + '，今天想构建什么？');
    }
    if ((m = /^Welcome back,\s+(.+?)\.\s*Where should we pick up\??$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '欢迎回来，' + m[1] + '。我们从哪里继续？');
    }
    if ((m = /^Good to see you,\s+(.+?)\.\s*What's next\??$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '很高兴见到你，' + m[1] + '。接下来做什么？');
    }
    if ((m = /^Hello,\s+(.+?)!$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '你好，' + m[1] + '！');
    }
    if ((m = /^Welcome to\s+(.+?)!$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '欢迎使用 ' + m[1] + '！');
    }

    // 4.2 额度、AI Credits 与限额刷新动态匹配
    if ((m = /^When toggled on,\s*(.+?)\s+will use your AI credits to fulfill model requests once you're out of model quota\.\s*.+?\s+will always use your model quota first before using AI credits\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '开启后，当模型配额耗尽时，' + m[1] + ' 将自动使用您的 AI 额度来继续处理模型请求。' + m[1] + ' 始终会优先消耗模型配额，然后再使用 AI 额度。');
    }
    if ((m = /^You have used (some of |all of )?your\s+(.+?)\s+limit,\s*it will\s+(?:fully\s+)?refresh in\s+(.+?)\.?$/i.exec(normTrimmed))) {
      const partCn = m[1] && /all/i.test(m[1]) ? '全部' : '部分';
      const pRaw = m[2].trim().toLowerCase();
      let periodCn = pRaw;
      if (pRaw === 'weekly') periodCn = '每周';
      else if (pRaw === 'daily') periodCn = '每日';
      else if (pRaw === 'monthly') periodCn = '每月';
      else if (pRaw === 'hourly') periodCn = '每小时';
      else if (/^([0-9]+)[-\s]?hours?$/.test(pRaw)) periodCn = pRaw.replace(/^([0-9]+)[-\s]?hours?$/, '$1 小时');
      const durCn = formatEnDurationStr(m[3], true) || m[3];
      return replaceTrimmed(str, trimmed, '您已使用' + partCn + periodCn + '限额，将于 ' + durCn + '后完全重置。');
    }
    if ((m = /^(.+?)\s+(Weekly|Daily|Hourly|Monthly|[0-9]+[-\s]?Hours?)\s+Limits?$/i.exec(normTrimmed))) {
      const uRaw = m[2].toLowerCase();
      let uCn = m[2];
      if (uRaw === 'weekly') uCn = '每周限额';
      else if (uRaw === 'daily') uCn = '每日限额';
      else if (uRaw === 'hourly') uCn = '每小时限额';
      else if (uRaw === 'monthly') uCn = '每月限额';
      else uCn = uRaw.replace(/^([0-9]+)[-\s]?hours?$/, '$1 小时限额');
      return replaceTrimmed(str, trimmed, m[1] + ' ' + uCn);
    }
    if ((m = /^Available AI Credits:\s*(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '可用 AI 额度：' + m[1]);
    }
    if ((m = /^Your Plan:\s*(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '当前方案：' + m[1]);
    }
    if ((m = /^Your plan's baseline quota will refresh on\s+(.+?)\.\s*To continue using this model now,\s*enable AI Credit overages\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '您方案的基础配额将于 ' + formatEnDateStr(m[1]) + ' 重置。如需立即继续使用此模型，请启用 AI 额度超额用量。');
    }
    if ((m = /^Your plan's baseline quota will refresh on\s+([^.]+?)\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '您方案的基础配额将于 ' + formatEnDateStr(m[1]) + ' 重置。');
    }
    if ((m = /^Your quota for\s+(.+?)\s+has been reached\.\s*Switch to another available model to continue\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '您对 ' + m[1] + ' 的配额已用完。请切换至其他可用模型以继续。');
    }

    // 4.5 模型额度与重置倒计时动态匹配 (Model Quota & Reset Timers)
    const limitMatch = /^([0-9]+)\s*(h|d|m)\s+limits?$/i.exec(trimmed);
    if (limitMatch) {
      const unit = limitMatch[2].toLowerCase();
      const unitCn = unit === 'h' ? '小时' : (unit === 'd' ? '天' : '分钟');
      return replaceTrimmed(str, trimmed, limitMatch[1] + unitCn + '限额');
    }
    if (/([0-9]+(?:\.[0-9]+)?%)\s*(?:left|remaining)\b/i.test(trimmed)) {
      return str.replace(/([0-9]+(?:\.[0-9]+)?%)\s*(?:left|remaining)\b/gi, function(_, p1) { return p1 + ' 剩余'; });
    }
    if (/%+\s*(?:left|remaining)\b/i.test(trimmed)) {
      return str.replace(/%+\s*(?:left|remaining)\b/gi, '% 剩余');
    }
    if (/^([0-9]+(?:\.[0-9]+)?%)\s+used$/i.test(trimmed)) {
      return str.replace(/^([0-9]+(?:\.[0-9]+)?%)\s+used$/i, function(_, p1) { return p1 + ' 已使用'; });
    }
    if (/^(?:Resets?|Refreshes?)\s+in\s+less\s+than\s+a\s+minute$/i.test(trimmed) || /^(?:Resets?|Refreshes?)\s+in\s*<\s*1m$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '不到 1 分钟后重置');
    }
    if (/^(?:Resets?|Refreshes?)\s+in\s+less\s+than\s+an\s+hour$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '不到 1 小时后重置');
    }
    if (/^(?:Resets?|Refreshes?)\s+soon$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '即将重置');
    }
    const resetTimerMatch = /^(?:Resets?|Refreshes?)\s+in\s+(.+)$/i.exec(trimmed);
    if (resetTimerMatch) {
      const timeCn = formatEnDurationStr(resetTimerMatch[1], false);
      if (timeCn) {
        return replaceTrimmed(str, trimmed, timeCn + '后重置');
      }
    }

    // 4.6 危险操作与删除确认弹窗动态正则流
    if ((m = /^Are you sure you want to delete (?:this )?conversation\?(?:\s*(This action cannot be undone\.?))?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] ? '您确定要删除此对话吗？此操作无法撤销。' : '您确定要删除此对话吗？');
    }
    if ((m = /^Are you sure you want to permanently delete (?:this )?conversation\?(?:\s*(This action cannot be undone\.?))?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] ? '您确定要彻底删除此对话吗？此操作无法撤销。' : '您确定要彻底删除此对话吗？');
    }
    if ((m = /^Are you sure you want to delete (?:this )?project\?(?:\s*(This action cannot be undone\.?))?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] ? '您确定要删除此项目吗？此操作无法撤销。' : '您确定要删除此项目吗？');
    }
    if ((m = /^Are you sure you want to delete the hook\s+"(.+?)"\??$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '您确定要删除钩子 “' + m[1] + '” 吗？');
    }
    if (/^This action cannot be undone\.?$/i.test(normTrimmed) || /^This cannot be undone\.?$/i.test(normTrimmed)) {
      return replaceTrimmed(str, trimmed, '此操作无法撤销。');
    }

    // 4.7 模型状态标签与通知/移除公告 Tooltip 动态流
    if (/^Notice(?:\s*[ⓘℹ])?$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '提示' + (/[ⓘℹ]/.test(trimmed) ? ' ⓘ' : ''));
    }
    if (/^Unavailable(?:\s*[ⓘℹ])?$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '不可用' + (/[ⓘℹ]/.test(trimmed) ? ' ⓘ' : ''));
    }
    if (/^Available(?:\s*[ⓘℹ])?$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '可用' + (/[ⓘℹ]/.test(trimmed) ? ' ⓘ' : ''));
    }
    if (/^Thinking(?:\s*[ⓘℹ])?$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '深度思考' + (/[ⓘℹ]/.test(trimmed) ? ' ⓘ' : ''));
    }
    if ((m = /^(.+?\s+is\s+now\s+available\s+on\s+paid\s+Pro\s+and\s+Ultra\s+plans\.)\s*(Third-party\s+model\s+access\s+will\s+no\s+longer\s+be\s+available\s+on\s+your\s+current\s+plan\s+starting\s+on\s+.+?\.)?$/i.exec(normTrimmed))) {
      let res = '';
      const p1 = /^(.+?)\s+is\s+now\s+available/i.exec(m[1]);
      if (p1) res += p1[1] + ' 现已向 Pro 与 Ultra 付费方案开放。';
      if (m[2]) {
        const p2 = /starting\s+on\s+(.+?)\.?$/i.exec(m[2]);
        if (p2) res += ' 自 ' + formatEnDateStr(p2[1]) + ' 起，您当前的方案将不再支持访问第三方模型。';
        else res += ' 您当前的方案将不再支持访问第三方模型。';
      }
      return replaceTrimmed(str, trimmed, res.trim());
    }
    if ((m = /^(.+?)\s+is\s+now\s+available\s+on\s+paid\s+Pro\s+and\s+Ultra\s+plans\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 现已向 Pro 与 Ultra 付费方案开放。');
    }
    if ((m = /^(.+?)\s+will\s+be\s+removed\s+from\s+Antigravity\s+on\s+(.+?)\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 将于 ' + formatEnDateStr(m[2]) + ' 从 Antigravity 中移除。');
    }
    if ((m = /^(.+?)\s+will\s+be\s+deprecated(?:\s+from\s+Antigravity)?\s+on\s+(.+?)\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 将于 ' + formatEnDateStr(m[2]) + ' 停止支持。');
    }
    if ((m = /^(.+?)\s+is\s+(currently|now)\s+available\s+to\s+(.+?)\s+plan\s+subscribers\.?$/i.exec(normTrimmed))) {
      const adv = m[2].toLowerCase() === 'currently' ? '目前仅向 ' : '现已向 ';
      return replaceTrimmed(str, trimmed, m[1] + ' ' + adv + m[3] + ' 方案订阅用户开放。');
    }
    if ((m = /^(.+?)\s+is\s+no\s+longer\s+available\.\s*Runs\s+will\s+fail\s+until\s+you\s+pick\s+another\s+model\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 已不可用。在选择其他模型前，运行将会失败。');
    }
    if ((m = /^Third-party\s+model\s+access\s+will\s+no\s+longer\s+be\s+available\s+on\s+your\s+current\s+plan(?:\s+starting\s+on\s+(.+?))?\.?$/i.exec(normTrimmed))) {
      if (m[1]) return replaceTrimmed(str, trimmed, '自 ' + formatEnDateStr(m[1]) + ' 起，您当前的方案将不再支持访问第三方模型。');
      return replaceTrimmed(str, trimmed, '您当前的方案将不再支持访问第三方模型。');
    }
    if ((m = /^Models within this group:\s*(.+)$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '此分组包含的模型：' + m[1].replace(/,\s*/g, '、'));
    }
    if ((m = /^For paid\s+(.+?)\s+plans,\s*(.+?)\s+quota is separate\.\s*Higher\s+.+?\s+quota\s*\(included as part of the larger\s+(.+?)\s+quota bucket\)\s+is available on\s+(.+?)\s+plans\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '对于付费 ' + m[1] + ' 方案，' + m[2] + ' 配额独立计算。' + m[4] + ' 方案提供更高的 ' + m[2] + ' 配额（包含在更大的 ' + m[3] + ' 配额池中）。');
    }

    // 4.8 其他高频动态模板 (Model Selector aria / Thinking / Voice / Shortcuts / Running / Steps / Browser)
    if ((m = /^Select model,\s*current:\s*(.+)$/i.exec(normTrimmed))) {
      const cur = m[1].replace(/\b(Low|Medium|High|Extra|Max)\b/gi, function(w) { return EFFORT_MAP[w.toLowerCase()] || w; });
      return replaceTrimmed(str, trimmed, '选择模型，当前：' + cur);
    }
    if ((m = /^Choose\s+(.+?)'s\s+Voice$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '选择 ' + m[1] + ' 的语音');
    }
    if ((m = /^System default\s*\((.+)\)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '系统默认 (' + m[1] + ')');
    }
    if ((m = /^Show\s+([0-9]+)\s+breakdowns?$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '显示 ' + m[1] + ' 项明细');
    }
    if (/^Hide\s+breakdowns?$/i.test(trimmed)) {
      return replaceTrimmed(str, trimmed, '隐藏明细');
    }
    if ((m = /^([0-9]+)\s+tools?\s+enabled$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 个工具已启用');
    }
    if ((m = /^([0-9]+)\s+tools?\s+disabled$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 个工具已禁用');
    }
    if ((m = /^Recording shortcut for\s+(.+?)\.\s*Press keys to bind,\s*Enter to save,\s*Escape to cancel\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '正在录制“' + m[1] + '”的快捷键。请按下组合键，按 Enter 保存，按 Escape 取消。');
    }
    if ((m = /^Add shortcut for\s+(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '为“' + m[1] + '”添加快捷键');
    }
    if ((m = /^Reset\s+(.+?)\s+to default$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '将“' + m[1] + '”恢复默认');
    }
    if ((m = /^Stop\s+([0-9]+)\s+selected$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '停止所选的 ' + m[1] + ' 项');
    }
    if ((m = /^Thought for\s+([0-9]+)s$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '已思考 ' + m[1] + ' 秒');
    }
    if ((m = /^Thinking for\s+([0-9]+)s$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '正在思考 ' + m[1] + ' 秒');
    }
    if ((m = /^Thinking\s*\(([0-9]+)s\)\.{0,3}\u2026?$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '正在思考 (' + m[1] + '秒)…');
    }
    if ((m = /^Still thinking,\s*([0-9]+)\s+seconds$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '仍在思考，已耗时 ' + m[1] + ' 秒');
    }
    if ((m = /^Worked for\s+(.+)$/i.exec(trimmed))) {
      const dur = formatEnDurationStr(m[1], true) || m[1];
      return replaceTrimmed(str, trimmed, '已运行 ' + dur);
    }
    if ((m = /^Show\s+([0-9]+)\s+earlier\s+steps?$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '显示更早的 ' + m[1] + ' 个步骤');
    }
    if ((m = /^Turn\s+([0-9]+)\s+of\s+([0-9]+)$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '第 ' + m[1] + ' / ' + m[2] + ' 轮');
    }
    if ((m = /^Go to turn\s+([0-9]+)\s+of\s+([0-9]+)$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '跳转至第 ' + m[1] + ' / ' + m[2] + ' 轮');
    }
    if ((m = /^Turns\s+([0-9]+)[\u2013-]([0-9]+)$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '第 ' + m[1] + '–' + m[2] + ' 轮');
    }
    if ((m = /^Turn\s+([0-9]+)$/i.exec(trimmed))) {
      return replaceTrimmed(str, trimmed, '第 ' + m[1] + ' 轮');
    }
    if ((m = /^Load older messages,\s*showing\s+([0-9]+)\s+of\s+([0-9]+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '加载更早消息（当前显示 ' + m[1] + ' / ' + m[2] + '）');
    }
    if ((m = /^No more older messages,\s*showing\s+([0-9]+)\s+of\s+([0-9]+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '没有更早消息了（共显示 ' + m[1] + ' / ' + m[2] + '）');
    }
    if ((m = /^Credentials expire in\s+(.+?)\.\s*Refresh credentials to keep this automation running$/i.exec(normTrimmed))) {
      const dur = formatEnDurationStr(m[1], true) || m[1];
      return replaceTrimmed(str, trimmed, '凭据将在 ' + dur + '后过期，请刷新凭据以保持此自动化任务运行');
    }
    if ((m = /^When toggled on,\s*(.+?)\s+collects usage data to help Google enhance performance and features\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '开启后，' + m[1] + ' 将收集使用数据，帮助 Google 改进产品性能与功能体验。');
    }
    if ((m = /^Receive product updates,\s*tips,\s*and promotions from Google\s+(.+?)\s+via email\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '通过电子邮件接收来自 Google ' + m[1] + ' 的产品更新、使用技巧和推广活动通知。');
    }
    if ((m = /^Low contrast ratio\s*\(([^)]+)\)\.\s*Text may be hard to read\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '对比度偏低（' + m[1] + '），文字可能不易辨认。');
    }

    // 4.8 设置、插件/MCP、工作区、语音与错误提示动态流
    if ((m = /^Manage\s+(.+?)\s+app settings\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '管理 ' + m[1] + ' 应用设置。');
    }
    if ((m = /^Inherits your Global Permissions when working\s+(.+?)\.?$/i.exec(collapsed))) {
      const wRaw = m[1].trim().toLowerCase();
      const wCn = wRaw === 'locally' ? '本地' : (wRaw === 'remotely' ? '远程' : m[1]);
      return replaceTrimmed(str, trimmed, '在' + wCn + '工作时继承您的全局权限。');
    }
    if ((m = /^Open\s+(.+?)\s+skill$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '打开 ' + m[1] + ' 技能');
    }
    if ((m = /^Open the\s+(.+?)\s+plugin$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '打开 ' + m[1] + ' 插件');
    }
    if ((m = /^Build with\s+(.+?)\s+Plugins$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '使用 ' + m[1] + ' 插件构建');
    }
    if ((m = /^Work in\s+(.+?)\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '在 ' + m[1] + ' 中工作');
    }
    if ((m = /^This deletes\s+(\d+)\s+call recordings?\s*\(([^)]+)\)\s*from your machine\.\s*You can't undo this\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '这将从您的设备中永久删除 ' + m[1] + ' 条通话录音（' + m[2] + '）。此操作无法撤销。');
    }
    if ((m = /^Deleted\s+(\d+)\s+call recordings?\s*\(([^)]+)\)\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '已删除 ' + m[1] + ' 条通话录音（' + m[2] + '）');
    }
    if ((m = /^Failed to delete recordings:\s*(.+)$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '删除录音记录失败：' + m[1]);
    }
    if ((m = /^(.+?),\s*voice\s+(\d+)\s+of\s+(\d+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + '，第 ' + m[2] + ' / ' + m[3] + ' 种语音');
    }
    if ((m = /^(Enable|Disable)\s+(.+?)\s+tool for\s+(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, (m[1].toLowerCase() === 'enable' ? '启用 ' : '停用 ') + m[3] + ' 的 ' + m[2] + ' 工具');
    }
    if ((m = /^MCP server\s+(.+?)\s+does not have any installation commands\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, 'MCP 服务器 ' + m[1] + ' 未配置安装命令。');
    }
    if ((m = /^MCP server\s+(.+?)\s+not found in config\.?$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '配置中未找到 MCP 服务器 ' + m[1]);
    }
    if ((m = /^Error deleting MCP server:\s*(.+)$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '删除 MCP 服务器时出错：' + m[1]);
    }
    if ((m = /^Error toggling tool:\s*(.+)$/i.exec(collapsed))) {
      return replaceTrimmed(str, trimmed, '切换工具状态时出错：' + m[1]);
    }
    if ((m = /^No plugins found for\s+"([^"]+)"\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '未找到与“' + m[1] + '”匹配的插件。');
    }
    if ((m = /^Search for\s+"([^"]+)"\s+in the Marketplace$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '在应用市场中搜索“' + m[1] + '”');
    }
    if ((m = /^Adding plugins from\s+(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '正在从 ' + m[1] + ' 添加插件...');
    }
    if ((m = /^Add\s+(\d+)\s+plugins?\s+from\s+(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '从 ' + m[2] + ' 添加 ' + m[1] + ' 个插件');
    }
    if ((m = /^Plugins in\s+(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 中的插件');
    }
    if ((m = /^(\d+)\s+models selected$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, m[1] + ' 个已选模型');
    }
    if ((m = /^gates\s+(.+?)\s+\+(\d+)\s+more$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '控制开关：' + m[1] + ' 等共 +' + m[2] + ' 项');
    }
    if ((m = /^gates\s+(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '控制开关：' + m[1]);
    }
    if ((m = /^Microphone blocked\.\s*Allow in\s+(.+?)\.?$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '麦克风权限已被阻止。请在' + m[1] + '中允许访问。');
    }
    if ((m = /^Move to Group:\s*(.+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '移至分组：' + m[1]);
    }
    if ((m = /^Automation\s+(\d+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '自动化任务 ' + m[1]);
    }
    if ((m = /^Unnamed skill\s+(\d+)$/i.exec(normTrimmed))) {
      return replaceTrimmed(str, trimmed, '未命名技能 ' + m[1]);
    }

    // 4.9 内置技能描述前缀兜底（防止长文本截断或换行差异导致漏译）
    if (/^Comprehensive guide and reference for the Antigravity Customization System\./i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, 'Antigravity 自定义扩展系统的完整指南与技术参考。用于阐述自定义项的工作机制、加载优先级、自动发现机制，并指导技能、规则、插件、钩子及 MCP 服务器创建。');
    }
    if (/^Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity/i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '提供 Google Antigravity (AGY) 的全面指南、快速参考与功能索引，涵盖 Antigravity CLI (agy)、Antigravity 2.0、Antigravity IDE、Python SDK、斜杠命令、快捷键及自定义扩展。');
    }
    if (/^Interactive guide to design and create a scheduled background automation\./i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '用于设计与创建后台定时自动化任务的交互式指南。当用户希望创建自动或周期性定时任务时使用，也可通过 /automation 斜杠命令触发。');
    }
    if (/^How to render rich interactive HTML widgets inline in the chat or as standalone artifacts\./i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '如何在对话中以内联方式或作为独立产物渲染丰富的交互式 HTML 组件，用于向用户展示图表、数据可视化、交互控件与教学演示等内容。');
    }
    if (/^Migrates the user's MCP servers, skills, slash commands, subagents, and instruction files from other coding agents/i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '将其他编程智能体（Claude Code、Codex、Cursor、Gemini CLI）中的 MCP 服务器、技能、斜杠命令、子智能体及指令文件迁移至一个新 Antigravity 插件。');
    }
    if (/^Automatically migrate legacy workflows to modern skills across global and workspace configurations\./i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '自动将全局与工作区配置中的旧版工作流迁移为现代技能：扫描现有工作流，生成目标 SKILL.md 文件并安全归档旧版工作流文件。');
    }
    if (/^\(Preview & Quota Heavy\) Run a swarm: several agents working in parallel on one task/i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '（预览功能 · 配额消耗较高）运行智能体集群：多个智能体在各自会话中并行处理同一任务，并通过共享消息板协同工作。适用于可并行拆分的任务，或需要另一双眼睛交叉复核结果的场景。');
    }
    if (/^How to manage and create plugins\b/i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '说明如何管理与创建插件（将技能、智能体、规则、MCP 服务器与钩子按命名空间打包为可统一安装、启用和停用的单一单元）。当需要启用、停用、安装、卸载或新建插件时使用。');
    }
    if (/^How to write and run a dynamic workflow script with the `run_workflow` tool:/i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '说明如何使用 `run_workflow` 工具编写并运行动态工作流脚本：通过 `agent`、`parallel`、`pipeline` 和 `phase` 编排多个智能体的 Python 脚本，适用于多阶段或并行拆分任务。');
    }
    if (/^ONLY for the native-swarm worker whose brief says it is the monitor\./i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '仅限任务简报中指定为监控员的原生集群成员使用。按定时器检查整个集群是否发生停滞，并唤醒能够解除阻塞的关键成员；协调者与其他成员请勿加载。');
    }
    if (/^ONLY for the native-swarm worker whose brief says it is the narrator\./i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '仅限任务简报中指定为旁白员的原生集群成员使用。持续监听消息板，并保持用户概览视图（view.json）背后的事实状态实时更新；协调者与其他成员请勿加载。');
    }
    if (/^Discover UI plugin panels relevant to the current task and surface a one-click pill/i.test(collapsed)) {
      return replaceTrimmed(str, trimmed, '发现与当前任务相关的 UI 插件面板，并在对话中显示一键切换按钮以便在侧边栏中打开或收起。当运行中的 UI 插件面板有助当前操作，或刚启用新面板需要快捷入口时使用。');
    }

    // 5. 常见操作短语兜底
    if (/^see all$/i.test(trimmed)) return replaceTrimmed(str, trimmed, '查看全部');
    if (/^delete$/i.test(trimmed)) return replaceTrimmed(str, trimmed, '删除');
    if (/^rename$/i.test(trimmed)) return replaceTrimmed(str, trimmed, '重命名');
    if (/^mark\s+unread$/i.test(trimmed)) return replaceTrimmed(str, trimmed, '标记为未读');
    if (/^mark\s+read$/i.test(trimmed)) return replaceTrimmed(str, trimmed, '标记为已读');

    return str;
  }

  function translateContextualTextNode(node, el, original) {
    const trimmed = original.trim();

    // A. 模型卡片中的 "left" / "% left" 跨节点兄弟感知
    if (/^left$/i.test(trimmed) || /^%\s*left$/i.test(trimmed)) {
      let isQuota = false;
      let prev = node.previousSibling;
      while (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) {
        prev = prev.previousSibling;
      }
      if (prev) {
        const prevText = prev.nodeType === 3 ? prev.nodeValue : prev.textContent;
        if (prevText && (/%|\d/.test(prevText))) isQuota = true;
      }
      if (!isQuota && el && el.textContent && /[0-9]+%/.test(el.textContent)) {
        isQuota = true;
      }
      if (!isQuota && el && el.closest && el.closest('[class*="quota"], [class*="usage"], [class*="limit"], [class*="popover"], [class*="card"]')) {
        isQuota = true;
      }
      if (isQuota) {
        node.nodeValue = original.replace(/left/i, '剩余');
        return true;
      }
    }

    // B. 上下文区分 "New": 新建按钮 vs 模型新版本/组件全新角标
    if (trimmed === 'New' && el) {
      if (el.closest('[data-testid="sidecar-new-button"]')) {
        node.nodeValue = replaceTrimmed(original, trimmed, '新建');
        return true;
      }
      const isModelBadge =
        el.closest('[data-testid*="model-selector"], [data-radix-popper-content-wrapper], [data-floating-ui-portal]') ||
        (el.closest('.rounded-full') && !el.closest('button, [role="button"]')) ||
        Boolean(el.parentElement && el.parentElement.hasAttribute && el.parentElement.hasAttribute('data-tooltip-id'));
      if (isModelBadge) {
        node.nodeValue = replaceTrimmed(original, trimmed, '全新');
        return true;
      }
      if (el.tagName === 'SPAN' && typeof el.className === 'string' && el.className.includes('bg-secondary')) {
        node.nodeValue = replaceTrimmed(original, trimmed, '新增');
        return true;
      }
      if (el.closest('button, [role="button"]')) {
        node.nodeValue = replaceTrimmed(original, trimmed, '新建');
        return true;
      }
      return true;
    }

    // C. 模型推理档位 (Low / Medium / High / Extra / Max) 及其触发器拼接词 (" Medium · 1M")
    const effortMatch = /^(\s*)(Low|Medium|High|Extra|Max)(\s*\u00b7\s*[A-Za-z0-9.]+)?(\s*)$/i.exec(original);
    if (effortMatch && el) {
      const inModelUi = Boolean(
        el.closest('[data-testid*="model-selector"], [data-testid*="effort"], [data-effort], [data-radix-popper-content-wrapper], [data-radix-menu-content], [data-floating-ui-portal], [role="menu"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="listbox"], [role="option"]') ||
        (el.previousElementSibling && el.previousElementSibling.getAttribute && el.previousElementSibling.getAttribute('data-testid') === 'model-selector-effort-group')
      );
      if (inModelUi) {
        const efCn = EFFORT_MAP[effortMatch[2].toLowerCase()] || effortMatch[2];
        const nextVal = effortMatch[1] + efCn + (effortMatch[3] || '') + effortMatch[4];
        if (nextVal !== original) node.nodeValue = nextVal;
        return true;
      }
    }

    // D. 分裂 DOM 句子片段精准感知 (Plan Review Policy / Modified in / Voice Picker / Remote Control)
    if (el) {
      const parentText = el.textContent || '';
      if ((trimmed === 'Type' || trimmed === 'and select' || trimmed === 'to have the agent generate a plan.') &&
          (/generate a plan|生成计划/i.test(parentText) || el.querySelector('code'))) {
        if (trimmed === 'Type' && /and select.*(?:generate a plan|生成计划)|并选择.*生成计划/i.test(parentText)) {
          node.nodeValue = replaceTrimmed(original, 'Type', '输入');
          return true;
        }
        if (trimmed === 'and select' && /generate a plan|生成计划/i.test(parentText)) {
          node.nodeValue = replaceTrimmed(original, 'and select', '并选择');
          return true;
        }
        if (trimmed === 'to have the agent generate a plan.') {
          node.nodeValue = replaceTrimmed(original, trimmed, '即可让智能体生成计划。');
          return true;
        }
      }
      if (trimmed === 'Modified in') {
        const hasTargetChild = Boolean(el.querySelector && el.querySelector('button, a, [role="button"]'));
        const hasTargetNextEl = Boolean(el.nextElementSibling && (el.nextElementSibling.tagName === 'BUTTON' || el.nextElementSibling.tagName === 'A'));
        if (hasTargetChild || hasTargetNextEl) {
          node.nodeValue = replaceTrimmed(original, trimmed, '修改于');
          return true;
        }
      }
      if (/^Powered by Gemini Live(?:\s*\u00b7)?$/i.test(trimmed)) {
        node.nodeValue = original.replace(/Powered by Gemini Live(\s*\u00b7)?/i, '由 Gemini Live 提供支持$1');
        return true;
      }
      if (trimmed === 'You can change this in' && /later\.?/i.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '您之后可以在');
        return true;
      }
      if (trimmed === 'later.' && (parentText.includes('You can change this in') || parentText.includes('您之后可以在'))) {
        node.nodeValue = replaceTrimmed(original, trimmed, '中修改。');
        return true;
      }
      if (trimmed === "Remote Control isn't active on this instance. Enable it in") {
        node.nodeValue = replaceTrimmed(original, trimmed, '当前实例未启用远程控制。请前往');
        return true;
      }
      if (trimmed === ', then reopen this dialog.' && (parentText.includes("Remote Control isn't active") || parentText.includes('当前实例未启用远程控制'))) {
        node.nodeValue = replaceTrimmed(original, trimmed, '，然后重新打开此对话框。');
        return true;
      }
      if (trimmed === 'For Antigravity Business consumption options, see') {
        node.nodeValue = replaceTrimmed(original, trimmed, '有关 Antigravity Business 的用量计费选项，请参阅');
        return true;
      }
      if (trimmed === 'documentation' && el.tagName === 'A' && el.parentElement &&
          /(?:Antigravity Business|用量计费选项|请参阅)/i.test(el.parentElement.textContent || '')) {
        node.nodeValue = replaceTrimmed(original, trimmed, '官方文档');
        return true;
      }
      if (trimmed === 'Delete' && /\? This removes it from your config directory|\? This action cannot be undone|从您的配置目录中移除|此操作无法撤销/.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '确定要删除');
        return true;
      }
      if (trimmed === 'Are you sure you want to delete' && (el.querySelector('strong, b, code') || /\? (?:This will remove it from your MCP|This action cannot be undone)|MCP 配置中移除|此操作无法撤销/.test(parentText))) {
        node.nodeValue = replaceTrimmed(original, trimmed, '您确定要删除');
        return true;
      }
      if (trimmed === 'Permanently delete' && (el.querySelector('strong, b') || /无法撤销|This action cannot be undone/i.test(parentText))) {
        node.nodeValue = replaceTrimmed(original, trimmed, '永久删除');
        return true;
      }
      if (trimmed === '? This removes it from your config directory.') {
        node.nodeValue = replaceTrimmed(original, trimmed, ' 吗？这将从您的配置目录中移除该项。');
        return true;
      }
      if (trimmed === '? This will remove it from your MCP configuration.') {
        node.nodeValue = replaceTrimmed(original, trimmed, ' 吗？这将从您的 MCP 配置中移除该项。');
        return true;
      }
      if (trimmed === '? This action cannot be undone.') {
        node.nodeValue = replaceTrimmed(original, trimmed, ' 吗？此操作无法撤销。');
        return true;
      }
      if (trimmed === 'is managed by the' && /automation and can only be deleted|删除该自动化任务/.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '由自动化任务');
        return true;
      }
      if (/^automation and can only be deleted by deleting that automation\.?$/i.test(trimmed)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '托管，只能通过删除该自动化任务来移除。');
        return true;
      }
      if (trimmed === 'This' && /(?:is managed by the|由自动化任务)/.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '此');
        return true;
      }
      if (trimmed === '. Reload the window if a change does not take effect.') {
        node.nodeValue = replaceTrimmed(original, trimmed, '。如更改未生效，请重新加载窗口。');
        return true;
      }
      if (trimmed === 'Google Privacy Policy') {
        node.nodeValue = replaceTrimmed(original, trimmed, 'Google 隐私政策');
        return true;
      }
      if (trimmed === '. You can control this from your settings at any point.') {
        node.nodeValue = replaceTrimmed(original, trimmed, '。您可以随时在设置中进行调整。');
        return true;
      }
      if (trimmed === 'Many external websites (such as Google Search, GitHub, or Wikipedia) restrict iframe embedding via') {
        node.nodeValue = replaceTrimmed(original, trimmed, '许多外部网站（例如 Google 搜索、GitHub 或 Wikipedia）会通过');
        return true;
      }
      if (trimmed === 'or' && /restrict iframe embedding via|限制 iframe 嵌入|X-Frame-Options/i.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '或');
        return true;
      }
      if (trimmed === '. If a page fails to load, use the') {
        node.nodeValue = replaceTrimmed(original, trimmed, '。如果页面加载失败，请使用地址栏中的');
        return true;
      }
      if (trimmed === 'icon in the URL bar.') {
        node.nodeValue = replaceTrimmed(original, trimmed, '图标。');
        return true;
      }
      if (trimmed === 'Open in new tab' && el.parentElement && /URL bar|地址栏|页面加载失败/.test(el.parentElement.textContent || '')) {
        node.nodeValue = replaceTrimmed(original, trimmed, '在新标签页中打开');
        return true;
      }
      if (trimmed === 'Hold' && /to add to Agent|添加到智能体/.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '按住');
        return true;
      }
      if (trimmed === 'to add to Agent') {
        node.nodeValue = replaceTrimmed(original, trimmed, '以添加到智能体');
        return true;
      }
      if (trimmed === ". It is not visible in the agent's sandbox and is shared across all your projects.") {
        node.nodeValue = replaceTrimmed(original, trimmed, '。该文件在智能体沙盒中不可见，并在您的所有项目间共享。');
        return true;
      }
      if (trimmed === 'Copy the folder elsewhere first if you might want it back.') {
        node.nodeValue = replaceTrimmed(original, trimmed, '如日后可能需要恢复，请先将该文件夹复制到其他位置。');
        return true;
      }
      if (trimmed === 'This cannot be undone.' && el.parentElement && /Copy the folder elsewhere|先将该文件夹复制到其他位置/.test(el.parentElement.textContent || '')) {
        node.nodeValue = replaceTrimmed(original, trimmed, '此操作无法撤销。');
        return true;
      }
      if (trimmed === 'Project' && /already exists for this|已存在于/.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, '项目');
        return true;
      }
      if (trimmed === 'already exists for this') {
        node.nodeValue = replaceTrimmed(original, trimmed, '已存在于当前');
        return true;
      }
      if ((trimmed === 'folder' || trimmed === 'combination of folders') && /already exists for this|已存在于当前/.test(parentText)) {
        node.nodeValue = replaceTrimmed(original, trimmed, trimmed === 'folder' ? '文件夹' : '文件夹组合');
        return true;
      }
      if (trimmed === '. Would you like to continue using it or make a new one?') {
        node.nodeValue = replaceTrimmed(original, trimmed, '中。您想继续使用该项目，还是创建一个新项目？');
        return true;
      }
    }

    return false;
  }

  function translateNode(node) {
    if (!node) return;

    if (node.nodeType === 3) {
      const el = node.parentElement;
      if (!el || isBlockedNode(el)) return;
      const original = node.nodeValue;
      if (!original || !original.trim() || !/[a-zA-Z]/.test(original)) return;
      if (translateContextualTextNode(node, el, original)) return;
      const translated = translateText(original);
      if (translated !== original) {
        node.nodeValue = translated;
      }
    } else if (node.nodeType === 1) {
      const tag = node.tagName.toUpperCase();
      if (BLOCKED_TAGS.has(tag)) {
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          const ph = node.getAttribute('placeholder');
          if (ph && /[a-zA-Z]/.test(ph)) {
            const tph = translateText(ph);
            if (tph !== ph) node.setAttribute('placeholder', tph);
          }
        }
        return;
      }

      if (isBlockedNode(node)) return;

      const attrs = ['placeholder', 'title', 'aria-label'];
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (node.hasAttribute && node.hasAttribute(attr)) {
          const val = node.getAttribute(attr);
          if (val && /[a-zA-Z]/.test(val)) {
            const tVal = translateText(val);
            if (tVal !== val) node.setAttribute(attr, tVal);
          }
        }
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        translateNode(child);
      }
    }
  }

  const observer = new MutationObserver(function(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type === 'childList') {
        for (let j = 0; j < m.addedNodes.length; j++) {
          translateNode(m.addedNodes[j]);
        }
      } else if (m.type === 'characterData') {
        translateNode(m.target);
      } else if (m.type === 'attributes') {
        const el = m.target;
        if (!el || el.nodeType !== 1 || !m.attributeName || isBlockedNode(el)) continue;
        const val = el.getAttribute(m.attributeName);
        if (val && /[a-zA-Z]/.test(val)) {
          const tVal = translateText(val);
          if (tVal !== val) el.setAttribute(m.attributeName, tVal);
        }
      }
    }
  });

  const obsOpts = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label']
  };

  function start() {
    const root = document.documentElement || document.body;
    if (root) {
      try {
        observer.observe(root, obsOpts);
        translateNode(root);
      } catch (e) {}
    }
  }

  if (typeof Element !== 'undefined' && Element.prototype && Element.prototype.attachShadow) {
    const origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function() {
      const sr = origAttachShadow.apply(this, arguments);
      try {
        observer.observe(sr, obsOpts);
        translateNode(sr);
      } catch (e) {}
      return sr;
    };
  }

  if (typeof document !== 'undefined') {
    start();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('load', start);
    }
    setTimeout(start, 50);
    setTimeout(start, 200);
    setTimeout(start, 600);
    setTimeout(start, 1500);
    setTimeout(start, 3000);
    setTimeout(start, 6000);
  }
})();
