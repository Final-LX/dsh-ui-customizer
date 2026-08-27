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
  <strong>dsh-ui-customizer</strong> —— <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness（DSH）</a> の Web 版向けビジュアル・ノーコードテーマカスタマイズプラグイン。
  「設定 → DIY テーマ」で配色・フォント・背景・コンポーネントのスタイルを調整でき、変更は即座に反映されます。
</p>

<p align="center">
  <img src="show01.png" alt="DSH ホーム —— テーマ適用後" width="860"/>
</p>

<p align="center">
  <img src="show02.png" alt="DIY テーマ設定パネル" width="860"/>
</p>

<p align="center">
  <a href="https://blog.lonelybear.cn/content/media/2026/08/videos-1.mp4" target="_blank" rel="noopener" title="デモ動画を再生">
    <img src="show03.png" alt="デモ動画 —— クリックして再生" width="860" style="border:1px solid #dfe3e8;border-radius:12px"/>
  </a>
</p>

> ▶️ **デモ動画：** 上のカバー画像をクリックすると、新しいタブで再生されます。

---

**言語：** [English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md)

---

## ✨ 機能一覧

| グループ | 変更できる内容 | 説明 |
|---|---|---|
| **マスタースイッチ** | DIY テーマの有効 / 無効 | オフにすると全ての上書きを解除 |
| **スキンセンター** | ワンクリックのプリセット（8 種） | 選択後もさらに微調整可能 |
| **配色** | ブランド・アクセント・成功・警告・エラー色 | カラーピッカー + 16 進数 |
| **配色** | ニュートラルトーンの方向 | ブルーグレー・クールグレー・ウォームグレー・グラファイト |
| **フォント** | UI フォント・コードフォント | プリセットのフォントスタック |
| **フォント** | 全体ズーム（80–140%）・文字スケール（80–130%） | 2 つの独立したコントロール |
| **背景** | 画像 URL（`http(s):` または `data:`） | ブラウザ内に保持 |
| **背景** | パネルの透明度・ガラスぼかし強度 | 高すぎると GPU/CPU 負荷が増加 |
| **コンポーネント** | シャドウの強さ・角丸 | 奥行きと丸みを調整 |
| **マイスキーム** | テーマ一式の保存・切替 | 設定に名前を付けて呼び出し |

> このプラグインは**可読性を優先**します：環境サーフェス（メイン背景・サイドバー）は透明度の設定に応じて透明になり背景が透けます。一方、オーバーレイ（ダイアログ・メニュー・入力欄・ツールチップ）は約 94% の不透明度を保ち、ポップアップ内の文字は常に読みやすくなります。

## 🚀 クイックスタート

> 実行には **Node.js**（`npx` 含む）が必要です。最も簡単な手順では git / pnpm は不要です。

### 方法 A：インストールスクリプト（Node.js のみ）

1. このリポジトリを **ZIP** でダウンロードして展開します。
2. PowerShell で展開先ディレクトリに入り、次を実行：

   ```powershell
   .\install-web.ps1
   ```

3. Web 版を起動：

   ```powershell
   npx @deepseek-ai/dsh web
   ```

4. ブラウザで「設定 → DIY テーマ」を開きます。

このスクリプトはプラグインを `~\.dsh\profiles\web\node_modules\dsh-ui-customizer` へコピーし、`cordis.patch.yml` に loader を登録します。再実行しても安全です。

> **「読み込めません……デジタル署名されていません / スクリプトを実行できません」と表示される？** これは PowerShell の既定の実行ポリシーが未署名スクリプトをブロックしているためです。このウィンドウ限定でポリシーを緩めてから実行してください（このウィンドウのみ有効、閉じれば元に戻り、安全です）：
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> .\install-web.ps1
> ```
> または 1 行で実行：
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\install-web.ps1
> ```

### 方法 B：DSH プラグインコマンド（標準 bundle、推奨）

> **v1.1.0** 以降、このプラグインは `dsh.bundle` を宣言した標準 bundle です：
> `dsh plugin add` が自動で `dsh.profile.bundles` に追加し、付属の loader パッチを
> 適用するため、**`cordis.patch.yml` の手動編集は不要**です。更新も同じコマンドです。

```powershell
dsh plugin --profile web add dsh-ui-customizer@latest
```

`dsh` が PATH にない場合：

```powershell
npx @deepseek-ai/dsh plugin --profile web add dsh-ui-customizer@latest
```

（npm に公開後はレジストリから直接インストールできます。git 版は
`git+https://github.com/Final-LX/dsh-ui-customizer` を指定します。）

その後、DSH Web を**完全に再起動**（`npx @deepseek-ai/dsh web`）し、ページを再読み込みします。

以後、最新版への更新：

```powershell
dsh plugin --profile web update dsh-ui-customizer@latest
```

> 注：v1.0.0 以前は classic bundle のため、`dsh plugin add` は依存のインストールのみで、
> `cordis.patch.yml` に手動で loader 行を登録する必要がありました。v1.1.0 以降は不要です。

## 🤖 AI にインストールさせる（コピー＆ペースト）

AI エージェント（DeepSeek Harness、Claude、ChatGPT など）にインストールを任せたい場合は、以下のいずれかのプロンプトをコピーして AI に送るだけです。どちらも自己完結しています。

**English prompt:**

```text
Help me install the dsh-ui-customizer theme plugin into my DeepSeek Harness (DSH) Web.
Steps:
1. Make sure I have Node.js (with npx).
2. Start DSH Web with: npx @deepseek-ai/dsh web  (this initializes the "web" profile on first run).
3. Install the plugin from npm (since v1.1.0 it is a standard bundle: dsh plugin wires it
   into dsh.profile.bundles automatically, no manual config edit needed):
   npx @deepseek-ai/dsh plugin --profile web add dsh-ui-customizer@latest
4. Fully restart DSH Web (stop and run "npx @deepseek-ai/dsh web" again), then refresh the browser.
5. Open Settings -> DIY Theme to confirm the panel appears.
If anything fails, show me the error and tell me how to fix it.
```

**中文提示詞：**

```text
幫我把 dsh-ui-customizer 主題外掛安裝到 DeepSeek Harness（DSH）Web 裡。
步驟：
1. 確認本機已裝 Node.js（含 npx）。
2. 啟動 DSH Web：npx @deepseek-ai/dsh web（首次執行會初始化 web profile）。
3. 從 npm 安裝外掛（v1.1.0 起是標準 bundle，會自動進 dsh.profile.bundles，無需手動改配置）：
   npx @deepseek-ai/dsh plugin --profile web add dsh-ui-customizer@latest
4. 完全重新啟動 DSH Web（先停掉，再跑 npx @deepseek-ai/dsh web），然後重新整理瀏覽器。
5. 開啟「設定 -> DIY 主題」確認面板出現。
如果失敗，把報錯給我看，並告訴我怎麼修。
```

## 🖼️ 初回利用とパネルの操作

1. DSH を起動し、内蔵のモデル / API キーの初期設定を完了します。
2. 右上の「設定」→「DIY テーマ」を開きます。
3. 変更は**リアルタイムでプレビュー**（試着）されます。
4. 「適用」で保存、「元に戻す」で未保存の変更を破棄、「既定にリセット」で工場出荷値へ戻します。

## 🔒 データ・セキュリティ・互換性

- テーマ設定とスキームは **`localStorage`** に保存されます。アップロードしたメディアがある場合は **IndexedDB** に保存されます。テーマ設定が DSH サーバーへ送信されることはありません。
- リモート画像 URL の読み込みは、スキーム・ブラウザのセキュリティポリシー・サーバーの CORS / Referrer 応答に依存します。
- DSH は急速に進化しており、公式トークン・スロット・ページ構造の変更が互換性に影響する場合があります。DSH をアップグレードして設定が効かなくなった場合は、テストを実行して作者に報告してください（下のトラブルシューティング参照）。

## ❓ よくある質問

**テーマがブラウザ間で同期されないのはなぜ？**
テーマデータはブラウザ側（localStorage/IndexedDB）に属します。ブラウザや profile ごとに個別に保存されます。DSH サーバー側のセッションデータはサーバーが管理するため共有されます。

**変更したのに反映されない。**
「適用」を押さないと保存されません。適用しても効果がない場合は、DSH バージョンとプラグインのトークンセットが乖離している可能性があります。プラグインを更新するか、トークンの欠落を報告してください（トラブルシューティング参照）。

**スキームを共有できますか？**
現時点ではスキームはローカル保存のみで、直接エクスポート・共有には対応していません。色とスケールの数値をメモして手動で再作成してください。

## 🛠️ トラブルシューティング

| 症状 | 考えられる原因 / 対処 |
|---|---|
| インストール後にパネルが見つからない | DSH が完全に再起動されていない。`dsh web` を再起動して再読み込み。（v1.1.0+ は標準 bundle のため、パネルが出ない場合は bundle パッチが適用されていない — `dsh.profile.bundles` に `dsh-ui-customizer` があるか確認。） |
| テーマは反映されるが一部の色がおかしい | 公式トークンがバージョン間で変化。`npm test`（`tools/test-tokens.cjs` を含む）で欠落を検出できるので、列挙されたトークンを報告。 |
| ぼかし / 大きな画像で動作が重い | パネルの透明度 / ガラス強度を下げるか、より小さい背景画像を使う。 |
| 背景 URL が読み込めない | スキーム（`http(s)` のみ）と、リモートサーバーの CORS / Referrer 設定を確認。 |

## 👩‍💻 開発者向け

```text
dsh-ui-customizer/
├── lib/client.js                 # ブラウザ側プラグイン（テーマロジック + 設定 UI）
├── lib/index.js                  # ホスト側エントリ（ブラウザ専用プラグインのため no-op）
├── cordis.patch.yml              # bundle 付属の loader パッチ（v1.1.0+、自動マウント）
├── package.json                  # プラグインメタデータ + dsh.bundle/dsh.client 設定
├── tools/                        # テスト
├── install-web.ps1               # Node.js のみで動く Web インストールスクリプト
└── README.md                     # 本ドキュメント（他言語版を含む）
```

テストを実行：

```powershell
npm test
```

これは `test-client`・`test-render`・`test-idb`・`test-tokens` を実行します。最後の 1 つは `@deepseek-ai/dsh` のインストールが必要です（プラグインのホワイトリストトークンと公式 dist CSS を照合します）。未インストールの場合は失敗せずスキップされるため、`npm test` はどの環境でも動作します。CI は `latest` と固定バージョンの両方に対して実行し、トークンの乖離を早期に検出します。

主要なプラグイン契約：

- `package.json` が `dsh.bundle.patch: "./cordis.patch.yml"` を宣言 → プラグインは**標準 bundle** になります：`dsh plugin add` が `dsh.profile.bundles` に追加し、付属の loader パッチ（`- insert: - id: ui-customizer`）を自動適用するため、profile の `cordis.patch.yml` 手動編集は不要、`dsh plugin update` で直接更新できます。
- DSH が `dsh.client` を読めるよう、`package.json` は `./package.json` をエクスポートする必要があります。
- クライアント bundle は `window.__ModuleLoader__.load({...})` で登録します。
- `dsh.client` は `platform: "web"`・`immediately: true`・必要な `inject` サービスを宣言します。

## 📄 ライセンス

[MIT](LICENSE) —— © 2025 Final-LX。Issue・PR・Star 歓迎！
