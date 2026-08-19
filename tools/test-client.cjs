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
  let cleanups = [];
  return {
    _beginRender: () => { hookIndex = 0; },
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => {
      const idx = hookIndex++;
      if (!(idx in hooks)) hooks[idx] = (typeof initial === "function") ? initial() : initial;
      return [hooks[idx], (next) => { hooks[idx] = typeof next === "function" ? next(hooks[idx]) : next; }];
    },
    useEffect: (cb) => {
      const idx = hookIndex++;
      if (cleanups[idx]) { const c = cleanups[idx]; delete cleanups[idx]; c(); }
      cleanups[idx] = cb();
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
// buildTokens 现在只输出白名单（KNOWN_TOKENS）内的合法 token
assert(tokenNames.length >= 8, "token 数量过少: " + tokenNames.length);
assert(tokenNames.indexOf("--dsw-alias-brand-primary") !== -1, "应覆盖品牌令牌");
assert(tokenNames.indexOf("--dsw-alias-state-business-primary") === -1, "越界令牌不应写入 overrideTokens");

const style = injectedStyles[0];
assert(style && style.dataset.plugin === "dsh-ui-customizer", "style 未注入");
// 内嵌壁纸已移除，默认不应有 background-image，直到设置了背景 URL / 上传
assert(!style.textContent.includes("background-image:url("), "默认不应有背景图（内置壁纸已移除）");
assert(style.textContent.includes("border-radius:10px"), "缺圆角");
assert(style.textContent.includes("data-diy-range"), "缺自定义滑块样式");
assert(style.textContent.includes("-webkit-slider-thumb"), "缺滑块拇指样式");
assert(style.textContent.includes("label[data-diy-upload]:hover"), "缺上传控件悬停样式");

// ---- 渲染 + 收集 + flush ----
const component = itemReg.component;
function collect(node, out) {
  if (!node) return out;
  if (node.type === "input") out.push({ kind: node.props.type, props: node.props });
  else if (node.type === "select") out.push({ kind: "select", props: node.props });
  else if (node.type === "span" && node.props && node.props["data-switch"]) out.push({ kind: "switch", props: node.props });
  else if (node.type === "label" && node.props && node.props["data-diy-upload"] === "") out.push({ kind: "upload", props: node.props });
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
assert(byType("checkbox").length === 0, "内置壁纸已移除，应无复选框: " + byType("checkbox").length);
assert(byType("select").length === 5, "下拉框数量: " + byType("select").length);
assert(byType("switch").length === 2, "开关数量: " + byType("switch").length);
assert(byType("switch").every((p) => p.role === "switch" && p.tabIndex === 0 && p["aria-checked"]), "开关缺少可访问性属性");
assert(byType("file").length === 1, "文件输入数量: " + byType("file").length);
assert(btn("应用") && btn("还原") && btn("重置为默认") && btn("保存方案"), "缺操作按钮");
assert(!localStorageStore["dsh-ui-customizer:config:v3"], "初始不应自动持久化");

// ---- 滑块：带 data 属性 + 填充进度 ----
const range0 = byType("range")[0];
assert(range0["data-diy-range"] === "" && typeof range0.style["--diy-fill"] === "string", "滑块缺少 data 属性或填充进度");
assert(byType("upload").length === 1, "上传控件数量: " + byType("upload").length);

// ---- 试穿：改品牌色 → 立即生效但不持久化 ----
byType("color")[0].onChange({ target: { value: "#111111" } });
renderAndCollect();
assert(lastTokens()["--dsw-alias-brand-primary"].light === "#111111", "改品牌色未试穿生效");
assert(!localStorageStore["dsh-ui-customizer:config:v3"], "试穿阶段不应写入 localStorage");

// ---- 应用 → 持久化 ----
btn("应用").props.onClick();
renderAndCollect();
assert(saved().palette.brand === "#111111", "应用后品牌色应持久化");

// ---- 试穿：改强调色 → 生效但未持久化（强调色走 CSS :root 兜底）----
byType("color")[1].onChange({ target: { value: "#ff0000" } });
renderAndCollect();
assert(style.textContent.includes("--dsw-alias-state-business-primary:#ff0000"), "改强调色未试穿生效");

// ---- 还原 → 回滚到已应用 ----
btn("还原").props.onClick();
renderAndCollect();
assert(style.textContent.includes("--dsw-alias-state-business-primary:#8b5cf6"), "还原后强调色应回滚到已应用值");
assert(lastTokens()["--dsw-alias-brand-primary"].light === "#111111", "还原后品牌色应保持已应用值");

// ---- 皮肤：选深海 → 试穿 ----
skinBtn("ocean").props.onClick();
renderAndCollect();
assert(style.textContent.includes("--dsw-alias-state-business-primary:#14b8a6"), "选皮肤未试穿");
assert(saved().palette.brand === "#111111", "试穿皮肤不应覆盖已应用配置");

// ---- 应用皮肤 ----
btn("应用").props.onClick();
renderAndCollect();
assert(saved().palette.accent === "#14b8a6", "应用皮肤后应持久化");

// ---- 字体下拉 → 试穿 + 应用 ----
byType("select")[1].onChange({ target: { value: "'Noto Sans SC', sans-serif" } });
renderAndCollect();
assert(style.textContent.includes("--dsw-font-family:'Noto Sans SC', sans-serif"), "界面字体未生效");
btn("应用").props.onClick();
renderAndCollect();
assert(saved().fontFamily === "'Noto Sans SC', sans-serif", "应用后字体未持久化");

// ---- 背景 URL → 试穿 + 应用（内置壁纸移除后，背景走 URL 路径）----
byType("text")[0].onChange({ target: { value: "https://example.com/bg.jpg" } });
renderAndCollect();
assert(style.textContent.includes("background-image:url(\"https://example.com/bg.jpg\")"), "背景 URL 未生效");
btn("应用").props.onClick();
renderAndCollect();
assert(saved().backgroundUrl === "https://example.com/bg.jpg", "应用后背景 URL 未持久化");

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
byType("switch")[0].onClick();
renderAndCollect();
assert(style.textContent === "", "停用后应清空 CSS");
assert(overrideCalls.length === overrideCountBefore, "停用后不应新增 token 覆盖");

// ---- 重新启用 → 恢复覆盖 ----
byType("switch")[0].onClick();
renderAndCollect();
assert(style.textContent !== "", "重新启用后应恢复 CSS");
assert(overrideCalls.length > overrideCountBefore, "重新启用后应重新应用 token");

// ---- 字号缩放 → CSS 兜底（#root font-size）----
byType("range")[1].onChange({ target: { value: 120 } });
renderAndCollect();
assert(style.textContent.includes("#root{font-size:120%;}"), "字号缩放未应用 CSS 兜底");

// ---- 阴影层级 → CSS :root 兜底 ----
byType("select")[4].onChange({ target: { value: "strong" } });
renderAndCollect();
assert(style.textContent.includes("--dsw-alias-shadow-lv3:0 4px 8px 0 rgba(0,0,0,.10)"), "阴影层级未应用 CSS 兜底");

// ---- 中性色调 → 覆盖文字/边框 token ----
byType("select")[0].onChange({ target: { value: "graphite" } });
renderAndCollect();
assert(lastTokens()["--dsw-alias-label-primary"].light === "#0d0f12", "中性色调未应用到主文字");
assert(lastTokens()["--dsw-alias-border-l2"].dark === "#2b2e33", "中性色调未应用到边框");
assert(lastTokens()["--dsw-alias-markdown-code-block"] === undefined, "已移除的 markdown token 不应写入覆盖层");

// ---- 视频背景：切到视频类型 → 上传 mp4 → 视频元素生效 ----
byType("select")[3].onChange({ target: { value: "video" } });
renderAndCollect();
byType("file")[0].onChange({ target: { files: [{ name: "bg.mp4" }], value: "" } });
renderAndCollect();
assert(injectedVideo && injectedVideo.src === "blob:mock-video-bg.mp4", "视频背景未生效");
assert(injectedVideo.style.display === "block", "视频元素未显示");
assert(style.textContent.indexOf("backdrop-filter") === -1, "视频背景不应加毛玻璃模糊");
assert(style.textContent.includes("html,body{background:transparent;}"), "视频背景应让 html/body 透明");

// ---- 保存方案 ----
byType("text")[1].onChange({ target: { value: "我的深夜蓝" } });
renderAndCollect();
btn("保存方案").props.onClick();
renderAndCollect();
const schemes = JSON.parse(localStorageStore["dsh-ui-customizer:schemes"]);
assert(schemes.length === 1 && schemes[0].name === "我的深夜蓝", "方案未保存");
assert(schemes[0].config.backgroundType === "video", "方案配置应包含视频背景");

// ---- 惰性视频元素：bundle 在 body 为 null 时 materialize，视频延迟到 body 就绪后再建 ----
(function () {
  let handoff2 = null;
  let injectedVideo2 = null;
  let bodyObj = null;
  const doc2 = {
    querySelector: () => null,
    createElement: (tag) => {
      if (tag === "video") return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null, src: "", play: () => Promise.resolve(), pause: () => {}, load: () => {}, removeAttribute: () => {} };
      return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null };
    },
    head: { appendChild: () => {} },
    body: null
  };
  Object.defineProperty(doc2, "body", { get: () => bodyObj });
  const store2 = {};
  const ls2 = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store2, k) ? store2[k] : null),
    setItem: (k, v) => { store2[k] = String(v); },
    removeItem: (k) => { delete store2[k]; }
  };
  store2["dsh-ui-customizer:config:v3"] = JSON.stringify({ enabled: true, preset: "fresh", palette: { brand: "#4f6ef7", accent: "#8b5cf6", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" }, fontFamily: "", codeFont: "", zoom: 100, fontScale: 100, shadowLevel: "standard", neutralTone: "blue", useWallpaper: false, backgroundUrl: "", backgroundType: "video", videoUrl: "blob:lazy", glassAlpha: 0.85, blur: 0, radius: 10 });

  const sandbox2 = { window: { __ModuleLoader__: { load: (h) => (handoff2 = h) } }, document: doc2, localStorage: ls2, setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout, FileReader: MockFileReader, Image: MockImage, URL: { createObjectURL: (f) => "blob:mock-" + (f ? f.name : "") }, console };
  vm.createContext(sandbox2);
  vm.runInContext(src, sandbox2);
  const exp2 = handoff2.factory((spec) => { if (spec === "react") return reactMock; throw new Error("unexpected require: " + spec); });
  const ctx2 = {
    theme: { overrideTokens: () => () => {} },
    slots: { inject: () => () => {}, register: () => () => {} },
    effect: (cb) => { cb(); return () => {}; }
  };
  exp2.apply(ctx2); // body 仍为 null
  assert(injectedVideo2 === null, "body 为 null 时不应创建视频元素（应延迟到 body 就绪）");
  bodyObj = { appendChild: (el) => { injectedVideo2 = el; } };
  exp2.apply(ctx2); // body 就绪后再次应用 → 惰性创建
  assert(injectedVideo2 !== null && injectedVideo2.src === "blob:lazy", "body 就绪后应惰性创建视频元素并播放");
})();

console.log(JSON.stringify({
  ok: true,
  bundleId: handoff.id,
  inject: bundleExports.inject,
  tokenCount: tokenNames.length,
  textInputs: byType("text").length,
  colorInputs: byType("color").length,
  rangeInputs: byType("range").length,
  checkboxes: byType("checkbox").length,
  switches: byType("switch").length,
  selects: byType("select").length,
  fileInputs: byType("file").length,
  tryOnWorks: true,
  applyRevertWorks: true,
  skinCenterWorks: true,
  uploadWorks: true,
  videoWorks: true,
  schemesWorks: true,
}, null, 2));
