'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DICT_PATH = path.join(ROOT_DIR, 'dict', 'master_merged_dict.json');
const ENGINE_PATH = path.join(ROOT_DIR, 'src', 'engine_preload.js');

function parseDistDirArg(argv) {
  const idx = argv.indexOf('--dist-dir');
  if (idx !== -1 && argv[idx + 1]) return path.resolve(argv[idx + 1]);
  return null;
}

const cliArgs = process.argv.slice(2);
const distDir = parseDistDirArg(cliArgs);
const blockAutoUpdate = cliArgs.includes('--block-auto-update');

// 1. Validate dictionary integrity & zero private contamination
const dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
const dictEntries = Object.entries(dict);
assert(dictEntries.length > 6000, `Expected >6000 dict entries, got ${dictEntries.length}`);
for (const [k, v] of dictEntries) {
  assert.strictEqual(typeof k, 'string');
  assert.strictEqual(typeof v, 'string');
  assert(k.length > 0 && v.length > 0, `Empty key/value found in dict: ${JSON.stringify(k)}`);
}

// 2. Build runnable engine code either from extracted dist/preload.js or directly from src/engine_preload.js + dict
let engineCode;
if (distDir) {
  const preloadCode = fs.readFileSync(path.join(distDir, 'preload.js'), 'utf8');
  const idx = preloadCode.indexOf('// Antigravity Chinese Localization Engine');
  assert(idx !== -1, 'Localization engine marker not found in dist/preload.js');
  engineCode = preloadCode.slice(idx);
} else {
  execFileSync('node', ['--check', ENGINE_PATH]);
  const template = fs.readFileSync(ENGINE_PATH, 'utf8');
  const placeholder = 'const MERGED_DICT = {};';
  assert(template.includes(placeholder), 'MERGED_DICT placeholder missing in src/engine_preload.js');
  engineCode = template.replace(placeholder, () => `const MERGED_DICT = ${JSON.stringify(dict)};`);
}

// Lightweight DOM mock matching selector & sibling traversal used by engine_preload.js
function matchesSimpleSelector(el, sel) {
  if (!el || el.nodeType !== 1) return false;
  sel = sel.trim();
  if (!sel) return false;

  let rem = sel;
  const tagMatch = /^[a-zA-Z0-9_-]+/.exec(rem);
  if (tagMatch) {
    if (el.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
    rem = rem.slice(tagMatch[0].length);
  }
  while (rem.length > 0) {
    if (rem.startsWith('.')) {
      const m = /^\.([a-zA-Z0-9_-]+)/.exec(rem);
      if (!m) return false;
      const classes = (el.className || '').split(/\s+/).filter(Boolean);
      if (!classes.includes(m[1])) return false;
      rem = rem.slice(m[0].length);
    } else if (rem.startsWith('[')) {
      const m = /^\[([a-zA-Z0-9_-]+)(?:(\*?=)"([^"]*)")?\]/.exec(rem);
      if (!m) return false;
      const attrVal = el.getAttribute(m[1]);
      if (m[2] === '=') {
        if (attrVal !== m[3]) return false;
      } else if (m[2] === '*=') {
        if (attrVal == null || !String(attrVal).includes(m[3])) return false;
      } else {
        if (!el.hasAttribute(m[1])) return false;
      }
      rem = rem.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

class MockNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.parentElement = null;
    this.parentNode = null;
    this.previousSibling = null;
    this.nextSibling = null;
  }
}

class MockText extends MockNode {
  constructor(value) {
    super(3);
    this.nodeValue = value;
  }
  get textContent() {
    return this.nodeValue;
  }
}

class MockElement extends MockNode {
  constructor(tagName, attrs = {}, children = []) {
    super(1);
    this.tagName = tagName.toUpperCase();
    this.attrs = {};
    for (const [k, v] of Object.entries(attrs)) {
      this.attrs[k] = String(v);
    }
    this.children = [];
    this.style = {};
    this._listeners = {};
    for (const ch of children) {
      this.appendChild(typeof ch === 'string' ? new MockText(ch) : ch);
    }
  }
  get id() {
    return this.attrs.id || '';
  }
  set id(v) {
    this.attrs.id = String(v);
  }
  get className() {
    return this.attrs.class || '';
  }
  get firstChild() {
    return this.children[0] || null;
  }
  get previousElementSibling() {
    let cur = this.previousSibling;
    while (cur && cur.nodeType !== 1) cur = cur.previousSibling;
    return cur || null;
  }
  get nextElementSibling() {
    let cur = this.nextSibling;
    while (cur && cur.nodeType !== 1) cur = cur.nextSibling;
    return cur || null;
  }
  get textContent() {
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(val) {
    this.children = [];
    if (val !== undefined && val !== null && String(val) !== '') {
      this.appendChild(new MockText(String(val)));
    }
  }
  _relinkChildren() {
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      c.parentElement = this;
      c.parentNode = this;
      c.previousSibling = i > 0 ? this.children[i - 1] : null;
      c.nextSibling = i + 1 < this.children.length ? this.children[i + 1] : null;
    }
  }
  appendChild(child) {
    if (child.parentNode && typeof child.parentNode.removeChild === 'function') {
      child.parentNode.removeChild(child);
    }
    this.children.push(child);
    this._relinkChildren();
    return child;
  }
  insertBefore(newNode, refNode) {
    if (!refNode) return this.appendChild(newNode);
    if (newNode.parentNode && typeof newNode.parentNode.removeChild === 'function') {
      newNode.parentNode.removeChild(newNode);
    }
    const idx = this.children.indexOf(refNode);
    if (idx === -1) return this.appendChild(newNode);
    this.children.splice(idx, 0, newNode);
    this._relinkChildren();
    return newNode;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
      child.parentNode = null;
      child.previousSibling = null;
      child.nextSibling = null;
      this._relinkChildren();
    }
    return child;
  }
  contains(node) {
    let cur = node;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode || cur.parentElement;
    }
    return false;
  }
  addEventListener(ev, fn) {
    if (!this._listeners[ev]) this._listeners[ev] = [];
    this._listeners[ev].push(fn);
  }
  click() {
    const fns = this._listeners.click || [];
    for (const fn of fns) fn({ target: this, preventDefault() {} });
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name);
  }
  getAttribute(name) {
    return this.hasAttribute(name) ? this.attrs[name] : null;
  }
  setAttribute(name, val) {
    this.attrs[name] = String(val);
  }
  matchesSelectorList(selectorList) {
    return selectorList.split(',').some((s) => matchesSimpleSelector(this, s));
  }
  closest(selectorList) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (cur.matchesSelectorList(selectorList)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  querySelector(selectorList) {
    for (const ch of this.children) {
      if (ch.nodeType === 1) {
        if (ch.matchesSelectorList(selectorList)) return ch;
        const found = ch.querySelector(selectorList);
        if (found) return found;
      }
    }
    return null;
  }
  querySelectorAll(selectorList) {
    const out = [];
    const walk = (node) => {
      for (const ch of node.children) {
        if (ch.nodeType === 1) {
          if (ch.matchesSelectorList(selectorList)) out.push(ch);
          walk(ch);
        }
      }
    };
    walk(this);
    return out;
  }
}

let capturedObserver = null;
let capturedObserverOpts = null;
const rootEl = new MockElement('html', {}, [new MockElement('body')]);
const body = rootEl.children[0];
const el = (tag, attrs, children) => new MockElement(tag, attrs, children);

const nodes = {};
const addCase = (key, node) => {
  nodes[key] = node;
  body.appendChild(node);
  return node;
};

// Home greetings
addCase('greet1', el('h1', {}, ['Hey Alice, what should we build today?']));
addCase('greet2', el('h1', {}, ['Welcome back, Alice. Where should we pick up?']));

// Settings General + Voice + Feedback
addCase('kwTitle', el('div', {}, ['Knowledge Work']));
addCase('kwDesc', el('div', {}, ['Simplified interface for research, writing, and everyday tasks.']));
addCase('seTitle', el('div', {}, ['Software Engineering']));
addCase('seDesc', el('div', {}, ['Full interface for coding, developer tools, and managing agents.']));
addCase('permPreset', el('span', {}, ['Permission Preset']));
addCase('planPolicy', el('span', {}, ['Plan Review Policy']));
addCase('modifiedIn', el('span', { class: 'inline-block' }, ['Modified in', ' ', el('button', {}, ['example-project/board'])]));
addCase('planSlashHint', el('div', {}, [
  'Type ', el('span', { class: 'bg-secondary font-mono' }, ['/']), ' and select ', el('span', { class: 'bg-secondary font-mono' }, ['plan']), ' ', 'to have the agent generate a plan.'
]));
addCase('voiceMode', el('div', {}, ['Voice mode']));
addCase('voiceLabel', el('span', {}, ['Voice']));
addCase('voiceDesc', el('span', {}, ['The voice used in Voice mode. Powered by Gemini Live.']));
addCase('notSet', el('span', {}, ['Not set']));
addCase('micLabel', el('span', {}, ['Microphone']));
addCase('micDesc', el('span', {}, ['Input device for voice mode and dictation.']));
addCase('sysDefault', el('span', {}, ['System default']));
addCase('volLabel', el('span', {}, ['Volume']));
addCase('volDesc', el('span', {}, ["How loud Antigravity's voice is."]));
addCase('feedbackBtn', el('button', {}, ['Give Feedback']));
addCase('voicePickerHint', el('div', {}, [
  'Powered by Gemini Live \u00b7 ', 'You can change this in', ' ', el('button', {}, ['Settings']), ' ', 'later.'
]));

// Notifications & Appearance
addCase('sysPrefNote', el('div', {}, ["To modify notification settings, open your operating system's system preferences."]));
addCase('appSubtitle', el('p', {}, ["Configure the agent's visual theme and display preferences."]));
addCase('appChat', el('h3', {}, ['Chat']));
addCase('convSteps', el('span', {}, ['Conversation Steps']));
addCase('convStepsDesc', el('span', {}, ['Choose how much detail is shown during a conversation.']));
addCase('verbose', el('button', {}, ['Verbose']));
addCase('contrast', el('span', {}, ['Contrast']));
addCase('strong', el('button', {}, ['Strong']));
addCase('font', el('span', {}, ['Font']));
addCase('fontSize', el('span', {}, ['Font Size']));
addCase('codePreview', el('button', {}, [el('span', {}, ['Code Preview'])]));
addCase('chatLayout', el('h3', {}, ['Chat Layout']));
addCase('notifAgent', el('span', {}, ['Enable Notifications for Agent']));
addCase('notifDesc', el('span', {}, ['Show system notifications when your action is needed or the agent finishes.']));
addCase('soundLabel', el('h3', {}, ['Sound']));
addCase('soundDesc', el('span', {}, ['Play a sound when your action is needed or the agent finishes.']));
addCase('volAgentDesc', el('span', {}, ['Set the volume of agent sounds.']));

// Models & Quota
addCase('aiCreditDesc', el('div', {}, ["When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits."]));
addCase('refreshWeekly', el('div', {}, ['You have used some of your weekly limit, it will fully refresh in 6 days, 23 hours.']));
addCase('refresh5h', el('div', {}, ['You have used some of your 5-hour limit, it will fully refresh in 4 hours, 24 minutes.']));
addCase('argonWeekly', el('div', {}, ['Gemini 4 Argon Weekly Limit']));
addCase('splitQuota', el('div', {}, [el('span', {}, ['77%']), el('span', {}, ['left'])]));

// Browser settings
addCase('browserSub', el('p', {}, ['Configure built-in browser, link opening, and browser subagent preferences.']));
addCase('builtInH', el('h3', {}, ['Built-in Browser']));
addCase('openLinksIn', el('span', {}, ['Open Links In']));
addCase('openLinksDesc', el('span', {}, ['Choose where links open by default when clicked.']));
addCase('extBrowser', el('button', {}, ['External Browser']));
addCase('dlLoc', el('span', {}, ['Download Location']));
addCase('dlLocDesc', el('span', {}, ['Folder where files downloaded in the built-in browser are saved.']));
addCase('changeBtn', el('button', {}, ['Change\u2026']));
addCase('browsingHist', el('span', {}, ['Browsing History']));
addCase('browsingHistDesc', el('span', {}, ['Clear visited URLs and autocomplete suggestions from the built-in browser.']));
addCase('subagentH', el('h3', {}, ['Browser Subagent']));
addCase('subagentDesc', el('span', {}, ['Configure allowed and denied URLs for the browser subagent. It runs in the built-in browser, so no separate browser install is needed.']));

// Model Selector "New" & Efforts & Trigger
addCase('modelNewBadge', el('div', { 'data-tooltip-id': 'tip1', class: 'bg-secondary opacity-70 flex items-center gap-1 rounded-full px-1.5 text-sm' }, [
  el('span', {}, ['New'])
]));
addCase('sidecarNewBtn', el('button', { 'data-testid': 'sidecar-new-button' }, ['New']));
addCase('artifactNew', el('span', { class: 'text-sm bg-secondary rounded px-1 py-px' }, ['New']));
addCase('effortMenu', el('div', { role: 'menu' }, [
  el('div', { role: 'menuitemradio' }, [
    el('span', { 'data-testid': 'model-selector-effort-group', 'data-model-base': 'Gemini 4 Argon' }, ['Gemini 4 Argon']),
    el('span', { class: 'shrink-0 opacity-70 text-sm' }, ['Medium'])
  ]),
  el('span', { 'data-testid': 'model-selector-effort-option', 'data-effort': 'low' }, ['Low']),
  el('span', { 'data-testid': 'model-selector-effort-option', 'data-effort': 'medium' }, ['Medium']),
  el('span', { 'data-testid': 'model-selector-effort-option', 'data-effort': 'high' }, ['High']),
  el('span', { 'data-testid': 'model-selector-effort-option', 'data-effort': 'xhigh' }, ['Extra']),
  el('span', { 'data-testid': 'model-selector-effort-option', 'data-effort': 'max' }, ['Max']),
]));
addCase('modelTrigger', el('button', { 'data-testid': 'model-selector-trigger', 'aria-label': 'Select model, current: Gemini 4 Argon Medium · 1M' }, [
  el('span', {}, ['Gemini 4 Argon', el('span', { class: 'opacity-70' }, [' ', 'Medium \u00b7 1M'])])
]));

// Dialogs, Tooltips, Builtin skills & Split JSX
addCase('tooltipRemoval', el('div', { role: 'tooltip' }, ['GPT-OSS will be removed from Antigravity on November 18, 2026.']));
addCase('tooltipUltra', el('div', { role: 'tooltip' }, ['Gemini 4 Carbon is currently available to Ultra plan subscribers.']));
addCase('delDialog', el('div', { role: 'dialog' }, ['Are you sure you want to delete this conversation? This action cannot be undone.']));
addCase('remoteWarn', el('p', {}, ["Remote Control isn't active on this instance. Enable it in", ' ', el('button', {}, ['Settings']), ', then reopen this dialog.']));
addCase('tooltipGroupGemini', el('div', { role: 'tooltip', class: 'compact-tooltip surface-glass' }, ['Models within this group: Gemini Flash, Gemini Pro']));
addCase('tooltipGroupClaude', el('div', { role: 'tooltip', class: 'compact-tooltip surface-glass' }, ['Models within this group: Claude Opus, Claude Sonnet, GPT-OSS']));
addCase('tooltipGroupDynamic', el('div', { role: 'tooltip', class: 'compact-tooltip surface-glass' }, ['Models within this group: Gemini Nano, Gemini Ultra']));
addCase('tooltipArgon', el('div', { role: 'tooltip', class: 'compact-tooltip surface-glass' }, ['For paid Pro plans, Argon quota is separate. Higher Argon quota (included as part of the larger Gemini quota bucket) is available on Ultra plans.']));
addCase('tooltipOverages', el('div', { role: 'tooltip' }, ["Your plan's baseline quota will refresh on November 18, 2026. To continue using this model now, enable AI Credit overages."]));
addCase('swarmPluginDesc', el('p', {}, ['Unlock the power of agent swarms.']));
addCase('skillPlugin', el('p', {}, ['How to manage and create plugins — namespaced bundles of skills, agents, rules, MCP servers and hooks that install, enable and disable as a single unit. Use this skill when the user wants to enable, disable, install or uninstall a plugin, when they want to create a new plugin, or when a new customization should be packaged into a plugin rather than left loose. Also triggered by the /plugin slash command. Don\'t use for the underlying customization system itself — discovery roots, loading priority, or authoring a standalone skill, agent, rule, hook or MCP server outside a plugin; see the customizations guide skill for those.']));
addCase('skillRunWorkflowMultiline', el('p', {}, ['How to write and run a dynamic workflow script with the `run_workflow` tool:\n  a Python script that orchestrates many agents with `agent`, `parallel`,\n  `pipeline`, and `phase`. Use when a task splits...']));
addCase('skillSwarm', el('p', {}, ["(Preview & Quota Heavy) Run a swarm: several agents working in parallel on one task, each in its own conversation, collaborating through a shared message board. Use when the work splits into pieces that can be done at the same time, or when a second pair of eyes should check the first pair's work."]));
addCase('skillSwarmMonitor', el('p', {}, ['ONLY for the native-swarm worker whose brief says it is the monitor. On a timer, it checks whether the whole swarm has stalled and calls on the one member who can unstick it. Coordinators and other workers: do not load this.']));
addCase('skillUiNav', el('p', {}, ["Discover UI plugin panels relevant to the current task and surface a one-click pill in chat to open (toggle) them in the side pane. Use when a running UI plugin's panel would help with what the user is doing, or right after the user enables a new UI plugin pane and a shortcut to open it is handy."]));
addCase('bizConsume', el('div', { class: 'text-secondary-foreground py-2 px-3' }, ['For Antigravity Business consumption options, see', ' ', el('a', { href: 'https://antigravity.google/docs/enterprise' }, ['documentation']), '.']));
addCase('sandboxWarn', el('div', {}, ['⚠️ Warning: "Always Proceed" is enabled without sandbox protection. This is very dangerous and we do not recommend doing this.']));
addCase('delConfigDir', el('div', { role: 'dialog' }, ['Delete ', el('strong', {}, ['my-skill']), '? This removes it from your config directory.']));
addCase('delMcpCfg', el('div', { role: 'dialog' }, ['Are you sure you want to delete ', el('strong', {}, ['github-mcp']), '? This will remove it from your MCP configuration.']));
addCase('autoManaged', el('span', {}, ['This ', 'automation', ' is managed by the', ' ', el('strong', {}, ['daily-sync']), ' automation and can only be deleted by deleting that automation.']));
addCase('iframeTooltip', el('div', { role: 'tooltip' }, [
  'Many external websites (such as Google Search, GitHub, or Wikipedia) restrict iframe embedding via ',
  el('code', { class: 'text-foreground' }, ['X-Frame-Options']),
  ' or ',
  el('code', { class: 'text-foreground' }, ['CSP']),
  '. If a page fails to load, use the ',
  el('span', { class: 'font-medium text-foreground' }, ['Open in new tab']),
  ' icon in the URL bar.'
]));
addCase('projExists', el('div', {}, ['Project ', el('span', {}, ['my-proj']), ' already exists for this ', 'folder', '. Would you like to continue using it or make a new one?']));
addCase('remoteDelAll', el('p', {}, ['Permanently delete your remote conversations, projects, scheduled tasks, connected plugins and settings. Data in the desktop app and your Google account are not affected.']));
addCase('githubPolicy', el('p', {}, ['Enable fine-grained GitHub permissions and define the org, repository, and resource-level access the agent is allowed to use.']));
addCase('devManageApp', el('p', {}, ['Manage Antigravity app settings.']));
addCase('devManageOtherApp', el('p', {}, ['Manage Codex app settings.']));
addCase('inheritsPerm', el('p', {}, ['Inherits your Global Permissions when working locally.']));
addCase('delRecs', el('p', {}, ["This deletes 3 call recordings (12.4 MB) from your machine. You can't undo this."]));
addCase('mcpNoCmd', el('p', {}, ['MCP server figma does not have any installation commands.']));
addCase('noPluginsFor', el('p', {}, ['No plugins found for "foo".']));
addCase('modelsSelected', el('span', {}, ['3 models selected']));
addCase('devReloadHint', el('div', {}, ['Override flags: host=', el('b', {}, ['desktop']), '. Reload the window if a change does not take effect.']));
addCase('folderElsewhere', el('span', {}, [el('strong', {}, ['This cannot be undone.']), ' Copy the folder elsewhere first if you might want it back.']));

// Negative / Isolation guards
addCase('proseMedium', el('p', {}, ['Medium']));
addCase('proseNew', el('p', {}, ['New']));
addCase('proseChat', el('p', {}, ['chat']));
addCase('proseStrong', el('p', {}, ['strong']));
addCase('proseFont', el('p', {}, ['font']));
addCase('codePre', el('pre', {}, [el('code', {}, ['Conversation Steps High Low'])]));
addCase('userMsg', el('div', { 'data-role': 'user' }, ['Voice mode Low Software Engineering']));
addCase('guardFontMonoCode', el('span', { class: 'font-mono' }, ['run_workflow']));
addCase('guardInlineCode', el('code', {}, ['agent']));
addCase('guardShellCmd', el('span', { class: 'font-mono' }, ['gh auth login']));
addCase('guardPlainDoc', el('div', {}, [el('a', { href: '/docs' }, ['documentation'])]));
addCase('guardUnknownWord', el('p', {}, ['Unknown']));
addCase('guardUiBlock', el('div', { 'data-agy-zh-guard': '1' }, [el('button', {}, ['Give Feedback'])]));

// Relative Time & Conversation Timestamps
addCase('time6h', el('span', {}, ['6h']));
addCase('time9h', el('span', {}, ['9h']));
addCase('time1d', el('span', {}, ['1d']));
addCase('time3d', el('span', {}, ['3d']));
addCase('time4d', el('span', {}, ['4d']));
addCase('time5d', el('span', {}, ['5d']));
addCase('time20h', el('span', {}, ['20h']));
addCase('time15m', el('span', {}, ['15m']));
addCase('timeDot6h', el('span', {}, ['\u00b7 6h']));
addCase('timeJustNow', el('span', {}, ['just now']));
addCase('time9dE', el('span', {}, ['9 days ago']));
addCase('time12hE', el('span', {}, ['12 hours ago']));

// Realistic Settings dialog shell for Position A injection test
const mockSettingsFeedback = el('button', {}, ['Give Feedback']);
const mockSettingsSidebar = el('div', {}, [
  el('div', {}, [
    el('button', {}, ['General']),
    el('button', {}, ['App Settings']),
    el('button', {}, ['Appearance']),
  ]),
  el('div', {}, [
    mockSettingsFeedback,
    el('div', {}, ['Account']),
  ]),
]);
const mockSectionsList = el('div', {}, [
  el('div', {}, [el('h3', {}, ['Global Permissions'])]),
  el('div', {}, [el('h3', {}, ['Agent Behavior'])]),
  el('div', {}, [el('h3', {}, ['Execution'])]),
]);
addCase('settingsDialog', el('div', {}, [
  mockSettingsSidebar,
  el('div', {}, [mockSectionsList]),
]));

const timers = [];
const mockStorage = new Map();
const findById = (node, id) => {
  if (!node || node.nodeType !== 1) return null;
  if (node.id === id) return node;
  for (const ch of node.children) {
    const f = findById(ch, id);
    if (f) return f;
  }
  return null;
};
const sandbox = {
  console,
  Map,
  Set,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Promise,
  JSON,
  Date,
  RegExp,
  Element: function() {},
  localStorage: {
    getItem(k) { return mockStorage.has(String(k)) ? mockStorage.get(String(k)) : null; },
    setItem(k, v) { mockStorage.set(String(k), String(v)); },
  },
  MutationObserver: class MockMO {
    constructor(cb) {
      this.cb = cb;
      capturedObserver = this;
    }
    observe(target, opts) {
      capturedObserverOpts = opts;
    }
  },
  document: {
    documentElement: rootEl,
    body,
    readyState: 'complete',
    addEventListener() {},
    createElement(tag) {
      return new MockElement(tag);
    },
    getElementById(id) {
      return findById(rootEl, id);
    },
    querySelectorAll(sel) {
      return rootEl.querySelectorAll(sel);
    },
  },
  window: { addEventListener() {} },
  setTimeout(fn) {
    timers.push(fn);
    return timers.length;
  },
};
sandbox.Element.prototype = { attachShadow() { return rootEl; } };

vm.runInNewContext(engineCode, sandbox);
for (let step = 0; timers.length > 0 && step < 40; step++) {
  const fn = timers.shift();
  fn();
}

let assertCount = 0;
const checkEq = (name, actual, expected) => {
  assertCount++;
  assert.strictEqual(actual, expected, `[FAIL] ${name}:\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
};

checkEq('greet1', nodes.greet1.textContent, '你好 Alice，今天想构建什么？');
checkEq('greet2', nodes.greet2.textContent, '欢迎回来，Alice。我们从哪里继续？');
checkEq('kwTitle', nodes.kwTitle.textContent, '知识工作');
checkEq('kwDesc', nodes.kwDesc.textContent, '精简界面，专注于调研、写作与日常任务。');
checkEq('seTitle', nodes.seTitle.textContent, '软件工程');
checkEq('seDesc', nodes.seDesc.textContent, '完整界面，提供编程、开发者工具与智能体管理功能。');
checkEq('permPreset', nodes.permPreset.textContent, '权限预设');
checkEq('planPolicy', nodes.planPolicy.textContent, '计划审阅策略');
checkEq('modifiedIn', nodes.modifiedIn.textContent, '修改于 example-project/board');
checkEq('planSlashHint', nodes.planSlashHint.textContent, '输入 / 并选择 plan 即可让智能体生成计划。');
checkEq('voiceMode', nodes.voiceMode.textContent, '语音模式');
checkEq('voiceLabel', nodes.voiceLabel.textContent, '语音');
checkEq('voiceDesc', nodes.voiceDesc.textContent, '语音模式下使用的声音，由 Gemini Live 提供支持。');
checkEq('notSet', nodes.notSet.textContent, '未设置');
checkEq('micLabel', nodes.micLabel.textContent, '麦克风');
checkEq('micDesc', nodes.micDesc.textContent, '用于语音模式和语音听写的输入设备。');
checkEq('sysDefault', nodes.sysDefault.textContent, '系统默认');
checkEq('volLabel', nodes.volLabel.textContent, '音量');
checkEq('volDesc', nodes.volDesc.textContent, '设置 Antigravity 语音播报的音量大小。');
checkEq('feedbackBtn', nodes.feedbackBtn.textContent, '提交反馈');
checkEq('voicePickerHint', nodes.voicePickerHint.textContent, '由 Gemini Live 提供支持 \u00b7 您之后可以在 设置 中修改。');
checkEq('sysPrefNote', nodes.sysPrefNote.textContent, '要修改通知设置，请打开您操作系统的系统偏好设置。');
checkEq('appSubtitle', nodes.appSubtitle.textContent, '配置智能体的视觉主题与显示偏好设置。');
checkEq('appChat', nodes.appChat.textContent, '对话');
checkEq('convSteps', nodes.convSteps.textContent, '对话步骤细节');
checkEq('convStepsDesc', nodes.convStepsDesc.textContent, '选择对话过程中显示的详细程度。');
checkEq('verbose', nodes.verbose.textContent, '详细');
checkEq('contrast', nodes.contrast.textContent, '对比度');
checkEq('strong', nodes.strong.textContent, '高对比');
checkEq('font', nodes.font.textContent, '字体');
checkEq('fontSize', nodes.fontSize.textContent, '字号');
checkEq('codePreview', nodes.codePreview.textContent, '代码预览');
checkEq('chatLayout', nodes.chatLayout.textContent, '对话布局');
checkEq('notifAgent', nodes.notifAgent.textContent, '启用智能体系统通知');
checkEq('notifDesc', nodes.notifDesc.textContent, '当需要您操作或智能体完成任务时显示系统通知。');
checkEq('soundLabel', nodes.soundLabel.textContent, '声音');
checkEq('soundDesc', nodes.soundDesc.textContent, '当需要您操作或智能体完成任务时播放提示音。');
checkEq('volAgentDesc', nodes.volAgentDesc.textContent, '设置智能体提示音的音量大小。');
checkEq('aiCreditDesc', nodes.aiCreditDesc.textContent, '开启后，当模型配额耗尽时，Antigravity 将自动使用您的 AI 额度来继续处理模型请求。Antigravity 始终会优先消耗模型配额，然后再使用 AI 额度。');
checkEq('refreshWeekly', nodes.refreshWeekly.textContent, '您已使用部分每周限额，将于 6 天 23 小时后完全重置。');
checkEq('refresh5h', nodes.refresh5h.textContent, '您已使用部分5 小时限额，将于 4 小时 24 分钟后完全重置。');
checkEq('argonWeekly', nodes.argonWeekly.textContent, 'Gemini 4 Argon 每周限额');
checkEq('splitQuota', nodes.splitQuota.textContent, '77%剩余');
checkEq('browserSub', nodes.browserSub.textContent, '配置内置浏览器、链接打开方式以及浏览器子智能体偏好设置。');
checkEq('builtInH', nodes.builtInH.textContent, '内置浏览器');
checkEq('openLinksIn', nodes.openLinksIn.textContent, '链接打开方式');
checkEq('openLinksDesc', nodes.openLinksDesc.textContent, '选择点击链接时默认在何处打开。');
checkEq('extBrowser', nodes.extBrowser.textContent, '外部浏览器');
checkEq('dlLoc', nodes.dlLoc.textContent, '下载位置');
checkEq('dlLocDesc', nodes.dlLocDesc.textContent, '设置在内置浏览器中下载文件的保存文件夹。');
checkEq('changeBtn', nodes.changeBtn.textContent, '更改…');
checkEq('browsingHist', nodes.browsingHist.textContent, '浏览历史记录');
checkEq('browsingHistDesc', nodes.browsingHistDesc.textContent, '清除内置浏览器中访问过的网址和自动补全建议。');
checkEq('subagentH', nodes.subagentH.textContent, '浏览器子智能体');
checkEq('subagentDesc', nodes.subagentDesc.textContent, '为浏览器子智能体配置允许和禁止访问的网址列表。它直接运行在内置浏览器中，无需额外安装其他浏览器。');
checkEq('modelNewBadge', nodes.modelNewBadge.textContent, '全新');
checkEq('sidecarNewBtn', nodes.sidecarNewBtn.textContent, '新建');
checkEq('artifactNew', nodes.artifactNew.textContent, '新增');
checkEq('effortMenuRow0', nodes.effortMenu.children[0].children[1].textContent, '中');
checkEq('effortLow', nodes.effortMenu.children[1].textContent, '低');
checkEq('effortMed', nodes.effortMenu.children[2].textContent, '中');
checkEq('effortHigh', nodes.effortMenu.children[3].textContent, '高');
checkEq('effortExtra', nodes.effortMenu.children[4].textContent, '超高');
checkEq('effortMax', nodes.effortMenu.children[5].textContent, '极高');
checkEq('modelTriggerText', nodes.modelTrigger.textContent, 'Gemini 4 Argon 中 \u00b7 1M');
checkEq('modelTriggerAria', nodes.modelTrigger.getAttribute('aria-label'), '选择模型，当前：Gemini 4 Argon 中 \u00b7 1M');
checkEq('tooltipRemoval', nodes.tooltipRemoval.textContent, 'GPT-OSS 将于 2026 年 11 月 18 日 从 Antigravity 中移除。');
checkEq('tooltipUltra', nodes.tooltipUltra.textContent, 'Gemini 4 Carbon 目前仅向 Ultra 方案订阅用户开放。');
checkEq('delDialog', nodes.delDialog.textContent, '您确定要删除此对话吗？此操作无法撤销。');
checkEq('remoteWarn', nodes.remoteWarn.textContent, '当前实例未启用远程控制。请前往 设置，然后重新打开此对话框。');
checkEq('tooltipGroupGemini', nodes.tooltipGroupGemini.textContent, '此分组包含的模型：Gemini Flash、Gemini Pro');
checkEq('tooltipGroupClaude', nodes.tooltipGroupClaude.textContent, '此分组包含的模型：Claude Opus、Claude Sonnet、GPT-OSS');
checkEq('tooltipGroupDynamic', nodes.tooltipGroupDynamic.textContent, '此分组包含的模型：Gemini Nano、Gemini Ultra');
checkEq('tooltipArgon', nodes.tooltipArgon.textContent, '对于付费 Pro 方案，Argon 配额独立计算。Ultra 方案提供更高的 Argon 配额（包含在更大的 Gemini 配额池中）。');
checkEq('tooltipOverages', nodes.tooltipOverages.textContent, '您方案的基础配额将于 2026 年 11 月 18 日 重置。如需立即继续使用此模型，请启用 AI 额度超额用量。');
checkEq('swarmPluginDesc', nodes.swarmPluginDesc.textContent, '释放智能体集群协作的强大能力。');
checkEq('skillPlugin', nodes.skillPlugin.textContent, '说明如何管理与创建插件（将技能、智能体、规则、MCP 服务器与钩子按命名空间打包为可统一安装、启用和停用的单一单元）。当用户希望启用、停用、安装、卸载或新建插件，或将自定义项打包为插件而非散落存放时使用，也可通过 /plugin 斜杠命令触发。请勿用于查询自定义系统底层机制（如发现路径、加载优先级或编写独立自定义项，此类问题请查阅 customizations guide 技能）。');
checkEq('skillRunWorkflowMultiline', nodes.skillRunWorkflowMultiline.textContent, '说明如何使用 `run_workflow` 工具编写并运行动态工作流脚本：通过 `agent`、`parallel`、`pipeline` 和 `phase` 编排多个智能体的 Python 脚本，适用于多阶段或并行拆分任务。');
checkEq('skillSwarm', nodes.skillSwarm.textContent, '（预览功能 · 配额消耗较高）运行智能体集群：多个智能体在各自会话中并行处理同一任务，并通过共享消息板协同工作。适用于可并行拆分的任务，或需要另一双眼睛交叉复核结果的场景。');
checkEq('skillSwarmMonitor', nodes.skillSwarmMonitor.textContent, '仅限任务简报中指定为监控员的原生集群成员使用。按定时器检查整个集群是否发生停滞，并唤醒能够解除阻塞的关键成员；协调者与其他成员请勿加载。');
checkEq('skillUiNav', nodes.skillUiNav.textContent, '发现与当前任务相关的 UI 插件面板，并在对话中显示一键切换按钮以便在侧边栏中打开或收起。当运行中的 UI 插件面板有助当前操作，或用户刚启用新的 UI 插件面板并需要快捷打开入口时使用。');
checkEq('bizConsume', nodes.bizConsume.textContent, '有关 Antigravity Business 的用量计费选项，请参阅 官方文档.');
checkEq('sandboxWarn', nodes.sandboxWarn.textContent, '⚠️ 警告：已在无沙盒保护下启用“始终直接执行”。这非常危险，我们强烈不建议这样做。');
checkEq('delConfigDir', nodes.delConfigDir.textContent, '确定要删除 my-skill 吗？这将从您的配置目录中移除该项。');
checkEq('delMcpCfg', nodes.delMcpCfg.textContent, '您确定要删除 github-mcp 吗？这将从您的 MCP 配置中移除该项。');
assertCount++;
assert(nodes.autoManaged.textContent.includes('由自动化任务 daily-sync 托管，只能通过删除该自动化任务来移除。'));
checkEq('iframeTooltip', nodes.iframeTooltip.textContent, '许多外部网站（例如 Google 搜索、GitHub 或 Wikipedia）会通过 X-Frame-Options 或 CSP。如果页面加载失败，请使用地址栏中的 在新标签页中打开 图标。');
checkEq('projExists', nodes.projExists.textContent, '项目 my-proj 已存在于当前 文件夹中。您想继续使用该项目，还是创建一个新项目？');
checkEq('remoteDelAll', nodes.remoteDelAll.textContent, '永久删除您的远程对话、项目、定时任务、已连接插件和设置。桌面应用和您 Google 账户中的数据不受影响。');
checkEq('githubPolicy', nodes.githubPolicy.textContent, '启用细粒度 GitHub 权限，精确定义允许智能体访问的组织、代码库及资源级权限。');
checkEq('devManageApp', nodes.devManageApp.textContent, '管理 Antigravity 应用程序偏好设置。');
checkEq('devManageOtherApp', nodes.devManageOtherApp.textContent, '管理 Codex 应用设置。');
checkEq('inheritsPerm', nodes.inheritsPerm.textContent, '在本地工作时继承您的全局权限。');
checkEq('delRecs', nodes.delRecs.textContent, '这将从您的设备中永久删除 3 条通话录音（12.4 MB）。此操作无法撤销。');
checkEq('mcpNoCmd', nodes.mcpNoCmd.textContent, 'MCP 服务器 figma 未配置安装命令。');
checkEq('noPluginsFor', nodes.noPluginsFor.textContent, '未找到与“foo”匹配的插件。');
checkEq('modelsSelected', nodes.modelsSelected.textContent, '3 个已选模型');
checkEq('devReloadHint', nodes.devReloadHint.textContent, 'Override flags: host=desktop。如更改未生效，请重新加载窗口。');
checkEq('folderElsewhere', nodes.folderElsewhere.textContent, '此操作无法撤销。 如日后可能需要恢复，请先将该文件夹复制到其他位置。');

// Isolation guard assertions
checkEq('proseMedium', nodes.proseMedium.textContent, 'Medium');
checkEq('proseNew', nodes.proseNew.textContent, 'New');
checkEq('proseChat', nodes.proseChat.textContent, 'chat');
checkEq('proseStrong', nodes.proseStrong.textContent, 'strong');
checkEq('proseFont', nodes.proseFont.textContent, 'font');
checkEq('codePre', nodes.codePre.textContent, 'Conversation Steps High Low');
checkEq('userMsg', nodes.userMsg.textContent, 'Voice mode Low Software Engineering');
checkEq('guardFontMonoCode', nodes.guardFontMonoCode.textContent, 'run_workflow');
checkEq('guardInlineCode', nodes.guardInlineCode.textContent, 'agent');
checkEq('guardShellCmd', nodes.guardShellCmd.textContent, 'gh auth login');
checkEq('guardPlainDoc', nodes.guardPlainDoc.textContent, 'documentation');
checkEq('guardUnknownWord', nodes.guardUnknownWord.textContent, 'Unknown');
checkEq('guardUiBlock', nodes.guardUiBlock.textContent, 'Give Feedback');

// Relative Time assertions
checkEq('time6h', nodes.time6h.textContent, '6小时前');
checkEq('time9h', nodes.time9h.textContent, '9小时前');
checkEq('time1d', nodes.time1d.textContent, '1天前');
checkEq('time3d', nodes.time3d.textContent, '3天前');
checkEq('time4d', nodes.time4d.textContent, '4天前');
checkEq('time5d', nodes.time5d.textContent, '5天前');
checkEq('time20h', nodes.time20h.textContent, '20小时前');
checkEq('time15m', nodes.time15m.textContent, '15分钟前');
checkEq('timeDot6h', nodes.timeDot6h.textContent, '\u00b7 6小时前');
checkEq('timeJustNow', nodes.timeJustNow.textContent, '刚刚');
checkEq('time9dE', nodes.time9dE.textContent, '9天前');
checkEq('time12hE', nodes.time12hE.textContent, '12小时前');

// Position A Settings UI injection assertions
const sidebarPill = findById(rootEl, 'agy-zh-sidebar-pill');
const settingsCard = findById(rootEl, 'agy-zh-settings-card');
assertCount++;
assert(sidebarPill && mockSettingsSidebar.contains(sidebarPill), 'Position A sidebar pill missing from Settings sidebar');
assertCount++;
assert(sidebarPill.nextElementSibling === mockSettingsFeedback, 'Position A sidebar pill should sit right above 提交反馈');
assertCount++;
assert(settingsCard && mockSectionsList.contains(settingsCard), 'Position A settings card missing from General sections');
assertCount++;
assert(settingsCard.textContent.includes('中文汉化与更新') && settingsCard.textContent.includes('Antigravity 深度中文汉化'), 'Position A card content mismatch');
const simBtn = settingsCard.querySelectorAll('button').find((b) => b.textContent.includes('模拟新版提醒'));
assertCount++;
assert(!simBtn, 'Production Position A card should not include preview-only simulation toggle');
const autoToggleBtn = settingsCard.querySelectorAll('button').find((b) => b.textContent === '已开启' || b.textContent === '已关闭');
assertCount++;
assert(autoToggleBtn && autoToggleBtn.textContent === '已开启', 'Auto-check toggle should default to 已开启');
autoToggleBtn.click();
const autoToggleBtnAfter = settingsCard.querySelectorAll('button').find((b) => b.textContent === '已开启' || b.textContent === '已关闭');
assertCount++;
assert(autoToggleBtnAfter && autoToggleBtnAfter.textContent === '已关闭', 'Auto-check toggle should flip to 已关闭 on click');
autoToggleBtnAfter.click();
assertCount++;
assert(sidebarPill.textContent.includes('汉化 v'), 'Sidebar pill should display localized patch version');

// MutationObserver attribute test
assert(capturedObserver && capturedObserverOpts.attributes === true, 'MutationObserver attributes watch missing!');
const dynBtn = el('button', { 'data-testid': 'model-selector-trigger', 'aria-label': 'Original' }, ['New']);
dynBtn.setAttribute('aria-label', 'Select model, current: Claude Opus 5.5 High');
capturedObserver.cb([{ type: 'attributes', target: dynBtn, attributeName: 'aria-label' }]);
checkEq('dynAriaAttr', dynBtn.getAttribute('aria-label'), '选择模型，当前：Claude Opus 5.5 高');

// Voice mode tooltips, controls & split DOM warnings (childList + attribute mutations)
const voiceStartBtn = el('button', { 'data-testid': 'voice-start-button', 'aria-label': 'Start Voice mode' });
const voiceTip = el('div', { id: 'voice-start-tooltip', role: 'tooltip', class: 'compact-tooltip' }, ['Start Voice mode']);
const voiceLiveTip = el('div', { role: 'tooltip', class: 'compact-tooltip' }, ['Start Live Chat']);
const voiceMuteTip = el('div', { id: 'voice-mute-tooltip', role: 'tooltip' }, ['Mute mic (Alt+M)']);
const voiceAgentMuteTip = el('div', { id: 'voice-call-agent-mute-tooltip', role: 'tooltip' }, ['Unmute Antigravity (Alt+A)']);
const voiceSpeedTip = el('div', { id: 'voice-call-speed-tooltip', role: 'tooltip' }, ['Voice speed, 1.5x']);
const voiceTimer = el('span', { role: 'timer', 'aria-label': 'Voice mode, 1:23' }, ['1:23']);
const voiceWarn = el('div', { 'data-testid': 'voice-mic-warning' }, [
  el('button', { 'data-testid': 'voice-mic-warning-switch', 'aria-label': 'No audio from Blue Yeti. Switch mic' }, [
    el('span', {}, ['No audio from Blue Yeti']),
    el('span', {}, ['Switch mic']),
  ]),
  el('button', { 'data-testid': 'voice-mic-warning-reconnect' }, ['Reconnect']),
  el('button', { 'data-testid': 'voice-mic-warning-dismiss', 'aria-label': 'Dismiss microphone warning' }),
]);
const voiceSwitched = el('div', { 'data-testid': 'voice-mic-switched' }, ['Using Blue Yeti']);
const voiceEndBtn = el('button', { 'data-testid': 'voice-call-end', 'aria-label': 'End Voice mode' }, [el('span', {}, ['End'])]);
const nonVoiceEndKbd = el('span', {}, ['End']);
const voiceMarker1 = el('span', { 'data-testid': 'voice-chat-marker' }, ['Started voice chat · 8:30 PM']);
const voiceMarker2 = el('span', { 'data-testid': 'voice-chat-marker' }, ['Stopped voice chat · 2m 05s']);
const voiceTranscriptBtn = el('button', { 'data-testid': 'voice-transcript-card', 'aria-label': 'Open Voice transcript, 2m 05s. Summarizing call' }, [
  el('span', {}, ['Voice transcript']),
  el('span', {}, ['Open']),
  el('span', {}, ['Summarizing call…']),
]);
const voiceErrTip = el('span', { 'data-testid': 'voice-error-tip' }, [
  el('span', {}, ['Your sign-in needs an update. ', el('button', {}, ['Sign in again']), ' to use Voice.']),
  el('button', {}, ['Try again']),
]);
const voiceMicErrTip = el('span', { 'data-testid': 'voice-error-tip' }, [
  el('span', {}, ['Microphone blocked. Allow in ', el('button', {}, ['Privacy Settings']), '.']),
]);
const voiceHost = el('div', {}, [
  voiceStartBtn, voiceTip, voiceLiveTip, voiceMuteTip, voiceAgentMuteTip, voiceSpeedTip,
  voiceTimer, voiceWarn, voiceSwitched, voiceEndBtn, nonVoiceEndKbd,
  voiceMarker1, voiceMarker2, voiceTranscriptBtn, voiceErrTip, voiceMicErrTip,
]);
rootEl.appendChild(voiceHost);
capturedObserver.cb([{ type: 'childList', target: rootEl, addedNodes: [voiceHost] }]);
checkEq('voiceStartAria', voiceStartBtn.getAttribute('aria-label'), '开启语音模式');
checkEq('voiceStartTip', voiceTip.textContent, '开启语音模式');
checkEq('voiceLiveTip', voiceLiveTip.textContent, '开始实时对话');
checkEq('voiceMuteTip', voiceMuteTip.textContent, '静音麦克风 (Alt+M)');
checkEq('voiceAgentMuteTip', voiceAgentMuteTip.textContent, '取消静音 Antigravity (Alt+A)');
checkEq('voiceSpeedTip', voiceSpeedTip.textContent, '语速 1.5x');
checkEq('voiceTimerAria', voiceTimer.getAttribute('aria-label'), '语音模式，1:23');
checkEq('voiceWarnAria', voiceWarn.querySelector('[data-testid="voice-mic-warning-switch"]').getAttribute('aria-label'), '未检测到来自 Blue Yeti 的音频，切换麦克风');
checkEq('voiceWarnText', voiceWarn.querySelector('[data-testid="voice-mic-warning-switch"]').children[0].textContent, '未检测到来自 Blue Yeti 的音频');
checkEq('voiceWarnDismiss', voiceWarn.querySelector('[data-testid="voice-mic-warning-dismiss"]').getAttribute('aria-label'), '关闭麦克风警告');
checkEq('voiceSwitched', voiceSwitched.textContent, '正在使用 Blue Yeti');
checkEq('voiceEndBtn', voiceEndBtn.textContent, '结束');
checkEq('nonVoiceEndUntouched', nonVoiceEndKbd.textContent, 'End');
checkEq('voiceMarkerStart', voiceMarker1.textContent, '已开启语音对话 · 8:30 PM');
checkEq('voiceMarkerStop', voiceMarker2.textContent, '已结束语音对话 · 2 分钟 05 秒');
checkEq('voiceTranscriptAria', voiceTranscriptBtn.getAttribute('aria-label'), '打开语音转录，2m 05s。正在生成通话摘要');
checkEq('voiceTranscriptOpen', voiceTranscriptBtn.children[1].textContent, '打开');
checkEq('voiceErrSplit', voiceErrTip.children[0].textContent, '您的登录状态需要更新，请 重新登录 后再使用语音模式。');
checkEq('voiceTryAgain', voiceErrTip.children[1].textContent, '重试');
checkEq('voiceMicErrSplit', voiceMicErrTip.children[0].textContent, '麦克风权限已被拦截，请前往 隐私设置.');

// Optional main-process verification when --dist-dir is provided (e.g. built from real ASAR)
if (distDir) {
  const updaterExpectations = blockAutoUpdate
    ? ['autoInstallOnAppQuit = false;', 'autoDownload = false;']
    : ['autoInstallOnAppQuit = electron_1.app.isPackaged;', 'autoDownload = true;'];
  const moduleAssertions = {
    'menu.js': ["'Connect to WSL': '连接到 WSL'", "'Reopen Locally': '在本地重新打开'", 'menuTranslationMap[submenuLabel]', 'translateMenu'],
    'tray.js': ['无运行中的 Agent', '打开 Antigravity', '连接到 WSL', '在本地重新打开'],
    'updater.js': [...updaterExpectations, '__agyZhApplyOnDownload', 'Starting download...', 'MenuUpdateStep["CheckForUpdates"] = "检查更新";', "message: '当前已是最新版本'"],
    'ipcHandlers.js': ['translateContextMenuLabel', 'applyHostUpdate', '删除会话', '无法打开文件夹', '文件夹位于 Windows 文件系统中', '选择下载文件夹', '打开工作区', 'zh-localization:get-meta', 'zh-localization:check-update', 'zh-localization:open-release'],
    'webauthn.js': ["title: '选择通行密钥 (Passkey)'", '请选择用于继续操作的通行密钥账户：', "buttons: [...accountLabels, '取消']"],
    'cablev2.js': ['<title>通行密钥 (Passkeys)</title>', '正在连接至您的设备…'],
    'main.js': ["showErrorBox('未找到核心程序'", "title: '未找到 WSL 发行版'", "title: '确认退出'", "buttons: ['取消', '退出']"],
    'deviceChooser.js': ["hid: 'HID 设备'", "title: '连接设备'", '请求连接到', "buttons: [...snapshot.map(({ label }) => label), '取消']"],
    'provisionSplash.js': ['正在配置 WSL：${escapeHtml(distro)}'],
    'webviewPopupSecurity.js': ["insecure: '不安全'", '您与此网站的连接不安全', "label: '连接信息…'", "title: '连接信息'", "buttons: ['确定']"],
    'wsl.js': ['此文件夹位于 Windows 文件系统中', '无法在 WSL 中打开此位置'],
    'ideInstall/wizardHtml.js': ['欢迎使用全新 Antigravity！', '下载 Antigravity IDE'],
  };
  for (const [rel, needles] of Object.entries(moduleAssertions)) {
    const full = path.join(distDir, rel);
    execFileSync('node', ['--check', full]);
    const content = fs.readFileSync(full, 'utf8');
    for (const n of needles) {
      assert(content.includes(n), `Missing expected localization in dist/${rel}: ${n}`);
    }
  }

  const menuSrc = fs.readFileSync(path.join(distDir, 'menu.js'), 'utf8');
  const menuSb = { console };
  vm.runInNewContext(menuSrc.slice(menuSrc.indexOf('function addItemToSubmenu(')), menuSb);
  const fakeMenu = {
    items: [
      { label: 'File', submenu: { items: [{ label: 'New Window' }], insert(pos, item) { this.items.splice(pos, 0, item); } } },
      { label: 'Help', submenu: { items: [{ label: 'Docs' }] } },
    ],
  };
  fakeMenu.items.forEach(menuSb.translateMenu);
  menuSb.addItemToSubmenu(fakeMenu, 'File', 1, { label: 'Connect to WSL' });
  fakeMenu.items.forEach(menuSb.translateMenu);
  assert.strictEqual(fakeMenu.items[0].label, '文件');
  assert.strictEqual(fakeMenu.items[0].submenu.items[1].label, '连接到 WSL');

  const ipcSrc = fs.readFileSync(path.join(distDir, 'ipcHandlers.js'), 'utf8');
  const dictStart = ipcSrc.indexOf('const contextMenuDict =');
  const regIdx = ipcSrc.indexOf('const SAFE_UPLOAD_CONVERSATION_ID_RE');
  const ipcSb = {};
  vm.runInNewContext(ipcSrc.slice(dictStart, regIdx), ipcSb);
  const ctxTpl = ipcSb.buildContextMenuTemplate(
    [
      { id: '1', label: 'Rename Conversation' },
      {
        id: 'copy',
        label: 'Copy',
        type: 'submenu',
        submenu: [
          { id: 'c1', label: 'Conversation Name' },
          { id: 'c2', label: 'Conversation ID' },
          { id: 'c3', label: 'Workspace Name' },
          { id: 'c4', label: 'Project Name' },
        ],
      },
      {
        id: 'split',
        label: 'Split',
        type: 'submenu',
        submenu: [
          { id: 's1', label: 'Split Right' },
          { id: 's2', label: 'Split Down' },
          { id: 's3', label: 'Replace with New' },
          { id: 's4', label: 'Remove from Split' },
        ],
      },
      { id: 'grp', label: 'Move to Group: Work' },
      { id: 'sub', label: 'Sub', type: 'submenu', submenu: [{ id: '2a', label: 'Delete Permanently' }] },
    ],
    () => {}
  );
  assert.strictEqual(ctxTpl[0].label, '重命名会话');
  assert.strictEqual(ctxTpl[1].label, '复制');
  assert.strictEqual(ctxTpl[1].submenu[0].label, '对话名称');
  assert.strictEqual(ctxTpl[1].submenu[1].label, '对话 ID');
  assert.strictEqual(ctxTpl[1].submenu[2].label, '工作区名称');
  assert.strictEqual(ctxTpl[1].submenu[3].label, '项目名称');
  assert.strictEqual(ctxTpl[2].label, '拆分');
  assert.strictEqual(ctxTpl[2].submenu[0].label, '向右拆分');
  assert.strictEqual(ctxTpl[2].submenu[1].label, '向下拆分');
  assert.strictEqual(ctxTpl[2].submenu[2].label, '替换为新对话');
  assert.strictEqual(ctxTpl[2].submenu[3].label, '从拆分视图移除');
  assert.strictEqual(ctxTpl[3].label, '移动到分组：Work');
  assert.strictEqual(ctxTpl[4].submenu[0].label, '彻底删除');
  console.log(`ALL E2E + ASAR DIST CHECKS PASSED (${assertCount} DOM assertions + 12 dist modules)!`);
} else {
  console.log(`ALL E2E CHECKS PASSED (${assertCount} DOM assertions + MutationObserver + ${dictEntries.length} dict entries)!`);
}
