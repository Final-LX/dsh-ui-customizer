// dsh-ui-customizer — 全方面 DIY 主题插件（浏览器半）
//
// classic <script> bundle：宿主通过 /plugins/<id>/client.js 加载，必须调用
// window.__ModuleLoader__.load({...}) 注册 factory。保持外壳结构不变。
//
// 主题定制（无动效）：配色 / 字体 / 背景 / 组件圆角。
window.__ModuleLoader__.load({
  id: "dsh-ui-customizer",
  factory: function (require) {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");

    /* ============================================================
     * ① 默认配置
     * ============================================================ */
    var WALLPAPER_DATA_URI = "";

    var DEFAULTS = {
      enabled: true,   // DIY 主题总开关
      preset: "fresh",
      palette: { brand: "#4f6ef7", accent: "#8b5cf6", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" },
      fontFamily: "",
      codeFont: "",
      zoom: 100,
      fontScale: 100,     // 字号缩放 %（80-130）
      shadowLevel: "standard",  // none | light | standard | strong
      neutralTone: "blue",  // 中性色调
      useBackground: true,  // 总背景开关：false = 完全不用背景（透明/纯色）
      useWallpaper: WALLPAPER_DATA_URI !== "",
      backgroundUrl: "",
      backgroundType: "image",  // image | video
      videoUrl: "",
      glassAlpha: 0.5,
      blur: 3,
      radius: 10
    };

    var STORAGE_KEY = "dsh-ui-customizer:config:v3";
    var SOURCE = "dsh-ui-customizer";

    /* 当前 DSH 版本实际登记、可被 overrideTokens 覆盖的 token 白名单。
     * 来源：Theme.listTokens（每个值为 { light, dark }）。
     * 只覆盖这些 token：官方 token 迭代很快，越界 token 会让整层覆盖在校验时被拒/失效，
     * 所以 buildTokens 产出的对象先用 filterTokens 收敛到白名单，保证主题层永远有效。
     * 没有对应 token 的效果（强调/按钮/阴影/字号/菜单等）改由 buildCss 的 CSS 兜底。
     */
    var KNOWN_TOKENS = [
      "--dsw-alias-bg-base",
      "--dsw-alias-bg-layer-1",
      "--dsw-alias-bg-layer-2",
      "--dsw-alias-border-l1",
      "--dsw-alias-border-l2",
      "--dsw-alias-brand-primary",
      "--dsw-alias-label-primary",
      "--dsw-alias-label-secondary",
      "--dsw-alias-state-error-primary",
      "--dsw-alias-state-success-primary",
      "--dsw-alias-state-warn-primary"
    ];
    var KNOWN = {};
    KNOWN_TOKENS.forEach(function (t) { KNOWN[t] = true; });
    // 只保留白名单内的 token，防御官方 token 改名/删除导致的整层失效
    function filterTokens(tokens) {
      var out = {};
      if (!tokens || typeof tokens !== "object") return out;
      Object.keys(tokens).forEach(function (k) {
        if (KNOWN[k]) out[k] = tokens[k];
      });
      return out;
    }

    /* ============================================================
     * ② 配置读写
     * ============================================================ */
    function freshDefaults() {
      return {
        enabled: DEFAULTS.enabled,
        preset: DEFAULTS.preset,
        palette: {
          brand: DEFAULTS.palette.brand,
          accent: DEFAULTS.palette.accent,
          success: DEFAULTS.palette.success,
          warning: DEFAULTS.palette.warning,
          danger: DEFAULTS.palette.danger
        },
        fontFamily: DEFAULTS.fontFamily,
        codeFont: DEFAULTS.codeFont,
        zoom: DEFAULTS.zoom,
        fontScale: DEFAULTS.fontScale,
        shadowLevel: DEFAULTS.shadowLevel,
        neutralTone: DEFAULTS.neutralTone,
        useBackground: DEFAULTS.useBackground,
        useWallpaper: DEFAULTS.useWallpaper,
        backgroundUrl: DEFAULTS.backgroundUrl,
        backgroundType: DEFAULTS.backgroundType,
        videoUrl: DEFAULTS.videoUrl,
        glassAlpha: DEFAULTS.glassAlpha,
        blur: DEFAULTS.blur,
        radius: DEFAULTS.radius
      };
    }
    function clampConfigNumber(value, min, max, fallback) {
      return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;
    }
    function allowedConfigValue(value, allowed, fallback) {
      return allowed.indexOf(value) >= 0 ? value : fallback;
    }
    function validHex(value, fallback) {
      return typeof value === "string" && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? value : fallback;
    }
    function mergeConfig(saved) {
      var d = freshDefaults();
      if (!saved || typeof saved !== "object") return d;
      if (typeof saved.enabled === "boolean") d.enabled = saved.enabled;
      if (typeof saved.preset === "string") d.preset = saved.preset;
      if (saved.palette && typeof saved.palette === "object") {
        ["brand", "accent", "success", "warning", "danger"].forEach(function (k) {
          if (validHex(saved.palette[k], "")) d.palette[k] = saved.palette[k];
        });
      }
      if (typeof saved.fontFamily === "string") d.fontFamily = saved.fontFamily;
      if (typeof saved.codeFont === "string") d.codeFont = saved.codeFont;
      d.zoom = clampConfigNumber(saved.zoom, 80, 140, d.zoom);
      d.fontScale = clampConfigNumber(saved.fontScale, 80, 130, d.fontScale);
      d.shadowLevel = allowedConfigValue(saved.shadowLevel, ["none", "light", "standard", "strong"], d.shadowLevel);
      d.neutralTone = allowedConfigValue(saved.neutralTone, ["blue", "cool", "warm", "graphite"], d.neutralTone);
      if (typeof saved.useBackground === "boolean") d.useBackground = saved.useBackground;
      if (typeof saved.useWallpaper === "boolean") d.useWallpaper = saved.useWallpaper;
      if (typeof saved.backgroundUrl === "string") d.backgroundUrl = saved.backgroundUrl;
      d.backgroundType = allowedConfigValue(saved.backgroundType, ["image", "video"], d.backgroundType);
      if (typeof saved.videoUrl === "string") d.videoUrl = saved.videoUrl;
      d.glassAlpha = clampConfigNumber(saved.glassAlpha, 0, 1, d.glassAlpha);
      d.blur = clampConfigNumber(saved.blur, 0, 30, d.blur);
      d.radius = clampConfigNumber(saved.radius, 0, 24, d.radius);
      return d;
    }
    function loadConfig() {
      try {
        if (typeof localStorage !== "undefined") {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (raw) return mergeConfig(JSON.parse(raw));
        }
      } catch (e) {}
      return freshDefaults();
    }
    function saveConfig(cfg) {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      } catch (e) {}
    }
    var SCHEMES_KEY = "dsh-ui-customizer:schemes";
    function loadSchemes() {
      try {
        if (typeof localStorage !== "undefined") {
          var raw = localStorage.getItem(SCHEMES_KEY);
          if (raw) return JSON.parse(raw);
        }
      } catch (e) {}
      return [];
    }
    function saveSchemes(schemes) {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(SCHEMES_KEY, JSON.stringify(schemes));
      } catch (e) {}
    }

    /* ============================================================
     * ②.5 媒体存储（IndexedDB）
     * 上传的图片/视频存 Blob 到 IndexedDB，配置里只存 "idb:<id>" 引用，
     * 加载时解析回 object URL / data URI，避免撑爆 localStorage 5MB。
     * ============================================================ */
    var MEDIA_PREFIX = "idb:";
    var IDB_NAME = "dsh-ui-customizer";
    var IDB_STORE = "media";
    var mediaCache = {};   // id -> 可直接使用的 url（data URI 或 blob object URL）
    var idbPromise = null;

    function mediaId() { return "m" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }
    function isMediaRef(ref) { return typeof ref === "string" && ref.indexOf(MEDIA_PREFIX) === 0; }
    function revokeUrl(u) {
      if (u && u.indexOf("blob:") === 0 && typeof URL !== "undefined" && URL.revokeObjectURL) {
        try { URL.revokeObjectURL(u); } catch (e) {}
      }
    }
    function setMediaCache(id, url) {
      var prev = mediaCache[id];
      if (prev && prev !== url) revokeUrl(prev);
      mediaCache[id] = url;
    }
    function resolvedMediaUrl(ref) {
      if (!isMediaRef(ref)) return ref || "";
      return mediaCache[ref.slice(MEDIA_PREFIX.length)] || "";
    }

    function idbOpen() {
      if (idbPromise) return idbPromise;
      if (typeof indexedDB === "undefined") {
        idbPromise = Promise.reject(new Error("indexedDB unavailable"));
        return idbPromise;
      }
      idbPromise = new Promise(function (resolve, reject) {
        try {
          var req = indexedDB.open(IDB_NAME, 1);
          req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: "id" });
          };
          req.onsuccess = function () { resolve(req.result); };
          req.onerror = function () { reject(req.error); };
        } catch (e) { reject(e); }
      });
      return idbPromise;
    }
    function idbPut(id, blob, kind) {
      return idbOpen().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put({ id: id, blob: blob, kind: kind, updatedAt: Date.now() });
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    }
    function idbGet(id) {
      return idbOpen().then(function (db) {
        return new Promise(function (resolve, reject) {
          var req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(id);
          req.onsuccess = function () { resolve(req.result ? req.result.blob : null); };
          req.onerror = function () { reject(req.error); };
        });
      });
    }
    function idbDelete(id) {
      return idbOpen().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).delete(id);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    }
    function dataUriToBlob(dataUri) {
      try {
        var m = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUri);
        if (!m) return null;
        var mime = m[1] || "application/octet-stream";
        var body = m[3];
        if (m[2] === ";base64") {
          var bin = atob(body);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return new Blob([arr], { type: mime });
        }
        return new Blob([decodeURIComponent(body)], { type: mime });
      } catch (e) { return null; }
    }
    // 释放某媒体引用：撤销 object URL 并删除 IndexedDB 记录
    function releaseMediaRef(ref) {
      if (!isMediaRef(ref)) return;
      var id = ref.slice(MEDIA_PREFIX.length);
      var u = mediaCache[id];
      if (u !== undefined) { revokeUrl(u); delete mediaCache[id]; }
      idbDelete(id).catch(function () {});
    }
    // 确保配置引用的媒体已从 IndexedDB 载入缓存（应用方案/切换背景时用）
    function ensureConfigMedia(cfg) {
      if (!cfg) return;
      [cfg.backgroundUrl, cfg.videoUrl].forEach(function (ref) {
        if (!isMediaRef(ref)) return;
        var mid = ref.slice(MEDIA_PREFIX.length);
        if (mediaCache[mid]) return;
        idbGet(mid).then(function (blob) {
          if (blob) setMediaCache(mid, URL.createObjectURL(blob));
        }).catch(function () {});
      });
    }
    // 收集配置 + 所有命名方案里仍在引用的媒体 id
    function collectReferencedMediaIds() {
      var ids = {};
      function addRef(ref) { if (isMediaRef(ref)) ids[ref.slice(MEDIA_PREFIX.length)] = true; }
      try {
        var cfg = loadConfig();
        addRef(cfg.backgroundUrl);
        addRef(cfg.videoUrl);
      } catch (e) {}
      try {
        (loadSchemes() || []).forEach(function (s) {
          var c = s && s.config;
          if (c && typeof c === "object") {
            addRef(c.backgroundUrl);
            addRef(c.videoUrl);
          }
        });
      } catch (e) {}
      return ids;
    }
    // 视频首帧捕获：异步取一帧转 JPEG data URI 用作方案缩略图；失败回调 null
    function captureVideoFrame(url, cb) {
      var v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = url;
      var settled = false;
      function settle(dataUrl) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { v.removeAttribute("src"); v.load(); } catch (e) {}
        cb(dataUrl);
      }
      var timer = setTimeout(function () { settle(null); }, 4000);
      v.onloadeddata = function () {
        try { v.currentTime = Math.min(0.2, (v.duration || 0.2) / 2); } catch (e) {}
        v.onseeked = function () {
          try {
            var c = document.createElement("canvas");
            c.width = Math.min(v.videoWidth || 320, 640);
            c.height = Math.round(c.width * ((v.videoHeight || 180) / (v.videoWidth || 320)));
            c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
            settle(c.toDataURL("image/jpeg", 0.7));
          } catch (e) { settle(null); }
        };
      };
      v.onerror = function () { settle(null); };
      v.onabort = function () { settle(null); };
    }
    // 启动时清理孤儿 Blob：配置和方案都没引用的历史上传直接删掉
    function cleanOrphanMedia() {
      return idbOpen().then(function (db) {
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(IDB_STORE, "readonly");
          var req = tx.objectStore(IDB_STORE).getAllKeys();
          req.onsuccess = function () {
            var keys = req.result || [];
            var refs = collectReferencedMediaIds();
            var orphans = keys.filter(function (k) { return !refs[k]; });
            resolve(orphans);
          };
          req.onerror = function () { reject(req.error); };
        });
      }).then(function (orphans) {
        if (!orphans || !orphans.length) return;
        return idbOpen().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction(IDB_STORE, "readwrite");
            orphans.forEach(function (id) { tx.objectStore(IDB_STORE).delete(id); });
            tx.oncomplete = resolve;
            tx.onerror = function () { reject(tx.error); };
          });
        });
      }).catch(function () {});
    }
    // 把遗留 base64 图片迁到 IndexedDB，并解析配置里的 idb: 引用
    function resolveMedia(cfg) {
      var migrated = false;
      var jobs = [];
      if (typeof indexedDB !== "undefined" && typeof cfg.backgroundUrl === "string" && cfg.backgroundUrl.indexOf("data:image/") === 0) {
        var dataUri = cfg.backgroundUrl;
        var id = mediaId();
        var blob = dataUriToBlob(dataUri);
        setMediaCache(id, dataUri);            // 立即可用，无需等待
        cfg.backgroundUrl = MEDIA_PREFIX + id;
        migrated = true;
        if (blob) jobs.push(idbPut(id, blob, "image").catch(function () {}));
      }
      function ensure(ref) {
        if (!isMediaRef(ref)) return;
        var mid = ref.slice(MEDIA_PREFIX.length);
        if (!mediaCache[mid]) {
          jobs.push(idbGet(mid).then(function (blob) {
            if (blob) setMediaCache(mid, URL.createObjectURL(blob));
          }).catch(function () {}));
        }
      }
      ensure(cfg.backgroundUrl);
      ensure(cfg.videoUrl);
      if (!jobs.length) return Promise.resolve({ cfg: cfg, migrated: migrated });
      return Promise.all(jobs).then(function () { return { cfg: cfg, migrated: migrated }; });
    }

    function safeMediaUrl(value) {
      if (typeof value !== "string" || !value) return "";
      var valueTrimmed = value.trim();
      if (/^(https?:|blob:|data:image\/(?:jpeg|png|gif|webp);)/i.test(valueTrimmed)) return valueTrimmed;
      return "";
    }
    function cssUrl(value) {
      return String(value || "").replace(/[\\"'\r\n()]/g, function (ch) { return "\\" + ch; });
    }
    function effectiveBackground(cfg) {
      if (cfg.useBackground === false) return "";
      if (cfg.useWallpaper && WALLPAPER_DATA_URI !== "") return WALLPAPER_DATA_URI;
      if (cfg.backgroundUrl) return safeMediaUrl(resolvedMediaUrl(cfg.backgroundUrl));
      return "";
    }
    function hasVisualBackground(cfg) {
      return effectiveBackground(cfg) !== "" || cfg.backgroundType === "video";
    }

    /* ============================================================
     * ③ 工具函数
     * ============================================================ */
    function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
    function hexToRgb(hex) {
      var h = String(hex).replace("#", "");
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      if (Number.isNaN(n)) return [0, 0, 0];
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    function rgba(hex, alpha) {
      var c = hexToRgb(hex);
      return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + alpha + ")";
    }
    function shade(hex, pct) {
      var c = hexToRgb(hex);
      var t = pct < 0 ? 0 : 255;
      var amt = Math.abs(pct) / 100;
      return "rgb(" + Math.round(c[0] + (t - c[0]) * amt) + "," + Math.round(c[1] + (t - c[1]) * amt) + "," + Math.round(c[2] + (t - c[2]) * amt) + ")";
    }
    function compressImage(file, cb) {
      if (!file || typeof FileReader === "undefined" || typeof Image === "undefined" || typeof document === "undefined") { cb(null); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            var w = img.naturalWidth || img.width || 1;
            var h = img.naturalHeight || img.height || 1;
            var scale = Math.min(1, 1920 / w);
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            cb(canvas.toDataURL("image/jpeg", 0.8));
          } catch (err) { cb(null); }
        };
        img.onerror = function () { cb(null); };
        img.src = reader.result;
      };
      reader.onerror = function () { cb(null); };
      reader.readAsDataURL(file);
    }

    /* ============================================================
     * ④ 主题模板（完整配色方案）
     * ============================================================ */
    var PRESETS = [
      { id: "fresh", label: "清新 · 靛蓝", palette: { brand: "#4f6ef7", accent: "#8b5cf6", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" }, glassAlpha: 0.5, blur: 3, radius: 10 },
      { id: "ocean", label: "深海 · 青蓝", palette: { brand: "#0ea5e9", accent: "#14b8a6", success: "#10b981", warning: "#fbbf24", danger: "#f43f5e" }, glassAlpha: 0.4, blur: 4, radius: 10 },
      { id: "emerald", label: "翡翠 · 绿", palette: { brand: "#059669", accent: "#34d399", success: "#22c55e", warning: "#f59e0b", danger: "#ef4444" }, glassAlpha: 0.5, blur: 3, radius: 8 },
      { id: "rose", label: "玫瑰 · 粉", palette: { brand: "#e11d48", accent: "#fb7185", success: "#10b981", warning: "#f59e0b", danger: "#dc2626" }, glassAlpha: 0.45, blur: 6, radius: 14 },
      { id: "sunset", label: "落日 · 暖橙", palette: { brand: "#f97316", accent: "#f43f5e", success: "#10b981", warning: "#facc15", danger: "#ef4444" }, glassAlpha: 0.5, blur: 3, radius: 10 },
      { id: "violet", label: "紫罗兰", palette: { brand: "#7c3aed", accent: "#a78bfa", success: "#10b981", warning: "#f59e0b", danger: "#ef4444" }, glassAlpha: 0.5, blur: 5, radius: 12 },
      { id: "graphite", label: "石墨 · 极简", palette: { brand: "#475569", accent: "#94a3b8", success: "#16a34a", warning: "#ca8a04", danger: "#dc2626" }, glassAlpha: 0.6, blur: 2, radius: 6 },
      { id: "neon", label: "霓虹 · 夜", palette: { brand: "#d946ef", accent: "#22d3ee", success: "#4ade80", warning: "#facc15", danger: "#f87171" }, glassAlpha: 0.5, blur: 6, radius: 14 }
    ];

    // 中性色调：一套基调派生文字/边框/代码块的浅色+深色两套
    var NEUTRAL_TONES = [
      { id: "blue", label: "蓝灰（默认）", text: { light: "#1c2128", dark: "#e5e8ec" }, muted: { light: "#5c6470", dark: "#9aa3ad" }, border: { light: "#dfe3e8", dark: "#3a3f45" }, code: { light: "#f0f2f5", dark: "#1b1e22" } },
      { id: "cool", label: "冷灰", text: { light: "#1a1d21", dark: "#e8eaed" }, muted: { light: "#5f6368", dark: "#9aa0a6" }, border: { light: "#e1e3e6", dark: "#3c4043" }, code: { light: "#f1f3f4", dark: "#202124" } },
      { id: "warm", label: "暖灰", text: { light: "#1f1c18", dark: "#ece8e2" }, muted: { light: "#6b645c", dark: "#a69f96" }, border: { light: "#e8e2d9", dark: "#3f3a34" }, code: { light: "#f5f1eb", dark: "#211d19" } },
      { id: "graphite", label: "石墨", text: { light: "#0d0f12", dark: "#f0f1f3" }, muted: { light: "#454a52", dark: "#a5abb3" }, border: { light: "#d4d7db", dark: "#2b2e33" }, code: { light: "#eceff2", dark: "#141619" } }
    ];

    /* ============================================================
     * ⑤ token 覆盖 + CSS
     * ============================================================ */
    function buildTokens(cfg) {
      var TOKENS = {};
      function set(token, light, dark) { TOKENS[token] = { light: light, dark: dark }; }
      function single(token, value) { set(token, value, value); }
      var P = cfg.palette;

      // 只写入当前 DSH 实际登记（KNOWN_TOKENS）的 token；
      // 强调/按钮/阴影/字号/菜单等无对应 token 的效果放 buildCss 的 :root 兜底。
      single("--dsw-alias-brand-primary", P.brand);
      single("--dsw-alias-state-success-primary", P.success);
      single("--dsw-alias-state-warn-primary", P.warning);
      single("--dsw-alias-state-error-primary", P.danger);

      if (hasVisualBackground(cfg)) {
        var a = clamp(cfg.glassAlpha, 0, 1);
        var dk = clamp(a * 0.95, 0, 1);
        set("--dsw-alias-bg-base", rgba("#ffffff", a), rgba("#111318", dk));
        set("--dsw-alias-bg-layer-1", rgba("#ffffff", a), rgba("#111318", dk));
        set("--dsw-alias-bg-layer-2", rgba("#f5f6f8", a), rgba("#191d24", dk));
      }

      // 中性色调：文字/边框
      var nt = null;
      for (var i = 0; i < NEUTRAL_TONES.length; i++) if (NEUTRAL_TONES[i].id === cfg.neutralTone) { nt = NEUTRAL_TONES[i]; break; }
      if (nt) {
        set("--dsw-alias-label-primary", nt.text.light, nt.text.dark);
        set("--dsw-alias-label-secondary", nt.muted.light, nt.muted.dark);
        set("--dsw-alias-border-l1", rgba(nt.border.light, 0.5), rgba(nt.border.dark, 0.5));
        set("--dsw-alias-border-l2", nt.border.light, nt.border.dark);
      }

      return TOKENS;
    }

    // 圆角作用域：DSH 主要表面（对话框/菜单/列表/输入框/按钮）统一圆角。
    // 排除插件自身控件（上传区/皮肤卡/删除钮/滑杆有自己的视觉样式），避免被全局圆角误伤。
    var RADIUS_SELECTOR = "#root [role=dialog],#root [role=menu],#root [role=listbox],#root [role=tooltip],#root input[type=text],#root input[type=search],#root select,#root textarea,#root button:not([data-diy-upload]):not([data-skin]):not([data-del-scheme]):not([data-diy-range])";

    function buildCss(cfg) {
      var parts = [];
      var blur = clamp(cfg.blur, 0, 40);
      var isVideo = cfg.backgroundType === "video" && cfg.videoUrl !== "";

      // 插件自身 UI 依赖的调色自定义属性（官方 token 里没有对应的就用这里兜底），
      // 因为 buildTokens 已收敛到 KNOWN_TOKENS，这些 var() 需要在此显式声明才能保持配色一致。
      var SHADOW_CSS = {
        none: "0 0 0 0 rgba(0,0,0,0)",
        light: "0 1px 2px 0 rgba(0,0,0,.04)",
        standard: "0 2px 4px 0 rgba(0,0,0,.05)",
        strong: "0 4px 8px 0 rgba(0,0,0,.10)"
      };
      var shadowVar = SHADOW_CSS[cfg.shadowLevel] || SHADOW_CSS.standard;
      parts.push(":root{" +
        "--dsw-alias-state-business-primary:" + cfg.palette.accent + ";" +
        "--dsw-alias-state-business-tertiary:" + rgba(cfg.palette.accent, 0.14) + ";" +
        "--dsw-alias-interactive-bg-hover-accent:" + rgba(cfg.palette.accent, 0.14) + ";" +
        "--dsw-alias-button-primary-fill:" + cfg.palette.brand + ";" +
        "--dsw-alias-shadow-lv1:" + shadowVar + ";" +
        "--dsw-alias-shadow-lv2:" + shadowVar + ";" +
        "--dsw-alias-shadow-lv3:" + shadowVar + ";" +
        "--dsw-alias-bg-layer-1:" + (cfg.useBackground === false ? "#ffffff" : "rgba(255,255,255," + cfg.glassAlpha + ")") + ";" +
        "--dsw-alias-bg-layer-2:" + (cfg.useBackground === false ? "#f5f6f8" : "rgba(245,246,248," + cfg.glassAlpha + ")") + ";" +
        "--dsw-alias-bg-overlay:rgba(255,255,255,.94);" +
        "--dsw-specific-sidebar-fill:" + (cfg.useBackground === false ? "#f7f8fa" : "rgba(247,248,250," + cfg.glassAlpha + ")") + ";" +
        "--dsw-alias-border-l2:#dfe3e8;" +
        "--dsw-alias-label-primary:#1c2128;" +
        "--dsw-alias-label-secondary:#5c6470;" +
        "--dsw-alias-label-tertiary:rgba(92,100,112,.72);" +
        "--dsw-alias-state-warn-primary:" + cfg.palette.warning + ";" +
        "}");

      if (isVideo) {
        // 视频背景：由 <video> 元素渲染，html/body 都透明露出视频，不加毛玻璃（模糊视频开销大）
        parts.push("html,body{background:transparent;}");
      } else if (effectiveBackground(cfg) !== "") {
        parts.push("html{background-image:url(\"" + cssUrl(effectiveBackground(cfg)) + "\");background-size:cover;background-position:center;background-attachment:fixed;}");
        parts.push("body{background:transparent;}");
        parts.push("#root>*{-webkit-backdrop-filter:blur(" + blur + "px) saturate(140%);backdrop-filter:blur(" + blur + "px) saturate(140%);}");
      }

      if (cfg.fontFamily) parts.push(":root{--dsw-font-family:" + cfg.fontFamily + ";}");
      if (cfg.codeFont) parts.push(":root{--ds-font-family-code:" + cfg.codeFont + ";}");

      var zoom = clamp(cfg.zoom, 80, 140);
      // 整体缩放：px 硬编码的官方 UI 只能靠非标准 zoom 做整体缩放（transform:scale 不参与布局会留白，
      // rem 缩放对 px 字号无效）；现代 Chrome/Edge/Safari/Firefox 均已支持 zoom，予以保留。
      if (zoom !== 100) parts.push("#root{zoom:" + (zoom / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + ";}");

      // 字号缩放（无对应 token，用 rem/em 相对关系的 CSS 兜底；对 px 硬编码的官方样式可能不完全生效）
      var fontScale = clamp(cfg.fontScale, 80, 130);
      if (fontScale !== 100) parts.push("#root{font-size:" + fontScale + "%;}");

      var radius = clamp(cfg.radius, 0, 24);
      parts.push(RADIUS_SELECTOR + "{border-radius:" + radius + "px;}");

      // 进度条滑块：自定义轨道 + 圆点拇指 + 已填进度 + hover/聚焦反馈
      parts.push([
        "input[data-diy-range]{-webkit-appearance:none;appearance:none;background:transparent;height:22px;outline:none;}",
        "input[data-diy-range]::-webkit-slider-runnable-track{height:6px;border-radius:9999px;background:linear-gradient(to right,var(--dsw-alias-state-business-primary) var(--diy-fill,50%),var(--dsw-alias-border-l2) var(--diy-fill,50%));}",
        "input[data-diy-range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;margin-top:-5px;border-radius:50%;background:#fff;border:2px solid var(--dsw-alias-state-business-primary);box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;}",
        "input[data-diy-range]::-webkit-slider-thumb:hover{transform:scale(1.15);box-shadow:0 2px 8px rgba(0,0,0,.28);}",
        "input[data-diy-range]::-webkit-slider-thumb:active{transform:scale(1.05);}",
        "input[data-diy-range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px var(--dsw-alias-interactive-bg-hover-accent);}",
        "input[data-diy-range]::-moz-range-track{height:6px;border-radius:9999px;background:var(--dsw-alias-border-l2);}",
        "input[data-diy-range]::-moz-range-progress{height:6px;border-radius:9999px;background:var(--dsw-alias-state-business-primary);}",
        "input[data-diy-range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--dsw-alias-state-business-primary);box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;}",
        "input[data-diy-range]::-moz-range-thumb:hover{transform:scale(1.15);box-shadow:0 2px 8px rgba(0,0,0,.28);}",
        "input[data-diy-range]::-moz-range-thumb:active{transform:scale(1.05);}",
        "input[data-diy-range]:focus-visible::-moz-range-thumb{box-shadow:0 0 0 4px var(--dsw-alias-interactive-bg-hover-accent);}"
      ].join("\n"));

      // 上传按钮：悬停高亮
      parts.push([
        "label[data-diy-upload]{transition:border-color .15s ease,background .15s ease;}",
        "label[data-diy-upload]:hover{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover-accent);}",
        "label[data-diy-upload]:active{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-state-business-tertiary);}"
      ].join("\n"));

      return parts.join("\n");
    }

    /* ============================================================
     * ⑥ 样式元素 + UI 辅助
     * ============================================================ */
    var STYLE_TAG_ID = "dsh-ui-customizer/custom.css";
    var styleEl = null;
    function ensureStyleEl() {
      if (styleEl) return styleEl;
      if (typeof document === "undefined" || !document.head) return null;
      var existing = document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID) + "]");
      if (existing) { styleEl = existing; return styleEl; }
      styleEl = document.createElement("style");
      styleEl.dataset.plugin = "dsh-ui-customizer";
      styleEl.dataset.pluginCss = STYLE_TAG_ID;
      styleEl.textContent = "";
      document.head.appendChild(styleEl);
      return styleEl;
    }

    var VIDEO_TAG_ID = "dsh-ui-customizer/video";
    var videoEl = null;
    // 惰性创建：bundle 可能在 <body> 就绪前就 materialize（immediately:true），
    // 那时 document.body 还是 null；改成首次应用视频时再建，避免永久拿不到 videoEl。
    function ensureVideoEl() {
      if (videoEl) return videoEl;
      if (typeof document === "undefined" || !document.body) return null;
      var existing = document.querySelector("video[data-plugin-css=" + JSON.stringify(VIDEO_TAG_ID) + "]");
      if (existing) { videoEl = existing; return videoEl; }
      videoEl = document.createElement("video");
      videoEl.dataset.plugin = "dsh-ui-customizer";
      videoEl.dataset.pluginCss = VIDEO_TAG_ID;
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.loop = true;
      videoEl.playsInline = true;
      videoEl.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;display:none;";
      document.body.appendChild(videoEl);
      return videoEl;
    }

    var UI_FONTS = [
      { value: "", label: "系统默认" },
      { value: "'LXGW WenKai', 'Kaiti SC', 'Microsoft YaHei', serif", label: "霞鹜文楷 · 文艺" },
      { value: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif", label: "思源黑体 · 现代" },
      { value: "'Ma Shan Zheng', 'STKaiti', serif", label: "马善政 · 手写" },
      { value: "Georgia, 'Times New Roman', 'Songti SC', serif", label: "衬线 · 优雅" }
    ];
    var CODE_FONTS = [
      { value: "", label: "默认等宽" },
      { value: "'JetBrains Mono', 'Fira Code', Consolas, monospace", label: "JetBrains Mono" },
      { value: "'Fira Code', Consolas, monospace", label: "Fira Code" },
      { value: "'Cascadia Code', Consolas, monospace", label: "Cascadia Code" },
      { value: "'Source Code Pro', Consolas, monospace", label: "Source Code Pro" },
      { value: "Consolas, 'Courier New', monospace", label: "Consolas" }
    ];

    function inputStyle() {
      return { flex: "1 1 auto", minWidth: "0", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-2)", color: "var(--dsw-alias-label-primary)", fontSize: "13px", fontFamily: "inherit" };
    }
    function colorStyle() {
      return { width: "46px", height: "28px", padding: "0", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "6px", background: "var(--dsw-alias-bg-layer-2)", cursor: "pointer" };
    }
    function rangeStyle(value, min, max) {
      var pct = 0;
      if (max > min) pct = Math.round(((value - min) / (max - min)) * 100);
      return { flex: "1 1 auto", minWidth: "0", height: "22px", cursor: "pointer", "--diy-fill": pct + "%" };
    }
    function ghostBtnStyle(disabled) {
      return { padding: "5px 12px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2)", background: "transparent", color: "var(--dsw-alias-label-secondary)", fontSize: "12px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit" };
    }
    function applyBtnStyle(disabled) {
      return { padding: "5px 14px", borderRadius: "8px", border: "1px solid transparent", background: "var(--dsw-alias-button-primary-fill)", color: "#ffffff", fontSize: "12px", fontWeight: "600", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit" };
    }
    function rowLabelStyle() { return { fontSize: "13px", color: "var(--dsw-alias-label-secondary)", whiteSpace: "nowrap" }; }
    function hexStyle() { return { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)", fontFamily: "var(--ds-font-family-code)", minWidth: "68px", textAlign: "right" }; }

    function row(label, control) {
      return React.createElement("label", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
        React.createElement("span", { style: rowLabelStyle() }, label),
        control
      );
    }
    function colorRow(label, value, onChange) {
      return React.createElement("label", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" } },
        React.createElement("span", { style: rowLabelStyle() }, label),
        React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("input", { type: "color", value: value, onChange: function (e) { onChange(e.target.value); }, style: colorStyle() }),
          React.createElement("span", { style: hexStyle() }, value)
        )
      );
    }
    function rangeInput(value, min, max, step, onChange) { return React.createElement("input", { type: "range", "data-diy-range": "", min: min, max: max, step: step, value: value, onChange: function (e) { onChange(Number(e.target.value)); }, style: rangeStyle(value, min, max) }); }
    function textInput(value, placeholder, onChange) { return React.createElement("input", { type: "text", value: value, placeholder: placeholder, onChange: function (e) { onChange(e.target.value); }, style: inputStyle() }); }
    function checkInput(checked, onChange) { return React.createElement("input", { type: "checkbox", checked: checked, onChange: function (e) { onChange(e.target.checked); }, style: { width: "16px", height: "16px", accentColor: "var(--dsw-alias-state-business-primary)" } }); }
    function switchControl(checked, onChange) {
      return React.createElement("span", {
        "data-switch": "enabled",
        role: "switch",
        tabIndex: 0,
        "aria-checked": checked ? "true" : "false",
        onClick: function () { onChange(!checked); },
        onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(!checked); } },
        style: {
          position: "relative", display: "inline-block", width: "40px", height: "22px", borderRadius: "11px", flexShrink: 0,
          background: checked ? "var(--dsw-alias-state-business-primary)" : "var(--dsw-alias-border-l3)",
          cursor: "pointer", transition: "background .2s ease"
        }
      },
        React.createElement("span", {
          style: {
            position: "absolute", top: "2px", left: checked ? "20px" : "2px", width: "18px", height: "18px",
            borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .2s ease"
          }
        })
      );
    }
    function selectControl(value, options, onChange) {
      return React.createElement("select", { value: value, onChange: function (e) { onChange(e.target.value); }, style: inputStyle() },
        options.map(function (o) { return React.createElement("option", { value: o.value, key: o.value }, o.label); })
      );
    }
    function uploadControl(accept, onChange, title, hint) {
      return React.createElement("label", {
        "data-diy-upload": "",
        style: {
          display: "flex", alignItems: "center", gap: "12px", width: "100%", boxSizing: "border-box",
          padding: "12px 14px", borderRadius: "10px",
          border: "1px dashed var(--dsw-alias-border-l2)",
          background: "var(--dsw-alias-bg-layer-2)", cursor: "pointer",
          transition: "border-color .15s ease, background .15s ease"
        }
      },
        React.createElement("input", { type: "file", accept: accept, onChange: onChange, style: { display: "none" } }),
        React.createElement("span", { style: { width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--dsw-alias-interactive-bg-hover-accent)", color: "var(--dsw-alias-state-business-primary)", flexShrink: 0 } },
          React.createElement("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
            React.createElement("path", { d: "M12 16V4" }),
            React.createElement("path", { d: "M6 10l6-6 6 6" }),
            React.createElement("path", { d: "M4 20h16" })
          )
        ),
        React.createElement("span", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px", minWidth: 0 } },
          React.createElement("span", { style: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" } }, title),
          React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" } }, hint)
        )
      );
    }
    function group(title, open, rows) {
      return React.createElement("details", { open: !!open, style: { border: "1px solid var(--dsw-alias-border-l2)", borderRadius: "12px", background: "var(--dsw-alias-bg-layer-1)", padding: "0 14px", boxShadow: "var(--dsw-shadow-lv1)", overflow: "hidden" } },
        React.createElement("summary", { style: { cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)", padding: "12px 0", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", gap: "8px" } },
          React.createElement("span", { style: { width: "4px", height: "14px", borderRadius: "2px", background: "var(--dsw-alias-state-business-primary)", flexShrink: 0 } }),
          title
        ),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "12px", padding: "0 0 14px" } }, ...rows)
      );
    }
    function skinCard(skin, selected, onClick) {
      return React.createElement("button", {
        type: "button",
        key: skin.id,
        "data-skin": skin.id,
        onClick: onClick,
        style: {
          display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
          borderRadius: "8px", width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
          border: selected ? "1px solid var(--dsw-alias-state-business-primary)" : "1px solid var(--dsw-alias-border-l2)",
          background: selected ? "var(--dsw-alias-interactive-bg-hover-accent)" : "var(--dsw-alias-bg-layer-2)",
          transition: "background .15s ease"
        }
      },
        React.createElement("span", { style: { flex: "1 1 auto", fontSize: "13px", color: "var(--dsw-alias-label-primary)" } }, skin.label),
        React.createElement("span", { style: { display: "flex", gap: "4px" } },
          ["brand", "accent", "success", "warning", "danger"].map(function (k) {
            return React.createElement("span", { key: k, style: { width: "14px", height: "14px", borderRadius: "50%", background: skin.palette[k], border: "1px solid rgba(0,0,0,0.12)" } });
          })
        ),
        selected ? React.createElement("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--dsw-alias-state-business-primary)", flexShrink: 0 } }) : null
      );
    }

    /* ============================================================
     * ⑦ 插件入口
     * ============================================================ */
    var inject = ["slots", "theme"];

    function apply(ctx) {
      var tokensDisposer = null;
      function applyTokens(tokens) { tokensDisposer = ctx.theme.overrideTokens(SOURCE, filterTokens(tokens)); }
      function applyVideo(cfg) {
        var v = ensureVideoEl();
        if (!v) return;
        var raw = (cfg && cfg.useBackground !== false && cfg.backgroundType === "video") ? (cfg.videoUrl || "") : "";
        var url = safeMediaUrl(resolvedMediaUrl(raw));
        if (url) {
          v.src = url;
          v.style.display = "block";
          if (v.play) { try { v.play().catch(function () {}); } catch (e) {} }
        } else {
          v.style.display = "none";
          if (v.pause) { try { v.pause(); } catch (e) {} }
          if (v.removeAttribute) v.removeAttribute("src");
          if (v.load) { try { v.load(); } catch (e) {} }
        }
      }
      function applyConfig(cfg) {
        var css = ensureStyleEl();
        if (cfg.enabled === false) {
          if (tokensDisposer) { tokensDisposer(); tokensDisposer = null; }
          if (css) css.textContent = "";
          applyVideo(null);
          return;
        }
        if (css) css.textContent = buildCss(cfg);
        applyTokens(buildTokens(cfg));
        applyVideo(cfg);
      }

      var initial = loadConfig();
      applyConfig(initial);
      // 解析/迁移 IndexedDB 媒体引用（异步），完成后重新应用一次
      resolveMedia(initial).then(function (r) {
        if (r.migrated) saveConfig(r.cfg);
        applyConfig(r.cfg);
      }).catch(function () {});
      // 启动时清理孤儿 Blob（历史上传但已不被引用）
      cleanOrphanMedia();

      ctx.effect(function () {
        return function () {
          if (tokensDisposer) { tokensDisposer(); tokensDisposer = null; }
          if (styleEl) styleEl.textContent = "";
          if (videoEl) {
            try { videoEl.pause(); } catch (e) {}
            try { videoEl.removeAttribute("src"); videoEl.load(); } catch (e) {}
            if (videoEl.parentNode) videoEl.parentNode.removeChild(videoEl);
            videoEl = null;
          }
        };
      }, "dsh-ui-customizer: dispose");

      function DiySection(props) {
        return React.createElement("div", { style: { display: "flex", flexDirection: "column", width: "100%" } },
          props.renderSlot("settings.diy.item", {})
        );
      }

      function DiyRow() {
        var st = React.useState(function () { var c = loadConfig(); return { draft: c, applied: c }; });
        var cur = st[0];
        var setSt = st[1];
        var draft = cur.draft;
        var applied = cur.applied;
        var dirty = JSON.stringify(draft) !== JSON.stringify(applied);

        var schemeSt = React.useState(loadSchemes);
        var schemes = schemeSt[0];
        var setSchemes = schemeSt[1];
        var thumbsSt = React.useState(0);
        var thumbsTick = thumbsSt[0];
        var setThumbsTick = thumbsSt[1];
        var thumbDataSt = React.useState({});
        var thumbData = thumbDataSt[0];
        var setThumbData = thumbDataSt[1];
        var nameSt = React.useState("");
        var schemeName = nameSt[0];
        var setName = nameSt[1];

        React.useEffect(function () {
          var t = setTimeout(function () {
            ensureConfigMedia(draft);
            applyConfig(draft);
            // 应用方案/切换背景时，媒体若尚未载入缓存，加载完再应用一次
            var jobs = [];
            [draft.backgroundUrl, draft.videoUrl].forEach(function (ref) {
              if (isMediaRef(ref)) {
                var mid = ref.slice(MEDIA_PREFIX.length);
                if (!mediaCache[mid]) jobs.push(idbGet(mid).then(function (blob) {
                  if (blob) { setMediaCache(mid, URL.createObjectURL(blob)); return true; }
                  return false;
                }).catch(function () { return false; }));
              }
            });
            if (jobs.length) {
              Promise.all(jobs).then(function (results) {
                if (results.some(Boolean)) applyConfig(draft);
              });
            }
          }, 80);
          return function () { clearTimeout(t); };
        }, [draft]);

        // 方案缩略图：按方案实际背景生成（图片/壁纸直接显示，视频抓首帧）
        React.useEffect(function () {
          function setThumb(name, url) {
            setThumbData(function (prev) {
              if (prev[name] === url) return prev;
              var n = Object.assign({}, prev);
              n[name] = url;
              return n;
            });
          }
          function ensureMedia(ref, onUrl) {
            if (!isMediaRef(ref)) { onUrl(ref); return; }
            var mid = ref.slice(MEDIA_PREFIX.length);
            if (mediaCache[mid]) { onUrl(mediaCache[mid]); return; }
            idbGet(mid).then(function (blob) {
              if (blob) { setMediaCache(mid, URL.createObjectURL(blob)); onUrl(mediaCache[mid]); }
              else onUrl("");
            }).catch(function () { onUrl(""); });
          }
          (loadSchemes() || []).forEach(function (s) {
            var name = s && s.name;
            var cfg = s && s.config;
            if (!name || !cfg || typeof cfg !== "object") return;
            if (cfg.useBackground === false) { setThumb(name, ""); return; }
            if (cfg.useWallpaper && WALLPAPER_DATA_URI !== "") { setThumb(name, WALLPAPER_DATA_URI); return; }
            if (cfg.backgroundType === "video" && cfg.videoUrl) {
              ensureMedia(cfg.videoUrl, function (url) {
                if (url) captureVideoFrame(url, function (frame) { setThumb(name, frame || ""); });
                else setThumb(name, "");
              });
              return;
            }
            if (cfg.backgroundType === "image" && cfg.backgroundUrl) {
              ensureMedia(cfg.backgroundUrl, function (url) { setThumb(name, url || ""); });
              return;
            }
            setThumb(name, "");
          });
          return function () {};
        }, [schemes, thumbsTick]);

        function updateDraft(patch) { setSt({ draft: Object.assign({}, draft, patch), applied: applied }); }
        function setPalette(key, value) {
          var palette = Object.assign({}, draft.palette);
          palette[key] = value;
          updateDraft({ palette: palette });
        }
        function applySkin(id) {
          for (var i = 0; i < PRESETS.length; i++) {
            if (PRESETS[i].id === id) {
              var p = PRESETS[i];
              updateDraft({
                preset: p.id,
                palette: Object.assign({}, p.palette),
                glassAlpha: p.glassAlpha,
                blur: p.blur,
                radius: p.radius
              });
              return;
            }
          }
        }
        function commit() {
          setSt({ draft: draft, applied: draft });
          saveConfig(draft);
          cleanOrphanMedia();
        }
        function revert() { setSt({ draft: applied, applied: applied }); }
        function resetDefaults() {
          setSt({ draft: freshDefaults(), applied: applied });
        }
        function handleUpload(e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          compressImage(file, function (dataUri) {
            if (!dataUri) return;
            if (typeof indexedDB !== "undefined") {
              var id = mediaId();
              var blob = dataUriToBlob(dataUri);
              setMediaCache(id, dataUri);                       // 立即预览
              if (blob) idbPut(id, blob, "image").catch(function () {});
              updateDraft({ backgroundUrl: MEDIA_PREFIX + id, useWallpaper: false, backgroundType: "image" });
            } else {
              updateDraft({ backgroundUrl: dataUri, useWallpaper: false, backgroundType: "image" });
            }
          });
          e.target.value = "";
        }
        function handleVideoUpload(e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          if (typeof indexedDB !== "undefined") {
            var id = mediaId();
            var url = "";
            if (typeof URL !== "undefined" && URL.createObjectURL) { try { url = URL.createObjectURL(file); } catch (err) { url = ""; } }
            setMediaCache(id, url);
            idbPut(id, file, "video").catch(function () {});
            updateDraft({ videoUrl: MEDIA_PREFIX + id, backgroundType: "video" });
          } else {
            var url2 = "";
            if (typeof URL !== "undefined" && URL.createObjectURL) { try { url2 = URL.createObjectURL(file); } catch (err) { url2 = ""; } }
            if (!url2 && typeof FileReader !== "undefined") { var r = new FileReader(); r.onload = function () { if (r.result) updateDraft({ videoUrl: r.result, backgroundType: "video" }); }; r.readAsDataURL(file); return; }
            if (url2) updateDraft({ videoUrl: url2, backgroundType: "video" });
          }
          e.target.value = "";
        }
        function saveScheme() {
          var name = String(schemeName || "").trim();
          if (!name) return;
          var list = loadSchemes().filter(function (s) { return s.name !== name; });
          list.push({ schemaVersion: 1, name: name.slice(0, 80), updatedAt: Date.now(), config: mergeConfig(draft) });
          saveSchemes(list);
          setSchemes(list);
          setName("");
        }
        function applyScheme(config) {
          setSt({ draft: mergeConfig(config), applied: applied });
        }
        function deleteScheme(name) {
          var list = loadSchemes().filter(function (s) { return s.name !== name; });
          saveSchemes(list);
          setSchemes(list);
        }
        function clearUploadedMedia() {
          updateDraft({ backgroundUrl: "", videoUrl: "", useWallpaper: false, useBackground: true });
        }

        var P = draft.palette;
        return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px", padding: "16px 0" } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            React.createElement("span", { style: { display: "flex", alignItems: "center", gap: "8px" } },
              React.createElement("span", { style: { fontSize: "15px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" } }, "DIY 主题"),
              dirty ? React.createElement("span", { style: { fontSize: "11px", color: "var(--dsw-alias-state-warn-primary)", padding: "1px 6px", borderRadius: "10px", border: "1px solid currentColor" } }, "未保存") : null
            ),
            React.createElement("span", { style: { display: "flex", gap: "6px" } },
              React.createElement("button", { type: "button", disabled: !dirty, onClick: revert, style: ghostBtnStyle(!dirty) }, "还原"),
              React.createElement("button", { type: "button", disabled: !dirty, onClick: commit, style: applyBtnStyle(!dirty) }, "应用")
            )
          ),
          React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l2)", background: draft.enabled ? "var(--dsw-alias-bg-layer-1)" : "transparent", boxShadow: "var(--dsw-shadow-lv1)" } },
            React.createElement("span", { style: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" } }, "启用 DIY 主题"),
            switchControl(draft.enabled, function (v) { updateDraft({ enabled: v }); })
          ),
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px", opacity: draft.enabled ? 1 : 0.45, pointerEvents: draft.enabled ? "auto" : "none" } },
            group("皮肤中心", true, [
              React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                ...PRESETS.map(function (s) {
                  return skinCard(s, s.id === draft.preset, function () { applySkin(s.id); });
                })
              ),
              React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)", lineHeight: "18px" } }, "点选即试穿，满意后点右上角「应用」保存；「还原」撤销未保存的更改。")
            ]),
            group("配色", true, [
              colorRow("品牌主色", P.brand, function (v) { setPalette("brand", v); }),
              colorRow("强调色", P.accent, function (v) { setPalette("accent", v); }),
              colorRow("成功色", P.success, function (v) { setPalette("success", v); }),
              colorRow("警告色", P.warning, function (v) { setPalette("warning", v); }),
              colorRow("错误色", P.danger, function (v) { setPalette("danger", v); }),
              row("中性色调", selectControl(draft.neutralTone, NEUTRAL_TONES.map(function (t) { return { value: t.id, label: t.label }; }), function (v) { updateDraft({ neutralTone: v }); }))
            ]),
            group("字体", false, [
              row("界面字体", selectControl(draft.fontFamily, UI_FONTS, function (v) { updateDraft({ fontFamily: v }); })),
              row("代码字体", selectControl(draft.codeFont, CODE_FONTS, function (v) { updateDraft({ codeFont: v }); })),
              row("整体缩放 " + draft.zoom + "%", rangeInput(draft.zoom, 80, 140, 1, function (v) { updateDraft({ zoom: v }); })),
              row("字号缩放 " + draft.fontScale + "%", rangeInput(draft.fontScale, 80, 130, 1, function (v) { updateDraft({ fontScale: v }); }))
            ]),
            group("背景", true, [
              row("使用背景", switchControl(draft.useBackground !== false, function (v) { updateDraft({ useBackground: v }); })),
              draft.useBackground === false ? React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)", lineHeight: "18px" } }, "已关闭背景，界面使用主题默认底色。") : null,
              draft.useBackground !== false ? row("背景类型", selectControl(draft.backgroundType, [{ value: "image", label: "图片" }, { value: "video", label: "视频" }], function (v) { updateDraft({ backgroundType: v }); })) : null,
              draft.useBackground !== false && draft.backgroundType === "image" ? WALLPAPER_DATA_URI !== "" ? row("使用内置壁纸", checkInput(draft.useWallpaper, function (v) { updateDraft({ useWallpaper: v }); })) : null : null,
              draft.useBackground !== false && draft.backgroundType === "image" ? uploadControl("image/*", handleUpload, "上传背景图", "PNG 或 JPG，自动压缩到 1920px") : null,
              draft.useBackground !== false && draft.backgroundType === "image" ? row("背景 URL", textInput(draft.backgroundUrl, "https://… 或 data:image/…", function (v) { updateDraft({ backgroundUrl: v }); })) : null,
              draft.useBackground !== false && draft.backgroundType === "video" ? uploadControl("video/*", handleVideoUpload, "上传视频", "MP4，本地预览") : null,
              draft.useBackground !== false && draft.backgroundType === "video" ? row("视频 URL", textInput(draft.videoUrl, "https://…mp4", function (v) { updateDraft({ videoUrl: v }); })) : null,
              draft.useBackground !== false ? row("面板通透度 " + Math.round(draft.glassAlpha * 100) + "%", rangeInput(Math.round(draft.glassAlpha * 100), 0, 100, 1, function (v) { updateDraft({ glassAlpha: v / 100 }); })) : null,
              draft.useBackground !== false && draft.backgroundType === "image" ? row("毛玻璃强度 " + draft.blur + "px", rangeInput(draft.blur, 0, 30, 1, function (v) { updateDraft({ blur: v }); })) : null,
              (isMediaRef(draft.backgroundUrl) || isMediaRef(draft.videoUrl)) ? React.createElement("button", { type: "button", onClick: clearUploadedMedia, style: ghostBtnStyle(false) }, "清除已上传媒体") : null
            ]),
            group("我的方案", false, [
              React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "stretch" } },
                React.createElement("input", { type: "text", value: schemeName, placeholder: "方案名称，如「深夜蓝」", onChange: function (e) { setName(e.target.value); }, style: Object.assign({}, inputStyle(), { flex: "1 1 auto", minWidth: "0" }) }),
                React.createElement("button", { type: "button", onClick: saveScheme, title: "把当前设置保存为命名方案", style: { padding: "0 18px", borderRadius: "10px", border: "1px solid transparent", background: "var(--dsw-alias-button-primary-fill)", color: "#ffffff", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" } }, "保存方案")
              ),
              schemes.length > 0 ? React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
                schemes.map(function (sc) {
                  var cfg2 = sc.config || {};
                  var noBg = cfg2.useBackground === false;
                  var isVid = !noBg && cfg2.backgroundType === "video";
                  var thumb = thumbData[sc.name] || "";
                  var phText = noBg ? "无背景" : (isVid && !thumb ? "视频" : "");
                  return React.createElement("div", { key: sc.name, "data-scheme": sc.name, onClick: function () { applyScheme(sc.config); }, style: { cursor: "pointer", borderRadius: "10px", border: "1px solid var(--dsw-alias-border-l2)", overflow: "hidden", background: "var(--dsw-alias-bg-layer-2)", transition: "border-color .15s ease" } },
                    React.createElement("div", { style: { height: "54px", background: thumb ? "url(" + thumb + ") center/cover no-repeat" : "linear-gradient(135deg, var(--dsw-alias-bg-layer-3), var(--dsw-alias-bg-layer-1))", position: "relative" } },
                      thumb ? null : React.createElement("span", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "var(--dsw-alias-label-tertiary)" } }, phText)
                    ),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", padding: "7px 9px" } },
                      React.createElement("span", { style: { fontSize: "12px", fontWeight: "600", color: "var(--dsw-alias-label-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 } }, sc.name),
                      React.createElement("button", { type: "button", "data-del-scheme": sc.name, onClick: function (e) { e.stopPropagation(); deleteScheme(sc.name); }, style: { background: "transparent", border: "none", cursor: "pointer", color: "var(--dsw-alias-label-tertiary)", fontSize: "11px", fontFamily: "inherit", flexShrink: 0 } }, "删除")
                    )
                  );
                })
              ) : null,
              schemes.length > 0 ? React.createElement("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)", lineHeight: "18px" } }, "点击卡片应用方案；删除方案会在下次启动自动清理其不再引用的图片 / 视频。") : null
            ]),
            group("组件", false, [
              row("阴影", selectControl(draft.shadowLevel, [{ value: "none", label: "无" }, { value: "light", label: "轻" }, { value: "standard", label: "标准" }, { value: "strong", label: "强" }], function (v) { updateDraft({ shadowLevel: v }); })),
              row("圆角 " + draft.radius + "px", rangeInput(draft.radius, 0, 24, 1, function (v) { updateDraft({ radius: v }); }))
            ]),
            React.createElement("button", { type: "button", onClick: resetDefaults, style: ghostBtnStyle(false) }, "重置为默认")
          )
        );
      }

      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "diy",
          order: 20,
          label: function () { return "DIY 主题"; },
          children: { "settings.diy.item": { kind: "list", scope: "root" } }
        }, DiySection);
      });

      ctx.slots.inject("settings.diy.item", function () {
        return ctx.slots.register({ name: "settings.diy.item", id: "diy-customizer", order: 0 }, DiyRow);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
