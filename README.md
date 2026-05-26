# line-miniapp-cocos2djs-sample

LINEミニアプリ × cocos2d-js × アプリ内課金（IAP）のPoCサンプル。

タイトル / メニュー / ゲーム / 課金 の4画面が動く、超シンプルな**タップでスコアが増えるゲーム**＋**コインを買うショップ**。

> 設計の詳細は外部ナレッジ `line-mini-app-game/00-overview.md` 〜 `05-deploy-test-checklist.md` を参照。本リポジトリはその実装。

---

## 何ができるか

- **タイトル画面**：タップでスタート
- **メニュー画面**：「あそぶ」「ショップ」「タイトル」、所持コイン表示
- **ゲーム画面**：画面タップでスコア+1、戻る時に最高スコア保存・少しコイン付与
- **ショップ画面**：コインパック（100 / 500 / 1200）を実機の**LINEアプリ内課金**で購入

クライアントは静的HTML+cocos2d-html5、サーバーは Node.js (Express) の最小構成。

---

## ディレクトリ構成

```
.
├─ README.md              ← 本ファイル（コードの動かし方）
├─ HUMAN-SETUP.md         ← LINE Developersコンソール側の手作業
├─ frontend/              ← cocos2d-jsゲーム本体（静的）
│   ├─ index.html
│   ├─ project.json       … cocos2d-jsのブート設定
│   ├─ main.js            … 起動スクリプト
│   ├─ src/
│   │   ├─ liff-bridge.js … LIFF初期化＋ゲームから呼ぶラッパ
│   │   ├─ Store.js       … localStorageでコイン/スコアを保持
│   │   ├─ ui.js          … 共通ボタンヘルパー
│   │   ├─ TitleScene.js
│   │   ├─ MenuScene.js
│   │   ├─ GameScene.js
│   │   └─ ShopScene.js
│   ├─ res/               … 画像など（PoCは空）
│   ├─ lib/               … cocos2d-html5本体（後述スクリプトで配置）
│   └─ package.json       … `serve` を起動するだけ
├─ server/                ← IAP用最小サーバー（購入予約 + Webhook）
│   ├─ index.js
│   ├─ package.json
│   ├─ .env.example
│   └─ README.md
├─ scripts/
│   └─ download-cocos2d.sh … cocos2d-html5本体を取得
└─ docs/
    └─ development-notes.md
```

---

## セットアップ手順

### 0. 前提

- Node.js 20+
- LINE Developersコンソールでミニアプリチャネルが作成済み（[HUMAN-SETUP.md](./HUMAN-SETUP.md) のA〜B）
- 実機テスト用LINEアカウント（バージョン15.6.0以上）

### 1. リポジトリの取得と依存インストール

```bash
git clone <this-repo-url> line-miniapp-cocos2djs-sample
cd line-miniapp-cocos2djs-sample

# cocos2d-html5本体を frontend/lib/ にダウンロード
bash scripts/download-cocos2d.sh

# フロント側依存（実体は静的サーバーだけ）
cd frontend && npm install && cd ..

# サーバー側依存
cd server && npm install && cd ..
```

### 2. LIFF IDの設定

`frontend/src/liff-bridge.js` の先頭の `LIFF_ID` を、コンソールで控えた値に書き換える。

```js
var LIFF_ID = "2000000000-XXXXXXXX"; // ← ここを開発用LIFF IDに
```

### 3. サーバーの環境変数

```bash
cd server
cp .env.example .env
# .env を開いて以下を埋める:
#   LINE_CHANNEL_SECRET=...
#   LINE_CHANNEL_ACCESS_TOKEN=...
#   PORT=4000
```

### 4. ローカル起動

ターミナル4枚使うのが楽。

```bash
# (a) フロント静的サーバー (port 3000)
cd frontend && npm run dev

# (b) IAPサーバー (port 4000)
cd server && npm run dev

# (c) フロント用 HTTPS トンネル
ngrok http 3000
# → 出てきた https://xxxx.ngrok-free.app を
#   LINE Developersコンソールの「Developing エンドポイントURL」に登録

# (d) サーバー用 HTTPS トンネル（IAP Webhook受信に必要）
ngrok http 4000
# → 出てきた https://yyyy.ngrok-free.app/iap/webhook を
#   コンソールの「アプリ内課金 → 設定 → Webhook URL」に登録
```

> フロントから `/iap/reserve` を叩く際、ngrok URLが2つあると都合が悪い。本リポジトリの開発デフォルトでは **同じオリジン** で動かす想定。手っ取り早くするには、フロント側に簡単なリバースプロキシを噛ますか、cloudflared tunnelで1ドメインに集約するのが楽。詳細は `docs/development-notes.md` の「サーバー混在オリジン問題」を参照。

### 5. 実機で開く

スマホのLINEで `https://miniapp.line.me/{LIFF_ID}` を開くと、ngrok経由でローカルのフロントが起動する。LIFFがログイン処理を済ませた後、タイトル画面が出る。

---

## 動作確認

- タイトル → タップ → メニュー
- メニュー → あそぶ → 画面タップでスコア → もどる → コイン少し増えてメニューへ
- メニュー → ショップ → 商品ボタン → 同意 → テスト決済 → コイン残高が増える
- メニュー → タイトル → タイトル

PC（外部ブラウザ）でも開発確認は可能だが、`liff.isApiAvailable("iap")` が `false` を返すため、課金ボタンは「課金は実機のみ」表示になる。

---

## 関連ドキュメント

- [HUMAN-SETUP.md](./HUMAN-SETUP.md) ― LINE Developersコンソール側の作業
- [docs/development-notes.md](./docs/development-notes.md) ― ハマりどころ・運用メモ
- [server/README.md](./server/README.md) ― サーバー側の細かい仕様
- 外部ナレッジ：`line-mini-app-game/` 配下の手順書

---

## ライセンス

PoC用途のサンプル。MITで配布想定（cocos2d-html5本体も MIT）。
