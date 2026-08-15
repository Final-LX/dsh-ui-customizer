// 无头测试：mock window/document/localStorage/React/计时器/FileReader/Image，
// 真实执行 client.js 的 factory + apply，渲染分区与设置行，断言主题覆盖、CSS、
// 模板、字体下拉、圆角、防抖、上传压缩。node tools/test-client.cjs [client.js]
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
const mockDocument = {
  querySelector: () => null,
  createElement: (tag) => {
    if (tag === "canvas") {
      return { tagName: tag, width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => "data:image/jpeg;base64,COMPRESSED" };
    }
    return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null };
  },
  head: { appendChild: (el) => injectedStyles.push(el) },
};

const localStorageStore = {};
const mockLocalStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(localStorageStore, k) ? localStorageStore[k] : null),
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; },
};

function makeReactMock() {
  let state = null;
  let lastCleanup = null;
  return {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      if (state === null) state = (typeof initial === "function") ? initial() : initial;
      return [state, (next) => { state = typeof next === "function" ? next(state) : next; }];
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
assert(tokenNames.indexOf("--dsw-alias-brand-primary") !== -1, "缺品牌 token");
assert(tokenNames.indexOf("--dsw-alias-state-business-primary") !== -1, "缺强调 token");

const style = injectedStyles[0];
assert(style && style.dataset.plugin === "dsh-ui-customizer", "style 未注入");
assert(style.textContent.includes("background-image:url("), "缺背景图");
assert(style.textContent.includes("blur(3px)"), "缺默认 blur");
assert(style.textContent.includes("border-radius:10px"), "缺圆角");
assert(style.textContent.indexOf("dsh-ripple") === -1, "应已移除波纹");
assert(style.textContent.indexOf("dshWater") === -1 && style.textContent.indexOf("dshAurora") === -1, "应已移除背景动效");

// ---- 渲染 + 收集 + flush ----
const component = itemReg.component;
function collect(node, out) {
  if (!node) return out;
  if (node.type === "input") out.push({ kind: node.props.type, props: node.props });
  else if (node.type === "select") out.push({ kind: "select", props: node.props });
  if (Array.isArray(node.children)) for (const c of node.children) collect(c, out);
  return out;
}
let controls = [];
function renderAndCollect() { controls = collect(component(), []); timer.flush(); }
const byType = (t) => controls.filter((x) => x.kind === t).map((x) => x.props);

renderAndCollect();
assert(byType("text").length === 1, "文本输入数量: " + byType("text").length);
assert(byType("color").length === 5, "颜色输入数量: " + byType("color").length);
assert(byType("range").length === 4, "滑杆数量: " + byType("range").length);
assert(byType("checkbox").length === 1, "复选框数量: " + byType("checkbox").length);
assert(byType("select").length === 3, "下拉框数量: " + byType("select").length);
assert(byType("file").length === 1, "文件输入数量: " + byType("file").length);

// ---- 改品牌色 ----
byType("color")[0].onChange({ target: { value: "#111111" } });
renderAndCollect();
assert(overrideCalls[overrideCalls.length - 1].tokens["--dsw-alias-brand-primary"].light === "#111111", "改品牌色未应用");

// ---- 改强调色 ----
byType("color")[1].onChange({ target: { value: "#ff0000" } });
renderAndCollect();
assert(overrideCalls[overrideCalls.length - 1].tokens["--dsw-alias-state-business-primary"].light === "#ff0000", "改强调色未应用");

// ---- 字体下拉 ----
byType("select")[1].onChange({ target: { value: "'Noto Sans SC', sans-serif" } });
renderAndCollect();
assert(JSON.parse(localStorageStore["dsh-ui-customizer:config:v3"]).fontFamily === "'Noto Sans SC', sans-serif", "界面字体下拉未写入");
assert(style.textContent.includes("--dsw-font-family:'Noto Sans SC', sans-serif"), "界面字体 CSS 未应用");

// ---- 关壁纸 ----
byType("checkbox")[0].onChange({ target: { checked: false } });
renderAndCollect();
assert(style.textContent.indexOf("background-image") === -1, "关壁纸后仍有背景图");

// ---- 模板：深海（ocean）----
byType("select")[0].onChange({ target: { value: "ocean" } });
renderAndCollect();
assert(overrideCalls[overrideCalls.length - 1].tokens["--dsw-alias-state-business-primary"].light === "#14b8a6", "深海模板强调色未应用");

// ---- 圆角 ----
byType("range")[3].onChange({ target: { value: 16 } });
renderAndCollect();
assert(style.textContent.includes("border-radius:16px"), "改圆角未应用");

// ---- 上传图片 ----
byType("file")[0].onChange({ target: { files: [{ name: "photo.png" }], value: "" } });
timer.flush();
renderAndCollect();
const saved = JSON.parse(localStorageStore["dsh-ui-customizer:config:v3"]);
assert(saved.backgroundUrl === "data:image/jpeg;base64,COMPRESSED", "上传压缩未写入");
assert(saved.useWallpaper === false, "上传后未关壁纸");

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
  noEffects: true,
  paletteWorks: true,
  presetsWorks: true,
  radiusWorks: true,
  uploadWorks: true,
}, null, 2));
