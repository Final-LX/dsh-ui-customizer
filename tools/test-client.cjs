// 无头测试：mock window/document/localStorage/React/计时器/FileReader/Image，
// 真实执行 client.js 的 factory + apply，渲染分区与设置行，断言主题覆盖、CSS、
// 试穿/应用/还原、皮肤、字体、圆角、上传。node tools/test-client.cjs [client.js]
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const CLIENT = process.argv[2] || path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(CLIENT, "utf8");

function assert(cond, msg) { if (!cond) throw new Error("ASSERT FAILED: " + msg); }

function makeTimerSystem() {
  let seq = 0;
  const map = new Map();
  return {
    setTimeout: (fn) => { const id = ++seq; map.set(id, fn); return id; },
    clearTimeout: (id) => { map.delete(id); },
    schedule: (fn) => { const id = ++seq; map.set(id, fn); return id; },
    flush: () => { let g = 0; while (map.size && g++ < 1000) { const fns = [...map.values()]; map.clear(); fns.forEach((f) => f()); } },
  };
}
const timer = makeTimerSystem();

let handoff = null;
const injectedStyles = [];
let injectedVideo = null;
const mockDocument = {
  querySelector: () => null,
  createElement: (tag) => {
    if (tag === "canvas") {
      return { tagName: tag, width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => "data:image/jpeg;base64,COMPRESSED" };
    }
    if (tag === "video") {
      return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null, src: "", play: () => Promise.resolve(), pause: () => {}, load: () => {}, removeAttribute: () => {} };
    }
    return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null };
  },
  head: { appendChild: (el) => injectedStyles.push(el) },
  body: { appendChild: (el) => { injectedVideo = el; } },
};

const localStorageStore = {};
const mockLocalStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(localStorageStore, k) ? localStorageStore[k] : null),
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
};

function makeReactMock() {
  let hooks = [];
  let hookIndex = 0;
  let lastCleanup = null;
  return {
    _beginRender: () => { hookIndex = 0; },
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      const idx = hookIndex++;
      if (!(idx in hooks)) hooks[idx] = (typeof initial === "function") ? initial() : initial;
      return [hooks[idx], (next) => { hooks[idx] = typeof next === "function" ? next(hooks[idx]) : next; }];
    },
    useEffect: (cb) => {
      if (lastCleanup) { const c = lastCleanup; lastCleanup = null; c(); }
      lastCleanup = cb();
    },
  };
}
const reactMock = makeReactMock();

function MockFileReader() {
  const self = this;
  self.readAsDataURL = (file) => {
    self.result = "data:image/png;base64,RAW=" + (file ? file.name : "");
    timer.schedule(() => { if (self.onload) self.onload(); });
  };
}
function MockImage() {
  const self = this;
  self.naturalWidth = 800;
  self.naturalHeight = 400;
  Object.defineProperty(self, "src", {
    set: (v) => { self._src = v; timer.schedule(() => { if (self.onload) self.onload(); }); },
    get: () => self._src,
  });
}

const sandbox = {
  window: { __ModuleLoader__: { load: (h) => (handoff = h) } },
  document: mockDocument,
  localStorage: mockLocalStorage,
  setTimeout: timer.setTimeout,
  clearTimeout: timer.clearTimeout,
  FileReader: MockFileReader,
  Image: MockImage,
  URL: { createObjectURL: (file) => "blob:mock-video-" + (file ? file.name : "") },
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

assert(handoff, "bundle 未调用 window.__ModuleLoader__.load");
assert(handoff.id === "dsh-ui-customizer", "bundle id 不一致: " + handoff.id);

const bundleExports = handoff.factory((spec) => {
  if (spec === "react") return reactMock;
  throw new Error("unexpected require: " + spec);
});
assert(bundleExports.inject.indexOf("theme") !== -1 && bundleExports.inject.indexOf("slots") !== -1, "inject 声明不正确");

const overrideCalls = [];
const slotInjects = [];
const registrations = [];
const mockCtx = {
  theme: { overrideTokens: (source, tokens) => { overrideCalls.push({ source, tokens }); return () => {}; } },
  slots: {
    inject: (name, cb) => { slotInjects.push(name); cb(); return () => {}; },
    register: (options, component) => { registrations.push({ options, component }); return () => {}; },
  },
  effect: (cb) => { cb(); return () => {}; },
};
bundleExports.apply(mockCtx);

// ---- 初始断言 ----
assert(slotInjects.indexOf("settings.section") !== -1 && slotInjects.indexOf("settings.diy.item") !== -1, "未注入分区/条目槽");
const sectionReg = registrations.find((r) => r.options.name === "settings.section");
const itemReg = registrations.find((r) => r.options.name === "settings.diy.item");
assert(sectionReg && sectionReg.options.id === "diy" && sectionReg.options.label() === "DIY 主题", "分区注册不正确");
assert(itemReg && itemReg.options.id === "diy-customizer", "条目注册不正确");

assert(overrideCalls.length === 1 && overrideCalls[0].source === "dsh-ui-customizer", "初始 token 未应用");
const tokenNames = Object.keys(overrideCalls[0].tokens);
assert(tokenNames.length >= 24, "token 数量过少: " + tokenNames.length);

const style = injectedStyles[0];
assert(style && style.dataset.plugin === "dsh-ui-customizer", "style 未注入");
assert(style.textContent.includes("background-image:url("), "缺背景图");
assert(style.textContent.includes("border-radius:10px"), "缺圆角");

// ---- 渲染 + 收集 + flush ----
const component = itemReg.component;
function collect(node, out) {
  if (!node) return out;
  if (node.type === "input") out.push({ kind: node.props.type, props: node.props });
  else if (node.type === "select") out.push({ kind: "select", props: node.props });
  else if (node.type === "button") {
    const text = Array.isArray(node.children) && node.children.length && typeof node.children[0] === "string" ? node.children[0] : "";
    out.push({ kind: "button", props: node.props, text });
  }
  if (Array.isArray(node.children)) for (const c of node.children) collect(c, out);
  return out;
}
let controls = [];
function renderAndCollect() { reactMock._beginRender(); controls = collect(component(), []); timer.flush(); }
const byType = (t) => controls.filter((x) => x.kind === t).map((x) => x.props);
const btn = (txt) => controls.find((x) => x.kind === "button" && x.text === txt);
const skinBtn = (id) => controls.find((x) => x.kind === "button" && x.props && x.props["data-skin"] === id);
const lastTokens = () => overrideCalls[overrideCalls.length - 1].tokens;
const saved = () => JSON.parse(localStorageStore["dsh-ui-customizer:config:v3"]);

renderAndCollect();
assert(byType("text").length === 2, "文本输入数量: " + byType("text").length);
assert(byType("color").length === 5, "颜色输入数量: " + byType("color").length);
assert(byType("range").length === 5, "滑杆数量: " + byType("range").length);
assert(byType("checkbox").length === 2, "复选框数量: " + byType("checkbox").length);
assert(byType("select").length === 4, "下拉框数量: " + byType("select").length);
assert(byType("file").length === 1, "文件输入数量: " + byType("file").length);
assert(btn("应用") && btn("还原") && btn("重置为默认") && btn("保存当前方案"), "缺操作按钮");
assert(!localStorageStore["dsh-ui-customizer:config:v3"], "初始不应自动持久化");

// ---- 试穿：改品牌色 → 立即生效但不持久化 ----
byType("color")[0].onChange({ target: { value: "#111111" } });
renderAndCollect();
assert(lastTokens()["--dsw-alias-brand-primary"].light === "#111111", "改品牌色未试穿生效");
assert(!localStorageStore["dsh-ui-customizer:config:v3"], "试穿阶段不应写入 localStorage");

// ---- 应用 → 持久化 ----
btn("应用").props.onClick();
renderAndCollect();
assert(saved().palette.brand === "#111111", "应用后品牌色应持久化");

// ---- 试穿：改强调色 → 生效但未持久化 ----
byType("color")[1].onChange({ target: { value: "#ff0000" } });
renderAndCollect();
assert(lastTokens()["--dsw-alias-state-business-primary"].light === "#ff0000", "改强调色未试穿生效");

// ---- 还原 → 回滚到已应用 ----
btn("还原").props.onClick();
renderAndCollect();
assert(lastTokens()["--dsw-alias-state-business-primary"].light !== "#ff0000", "还原后强调色应回滚");
assert(lastTokens()["--dsw-alias-brand-primary"].light === "#111111", "还原后品牌色应保持已应用值");

// ---- 皮肤：选深海 → 试穿 ----
skinBtn("ocean").props.onClick();
renderAndCollect();
assert(lastTokens()["--dsw-alias-state-business-primary"].light === "#14b8a6", "选皮肤未试穿");
assert(saved().palette.brand === "#111111", "试穿皮肤不应覆盖已应用配置");

// ---- 应用皮肤 ----
btn("应用").props.onClick();
renderAndCollect();
assert(saved().palette.accent === "#14b8a6", "应用皮肤后应持久化");

// ---- 字体下拉 → 试穿 + 应用 ----
byType("select")[0].onChange({ target: { value: "'Noto Sans SC', sans-serif" } });
renderAndCollect();
assert(style.textContent.includes("--dsw-font-family:'Noto Sans SC', sans-serif"), "界面字体未生效");
btn("应用").props.onClick();
renderAndCollect();
assert(saved().fontFamily === "'Noto Sans SC', sans-serif", "应用后字体未持久化");

// ---- 关壁纸 → 试穿 + 应用 ----
byType("checkbox")[1].onChange({ target: { checked: false } });
renderAndCollect();
assert(style.textContent.indexOf("background-image") === -1, "关壁纸后仍有背景图");
btn("应用").props.onClick();
renderAndCollect();
assert(saved().useWallpaper === false, "应用后未持久化壁纸开关");

// ---- 圆角 → 试穿 + 应用 ----
byType("range")[4].onChange({ target: { value: 16 } });
renderAndCollect();
assert(style.textContent.includes("border-radius:16px"), "改圆角未生效");
btn("应用").props.onClick();
renderAndCollect();
assert(saved().radius === 16, "应用后未持久化圆角");

// ---- 上传图片 → 压缩 → 试穿 + 应用 ----
byType("file")[0].onChange({ target: { files: [{ name: "photo.png" }], value: "" } });
timer.flush();
renderAndCollect();
btn("应用").props.onClick();
renderAndCollect();
assert(saved().backgroundUrl === "data:image/jpeg;base64,COMPRESSED", "上传压缩未写入");
assert(saved().useWallpaper === false, "上传后未关壁纸");

// ---- 停用 DIY 主题 → 撤销所有覆盖 ----
const overrideCountBefore = overrideCalls.length;
byType("checkbox")[0].onChange({ target: { checked: false } });
renderAndCollect();
assert(style.textContent === "", "停用后应清空 CSS");
assert(overrideCalls.length === overrideCountBefore, "停用后不应新增 token 覆盖");

// ---- 重新启用 → 恢复覆盖 ----
byType("checkbox")[0].onChange({ target: { checked: true } });
renderAndCollect();
assert(style.textContent !== "", "重新启用后应恢复 CSS");
assert(overrideCalls.length > overrideCountBefore, "重新启用后应重新应用 token");

// ---- 字号缩放 → 覆盖字体 token ----
byType("range")[1].onChange({ target: { value: 120 } });
renderAndCollect();
assert(lastTokens()["--dsw-font-base-16-font-size"].light === "19.2px", "字号缩放未应用");
assert(lastTokens()["--dsw-font-markdown-h1-font-size"].light === "28.8px", "标题字号未按比例缩放");

// ---- 阴影层级 → 覆盖阴影 token ----
byType("select")[3].onChange({ target: { value: "strong" } });
renderAndCollect();
assert(lastTokens()["--dsw-shadow-lv3"].light.indexOf("48px") !== -1, "阴影层级未应用");

// ---- 视频背景：切到视频类型 → 上传 mp4 → 视频元素生效 ----
byType("select")[2].onChange({ target: { value: "video" } });
renderAndCollect();
byType("file")[0].onChange({ target: { files: [{ name: "bg.mp4" }], value: "" } });
renderAndCollect();
assert(injectedVideo && injectedVideo.src === "blob:mock-video-bg.mp4", "视频背景未生效");
assert(injectedVideo.style.display === "block", "视频元素未显示");
assert(style.textContent.indexOf("backdrop-filter") === -1, "视频背景不应加毛玻璃模糊");

// ---- 保存方案 ----
byType("text")[1].onChange({ target: { value: "我的深夜蓝" } });
renderAndCollect();
btn("保存当前方案").props.onClick();
renderAndCollect();
const schemes = JSON.parse(localStorageStore["dsh-ui-customizer:schemes"]);
assert(schemes.length === 1 && schemes[0].name === "我的深夜蓝", "方案未保存");
assert(schemes[0].config.backgroundType === "video", "方案配置应包含视频背景");

console.log(JSON.stringify({
  ok: true,
  bundleId: handoff.id,
  inject: bundleExports.inject,
  tokenCount: tokenNames.length,
  textInputs: byType("text").length,
  colorInputs: byType("color").length,
  rangeInputs: byType("range").length,
  checkboxes: byType("checkbox").length,
  selects: byType("select").length,
  fileInputs: byType("file").length,
  tryOnWorks: true,
  applyRevertWorks: true,
  skinCenterWorks: true,
  uploadWorks: true,
  videoWorks: true,
  schemesWorks: true,
}, null, 2));
