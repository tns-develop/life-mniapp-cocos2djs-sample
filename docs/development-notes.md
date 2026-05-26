# docs/development-notes.md

実装の細かい話・ハマりどころ・運用メモ。`HUMAN-SETUP.md`（コンソール作業）と `README.md`（コードの動かし方）の間を埋める。

---

## 1. 「フロントとサーバーで別オリジン」問題

開発時にフロント（`http://localhost:3000`）とサーバー（`http://localhost:4000`）を別々に立てると、それぞれを ngrok で別URLに公開しないといけない。これは2つの面倒を生む。

1. ブラウザのCORSプリフライトが走る
2. LIFFがロードされるドメインと API が叩かれるドメインで Cookie ポリシーが噛み合わない
3. ngrokの無料プランは2本同時に張れない時間帯がある

**回避策（このリポジトリの推奨）**: `scripts/dev-proxy.js` を使う。

```bash
# サーバー起動
cd server && npm run dev      # http://localhost:4000

# フロント + プロキシを同時に立てる（リポジトリルートから）
node scripts/dev-proxy.js     # http://localhost:3000
#  - / -> frontend/ の静的配信
#  - /iap/*, /me -> http://localhost:4000

# ngrokは1本だけ
ngrok http 3000
```

この構成だと、フロントから見たオリジンは1つで、`/iap/reserve` も `/me` も同一オリジン扱い。

## 2. cocos2d-jsの `setOrientation` と CSS の関係

`main.js` で `cc.view.setOrientation(cc.ORIENTATION_PORTRAIT)` を指定しているが、これは**JS側でcanvasを縦向きに最適化するだけ**で、端末を横にしても物理的には横画面で表示される。LINE WebViewは強制縦固定にはできない。横向きで開かれた時のレイアウト崩れが気になる場合は、`onResize` でcanvas側を縦比に固定する処理を追加する。

PoCでは「縦持ち推奨」とアナウンスで済ませる。

## 3. iOS Safari / LINE内ブラウザの `touch-action`

`#gameCanvas { touch-action: none; }` を指定しているのは、ゲーム中のタップで画面がスクロールしないため。指定しないと、スコアタップごとに上下バウンスが発生する。

## 4. LIFF SDK のバージョン

`index.html` では `static.line-scdn.net/liff/edge/2/sdk.js`（自動更新版）を読んでいる。`liff.iap.*` は **SDK 2.26.0 以上で利用可能**。動作確認時にSDKが古い場合は、`liff.isApiAvailable("iap")` が `false` を返すので、ShopSceneのボタンが「課金は実機のみ」表示になる（PCブラウザでの誤動作も防げる）。

バージョンを固定したい場合:

```html
<script src="https://static.line-scdn.net/liff/edge/versions/2.28.0/sdk.js"></script>
```

## 5. LIFF初期化失敗時のフォールバック

`liff-bridge.js` は init失敗時にゲストモードで動作を続ける。`getUserId()` は `null` を返すので、ShopSceneの `_buy()` は `purchase()` 内のチェックで弾かれる。`isIapAvailable()` も `false` を返すように設計してある。

PCブラウザで開いたとき、コンソールには大量の警告が出るが**ゲーム部分は遊べる**。本番運用ではこの「ゲスト動作」の挙動が望ましいかは要件次第なので調整する。

## 6. localStorage と サーバー残高の整合

ShopSceneは購入Promise解決後に `_reconcileBalanceWithRetry()` で**サーバーから残高を取りにいく**。これはWebhookでの付与がDBに反映されるまでタイムラグがあるためのリトライ。

- サーバーが応答すればその値を `Store.setCoins()` で**上書き**する（クライアント表示はサーバーが真）
- サーバーが応答しない／反映されないままだとフォールバックでクライアント加算（**本番ではやらない**）

本番では「サーバーが必ず真」を貫き、付与が確認できない場合は「処理中です。しばらくしてからご確認ください」と出して残高を変更しないのが正解。

## 7. Webhookペイロード形式

LINE側のWebhookペイロードの厳密なフィールド（`status` のenum値、`type` の表記、`events` 配列で来るかどうか）は時期によって変わりうる。

`server/index.js` の `handleEvent()` は次の両方を吸収するように書いてある:

- ルートが配列 (`{events: [...]}`) でも、単一イベント (`{type, orderId, ...}`) でも対応
- ステータスは `PURCHASED` / `COMPLETED` / `SUCCESS` のいずれかなら付与

実装と公式仕様にズレを感じたら、`handleEvent` を最新仕様に合わせて修正する。サンプルは「呼び出し点と冪等性」だけが要点なので、フィールドのマッピングだけ書き換えれば動く。

## 8. cocos2d-html5の取得が失敗する場合

`scripts/download-cocos2d.sh` は GitHub の `cocos2d/cocos2d-html5` リポジトリから ZIP を落とす。次のケースで失敗する:

| 症状 | 原因 | 対策 |
| --- | --- | --- |
| `404 Not Found` | 指定 `--ref` がリポジトリに存在しない | `--ref develop` がデフォルト。タグを指定する場合は `--ref v3.17.2` 等 |
| `unzip not found` | unzip未インストール | `apt-get install unzip` 等 |
| `CCBoot.js not found` | リポジトリのレイアウトが変わった | `frontend/project.json` の `engineDir` と `frontend/index.html` の script srcを手動で合わせる |

どうしても入手できない場合は、Cocos公式の配布アーカイブ（Cocos2d-x JS版に含まれる）からも取得できる。本サンプルはGitHubが取れる前提で書いている。

## 9. 課金UIが実機で出ない

- LINEバージョンが 15.6.0 未満 → `liff.isApiAvailable("iap")` が `false`
- テスター未登録 → `createPayment` でエラー
- IAP申請が未承認 → 同上
- LIFF URLが Developing 用なのに、コンソール側のエンドポイントURLが古いまま → 「LIFF URL を開くと白画面」

`docs/development-notes.md` 全体のチェックリストとして、こうしたケースは `line-mini-app-game/05-deploy-test-checklist.md` の「よくあるハマりどころ」表も参照する。

## 10. 将来の Next.js 化

今は静的構成（案A）。Next.js（案B）に移したくなった場合:

1. `npx create-next-app` で新プロジェクトを作る
2. `frontend/lib/` と `frontend/src/`、`frontend/project.json`、`frontend/main.js` を新プロジェクトの `public/game/` に丸ごとコピー
3. クライアント専用コンポーネントで `<canvas id="gameCanvas" />` を出し、`useEffect` 内で `CCBoot.js` と `main.js` を動的注入
4. LIFF初期化は既存ガイドの `LiffProvider` に集約、`liffBridge.ready()` を `window.liff` を待つだけのラッパに変更

cocos2d-jsはSSRと相性が悪い（`window`依存）ので、必ず `"use client"` ＋動的注入を守ること。
