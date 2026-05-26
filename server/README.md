# server/

LINEミニアプリ アプリ内課金（IAP）用の最小サーバー。

## 役割

- **`POST /iap/reserve`** ― クライアントから productId と userId を受け取り、LINEの購入予約API（または現状はモック）で `orderId` を発行して返す。`liff.iap.createPayment` の前に必須。
- **`POST /iap/webhook`** ― LINEから購入完了通知を受け取るエンドポイント。`x-line-signature` をチャネルシークレットで HMAC-SHA256 検証し、`orderId` ベースで冪等にコインを付与する。
- **`GET /me?userId=...`** ― ユーザーの現在のコイン残高を返す。クライアントの ShopScene / MenuScene から購入完了の同期に使う。
- **`GET /healthz`** ― ヘルスチェック＆環境変数の設定状況を返す。

データは**メモリ（Map / Set）**に保持しており、再起動で全消える。本番では `database/` ナレッジの設計（SQLite / PostgreSQL / DynamoDB 等）に置き換える。

## 起動

```bash
cp .env.example .env
# .env を埋める

npm install
npm run dev
# → http://localhost:4000/healthz が叩ける
```

## 環境変数

| 変数 | 説明 |
| --- | --- |
| `LINE_CHANNEL_SECRET` | Webhookの署名検証に使う。**未設定だと /iap/webhook は 500 を返す**（誤って本物の通知を受け付けないため） |
| `LINE_CHANNEL_ACCESS_TOKEN` | 購入予約API呼び出しの認証に使う |
| `LINE_PURCHASE_RESERVE_URL` | 購入予約APIのエンドポイント。**未設定だとモック動作**（ローカルでUUIDを生成して返す） |
| `PORT` | デフォルト 4000 |

## 購入予約APIのモック動作について

LINEの「購入予約API」の正確なエンドポイント・リクエスト形は、各プロジェクト着手時点の[公式ドキュメント](https://developers.line.biz/ja/docs/line-mini-app/in-app-purchase/)で要確認。本サンプルは `reserveOnLine()` 内で呼ぶ形に抽象化してあり、`LINE_PURCHASE_RESERVE_URL` が空のときは `mock-<UUID>` 形式の orderId を返す。

**モックモードでも `liff.iap.createPayment` 側でエラーになる可能性がある**（コンソール登録のないorderIdは弾かれる）。実機テストの前に本物のエンドポイントに切り替える必要がある。

## Webhookペイロードの想定

本サンプルが想定しているペイロード（公式仕様に合わせて適宜書き換える）:

```json
{
  "events": [
    {
      "type": "PURCHASED",
      "status": "PURCHASED",
      "orderId": "ord-xxx",
      "productId": "coin_100",
      "userId": "U..."
    }
  ]
}
```

または単一イベントの場合は配列でなく直接オブジェクト形でも受け取れるようにしてある。`index.js` の `handleEvent()` を参照。

## 冪等性

`orderId` をキーに `processed` Setで管理し、同じ orderId のイベントが2回来ても2回付与しない。本番では DB の UNIQUE 制約 + トランザクションで担保する。

## ローカル開発時のHTTPS公開

LINE → このサーバーのWebhookはHTTPS必須。`ngrok http 4000` 等で公開URLを得て、LINE Developersコンソールの「アプリ内課金 → 設定 → Webhook URL」に `https://xxxx.ngrok-free.app/iap/webhook` を登録する。

> フロントとサーバーで別ngrokを2本立てると、フロントから `/iap/reserve` を叩く際にCORS設定が要る。リポジトリルートの `scripts/dev-proxy.js` を使うと、フロント1本のngrokだけで全部回せる（同一オリジン化）。
