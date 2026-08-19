<p align="center">
  <img src="https://img.shields.io/badge/DSH-UI%20Customizer-4f46e5?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDJMMTIuNSAxMC41IDIxIDExIDIxIDEyLjUgMTIuNSAxMyAxMiAyMiAxMC41IDEzIDIgMTIuNSAyIDExIDEwLjUgMTAuNSAxMiAyWiIvPjwvc3ZnPg=="/>
  <img src="https://img.shields.io/badge/platform-web-blue?style=flat-square"/>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.md"><img src="https://img.shields.io/badge/lang-English-blue?style=flat-square"/></a>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.zh-CN.md"><img src="https://img.shields.io/badge/lang-简体中文-red?style=flat-square"/></a>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.zh-TW.md"><img src="https://img.shields.io/badge/lang-繁體中文-orange?style=flat-square"/></a>
  <a href="https://github.com/Final-LX/dsh-ui-customizer/blob/main/README.ja.md"><img src="https://img.shields.io/badge/lang-日本語-green?style=flat-square"/></a>
  <img src="https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square"/>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"/>
</p>

<p align="center">
  <strong>dsh-ui-customizer</strong> —— 為 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness（DSH）</a> Web 端提供的視覺化、零程式碼主題客製化外掛。
  在「設定 → DIY 主題」裡調整配色、字型、背景與元件樣式，改完立即可見。
</p>

---

**語言：** [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md)

---

## ✨ 功能一覽

| 分組 | 可以調什麼 | 說明 |
|---|---|---|
| **總開關** | 啟用 / 關閉 DIY 主題 | 關閉後撤銷本外掛的全部覆蓋 |
| **皮膚中心** | 8 套一鍵預設皮膚 | 選完後仍可繼續微調 |
| **配色** | 品牌、強調、成功、警告、錯誤色 | 顏色選擇器 + 十六進位 |
| **配色** | 中性色調方向 | 藍灰、冷灰、暖灰、石墨 |
| **字型** | 介面字型、程式碼字型 | 預設字型棧 |
| **字型** | 整體縮放（80–140%）、字號縮放（80–130%） | 兩個獨立控制 |
| **背景** | 圖片 URL（`http(s):` 或 `data:`） | 保存在瀏覽器本機 |
| **背景** | 面板通透度、毛玻璃強度 | 數值過高會增加 GPU/CPU 負擔 |
| **元件** | 陰影層級、圓角 | 調整層次感與圓潤度 |
| **我的方案** | 保存並切換整套主題 | 為你的設定命名後隨時取用 |

> 外掛**以可讀性為先**：環境表面（主背景、側邊欄）隨你的通透度設定變透明露出背景；覆蓋層（對話方塊、選單、輸入框、提示氣泡）則固定保持約 94% 不透明，保證彈窗內文字始終清晰。

## 🚀 快速開始

> 執行 DSH Web profile 需要 **Node.js**（含 `npx`）。最簡單的路徑不需要 git 或 pnpm。

### 方案 A：安裝腳本（只需 Node.js）

1. 從 GitHub 下載本倉庫的 **ZIP** 並解壓。
2. 在 PowerShell 中進入解壓後的目錄，執行：

   ```powershell
   .\install-web.ps1
   ```

3. 啟動網頁版：

   ```powershell
   npx @deepseek-ai/dsh web
   ```

4. 開啟瀏覽器裡的「設定 → DIY 主題」。

腳本會把外掛複製到 `~\.dsh\profiles\web\node_modules\dsh-ui-customizer`，並在 `cordis.patch.yml` 中登記 loader。腳本可重複執行。

### 方案 B：DSH 外掛命令（已安裝 git 和 pnpm）

```powershell
dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

如果命令列找不到 `dsh`：

```powershell
npx @deepseek-ai/dsh plugin --profile web add "git+https://github.com/Final-LX/dsh-ui-customizer"
```

如果你的 profile 沒有自動登記 loader，請開啟：

```text
%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml
```

確認包含：

```yaml
- insert:
    - id: ui-customizer
      name: dsh-ui-customizer
```

然後**完全退出並重新啟動** DSH Web，再重新整理頁面。

## 🖼️ 首次使用與面板操作

1. 啟動 DSH，完成內建的模型 / API key 引導。
2. 開啟右上角「設定」→「DIY 主題」。
3. 更動會**即時預覽**（試穿）。
4. 點「套用」保存，「還原」復原未保存的修改，「重設為預設」恢復原廠值。

## 🔒 資料、安全與相容性

- 主題設定和方案保存在 **`localStorage`**；如有上傳媒體則存於 **IndexedDB**。此外掛不會把主題設定上傳到 DSH 伺服端。
- 遠端圖片 URL 能否載入，取決於協定、瀏覽器安全策略及伺服器的 CORS / Referrer 回應。
- DSH 迭代很快，官方 token、slot 與頁面結構變化可能影響相容性。若升級 DSH 後某項設定失效，請執行測試並回報給作者（見故障排除）。

## ❓ 常見問題

**為什麼主題在不同瀏覽器之間不同步？**
主題資料屬於瀏覽器（localStorage/IndexedDB）。不同瀏覽器 / profile 各自保存；DSH 伺服端的會話資料由伺服端統一管理，所以可以共享。

**改了沒生效？**
需要點「套用」才保存。若點了也沒效果，多半是 DSH 版本與外掛的 token 集發生漂移——更新外掛或回報 token 缺失（見故障排除）。

**方案能分享嗎？**
目前方案保存在本機，不支援直接匯出分享；你可以記下顏色與縮放數值手動重建。

## 🛠️ 故障排除

| 症狀 | 可能原因 / 處理 |
|---|---|
| 安裝後找不到面板 | DSH 未完全重新啟動，或 `cordis.patch.yml` 缺 loader 行。編輯後重新啟動 `dsh web` 再重新整理。 |
| 主題生效但某些顏色不對 | 官方 token 跨版本變化。`npm test`（含 `tools/test-tokens.cjs`）會暴露缺失項，把列出的 token 回報給作者。 |
| 毛玻璃 / 大圖感覺卡 | 調低面板通透度 / 毛玻璃強度，或換更小的背景圖。 |
| 背景 URL 載入不出 | 檢查協定（僅 `http(s)`）以及遠端伺服器的 CORS / Referrer 策略。 |

## 👩‍💻 開發者說明

```text
dsh-ui-customizer/
├── lib/client.js                 # 瀏覽器端 classic bundle（主題邏輯 + 設定 UI）
├── lib/index.js                  # 宿主側入口（本瀏覽器端外掛為 no-op）
├── package.json                  # 外掛中繼資料 + dsh.client 設定
├── tools/                        # 測試工具
├── docs/                         # 截圖與介紹文章
├── install-web.ps1               # 只需 Node.js 的網頁端安裝腳本
└── README.md                     # 本文檔（及各語言版本）
```

執行測試：

```powershell
npm test
```

等同於執行 `test-client`、`test-render`、`test-idb` 和 `test-tokens`。最後一個需要已安裝 `@deepseek-ai/dsh`（它把外掛的白名單 token 與官方 dist CSS 對拍）；未安裝時會跳過而非失敗，所以 `npm test` 在任何環境都能跑。CI 會對 `latest` 與固定版本都執行它，及早捕捉 token 漂移。

關鍵外掛契約：

- `package.json` 必須匯出 `./package.json`，以便 DSH 讀取 `dsh.client`。
- 用戶端 bundle 以 `window.__ModuleLoader__.load({...})` 註冊。
- `dsh.client` 宣告 `platform: "web"`、`immediately: true` 及所需 `inject` 服務。

## 📄 授權

[MIT](LICENSE) —— © 2025 Final-LX。歡迎 Issue、PR 與 Star！
