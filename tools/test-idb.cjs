// IndexedDB 媒体存储路径测试：上传→存 Blob 到 IndexedDB、配置只存 idb: 引用、
// 刷新（重新 apply）→ 从 IndexedDB 解析回 object URL 恢复背景。
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const CLIENT = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(CLIENT, "utf8");

function assert(cond, msg) { if (!cond) throw new Error("ASSERT FAILED: " + msg); }

// 同步触发的 IndexedDB 内存 mock（回调用 setter 立即触发，promise 链靠 microtask 消化）
function makeIdb() {
  const records = new Map();
  function syncRequest(result) {
    const req = { result, error: null };
    Object.defineProperty(req, "onsuccess", { set: (fn) => { if (fn) fn(); }, get: () => null });
    Object.defineProperty(req, "onerror", { set: () => {}, get: () => null });
    return req;
  }
  function makeTx(os) {
    const tx = { objectStore: () => os, error: null };
    Object.defineProperty(tx, "oncomplete", { set: (fn) => { if (fn) fn(); }, get: () => null });
    Object.defineProperty(tx, "onerror", { set: () => {}, get: () => null });
    return tx;
  }
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    transaction: (name, mode) => makeTx({
      put: (rec) => { records.set(rec.id, rec); return syncRequest(undefined); },
      get: (key) => syncRequest(records.has(key) ? records.get(key) : undefined),
      delete: (key) => { records.delete(key); return syncRequest(undefined); }
    })
  };
  return {
    open: (name, version) => {
      const req = { result: db, error: null };
      Object.defineProperty(req, "onupgradeneeded", { set: (fn) => { if (fn) fn(); }, get: () => null });
      Object.defineProperty(req, "onsuccess", { set: (fn) => { if (fn) fn(); }, get: () => null });
      Object.defineProperty(req, "onerror", { set: () => {}, get: () => null });
      return req;
    },
    records
  };
}

function makeTimer() {
  let seq = 0;
  const map = new Map();
  return {
    setTimeout: (fn) => { const id = ++seq; map.set(id, fn); return id; },
    clearTimeout: (id) => { map.delete(id); },
    schedule: (fn) => { const id = ++seq; map.set(id, fn); return id; },
    flush: () => { let g = 0; while (map.size && g++ < 1000) { const fns = [...map.values()]; map.clear(); fns.forEach((f) => f()); } }
  };
}

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
    }
  };
}

function MockFileReader() {
  const self = this;
  self.readAsDataURL = (file) => {
    self.result = "data:image/png;base64,RAW=" + (file ? file.name : "");
    self.onload && self.onload();
  };
}
function MockImage() {
  const self = this;
  self.naturalWidth = 800;
  self.naturalHeight = 400;
  Object.defineProperty(self, "src", {
    set: (v) => { self._src = v; self.onload && self.onload(); },
    get: () => self._src
  });
}

// 一次 apply 需要的 ctx + 渲染采集
function buildSandbox(idb, lsStore) {
  const timer = makeTimer();
  let handoff = null;
  const injectedStyles = [];
  let injectedVideo = null;
  const doc = {
    querySelector: () => null,
    createElement: (tag) => {
      if (tag === "canvas") return { tagName: tag, width: 0, height: 0, getContext: () => ({ drawImage: () => {} }), toDataURL: () => "data:image/jpeg;base64,eA==" };
      if (tag === "video") return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null, src: "", play: () => Promise.resolve(), pause: () => {}, load: () => {}, removeAttribute: () => {} };
      return { tagName: tag, dataset: {}, textContent: "", style: {}, className: "", parentNode: null };
    },
    head: { appendChild: (el) => injectedStyles.push(el) },
    body: { appendChild: (el) => { injectedVideo = el; } }
  };
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: (k) => { delete lsStore[k]; }
  };
  const reactMock = makeReactMock();
  const sandbox = {
    window: { __ModuleLoader__: { load: (h) => (handoff = h) } },
    document: doc,
    localStorage,
    setTimeout: timer.setTimeout,
    clearTimeout: timer.clearTimeout,
    FileReader: MockFileReader,
    Image: MockImage,
    URL: { createObjectURL: (blob) => "blob:mock-" + (blob && (blob.name || blob._marker || "x")), revokeObjectURL: () => {} },
    indexedDB: idb,
    atob,
    Blob,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const overrideCalls = [];
  const registrations = [];
  const ctx = {
    theme: { overrideTokens: (source, tokens) => { overrideCalls.push({ source, tokens }); return () => {}; } },
    slots: {
      inject: (name, cb) => { cb(); return () => {}; },
      register: (options, component) => { registrations.push({ options, component }); return () => {}; }
    },
    effect: (cb) => { cb(); return () => {}; }
  };
  const exports = handoff.factory((spec) => { if (spec === "react") return reactMock; throw new Error("unexpected require: " + spec); });
  exports.apply(ctx);
  const itemReg = registrations.find((r) => r.options.name === "settings.diy.item");
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

  return { timer, injectedStyles, injectedVideo, reactMock, renderAndCollect, byType, btn, lsStore, ctx };
}

async function flushMicrotasks() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

async function main() {
  // ===== 阶段 1：上传图片 + 视频 → 配置存 idb: 引用，Blob 落 IndexedDB =====
  const idb = makeIdb();
  const ls1 = {};
  const s1 = buildSandbox(idb, ls1);
  s1.renderAndCollect();

  // 上传图片
  s1.byType("file")[0].onChange({ target: { files: [{ name: "photo.png" }], value: "" } });
  s1.renderAndCollect();
  s1.btn("应用").props.onClick();
  s1.renderAndCollect();
  const saved1 = JSON.parse(ls1["dsh-ui-customizer:config:v3"]);
  assert(saved1.backgroundUrl.indexOf("idb:") === 0, "图片上传后应存 idb: 引用，实际: " + saved1.backgroundUrl);

  // 上传视频（先切到视频类型）
  s1.byType("select")[3].onChange({ target: { value: "video" } });
  s1.renderAndCollect();
  s1.byType("file")[0].onChange({ target: { files: [{ name: "bg.mp4" }], value: "" } });
  s1.renderAndCollect();
  s1.btn("应用").props.onClick();
  s1.renderAndCollect();
  const saved2 = JSON.parse(ls1["dsh-ui-customizer:config:v3"]);
  assert(saved2.videoUrl.indexOf("idb:") === 0, "视频上传后应存 idb: 引用，实际: " + saved2.videoUrl);
  assert(saved2.backgroundUrl.indexOf("idb:") === 0, "图片引用应保留为 idb:");

  await flushMicrotasks();
  assert(idb.records.size >= 2, "IndexedDB 应有图片+视频两条记录，实际: " + idb.records.size);
  const kinds = [...idb.records.values()].map((r) => r.kind).sort();
  assert(kinds.indexOf("image") !== -1 && kinds.indexOf("video") !== -1, "IndexedDB 应含 image 与 video 记录");

  // ===== 阶段 2：刷新（新沙箱、同一份 IndexedDB + localStorage）→ 自动恢复 =====
  const idb2 = makeIdb();
  for (const [k, v] of idb.records) idb2.records.set(k, v); // 模拟持久化到磁盘
  const ls2 = { "dsh-ui-customizer:config:v3": ls1["dsh-ui-customizer:config:v3"] };
  const s2 = buildSandbox(idb2, ls2);
  await flushMicrotasks(); // 等 resolveMedia 完成并 re-apply

  // 视频背景应恢复（videoUrl 是 idb:vid → object URL）
  assert(s2.injectedVideo && s2.injectedVideo.src === "blob:mock-bg.mp4", "刷新后视频背景未恢复，src=" + (s2.injectedVideo && s2.injectedVideo.src));
  assert(s2.injectedVideo.style.display === "block", "刷新后视频元素应显示");

  // 图片背景应能恢复（切回 image 类型再验证）
  const idb3 = makeIdb();
  for (const [k, v] of idb.records) idb3.records.set(k, v);
  const imgCfg = JSON.parse(ls1["dsh-ui-customizer:config:v3"]);
  imgCfg.backgroundType = "image";
  imgCfg.useWallpaper = false;
  const ls3 = { "dsh-ui-customizer:config:v3": JSON.stringify(imgCfg) };
  const s3 = buildSandbox(idb3, ls3);
  await flushMicrotasks();
  assert(s3.injectedStyles[0].textContent.indexOf("background-image:url(\"blob:") !== -1, "刷新后图片背景未恢复");

  console.log(JSON.stringify({ ok: true, imageRef: true, videoRef: true, imageRestore: true, videoRestore: true, idbRecords: idb.records.size }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
