# HUMAN-SETUP.md ― 人がやる作業（コードでは進められない部分）

このリポジトリのコードを動かすには、**LINE Developersコンソール側の設定**と**実機の準備**が必要。これらはWeb管理画面の手作業や本人確認が絡むため、コードからは自動化できない。**コードを書き始める前にここを片付けておく**ことを強く推奨。

> 各作業の詳細・最新仕様は、リポジトリ外のナレッジ `line-mini-app-game/` および `line-mini-app/2026-nextjs-development-guide.md` を参照。本ファイルは「いつ・どこで・何を入力するか」のチェックリストに徹する。

---

## 0. ざっくり全体像

| フェーズ | 何をするか | 所要 | 認証済化が必要か |
| --- | --- | --- | --- |
| A. アカウント | LINE Business ID取得 → プロバイダー作成 | 〜30分 | 不要 |
| B. ミニアプリチャネル | チャネル作成 → LIFF ID取得 → エンドポイントURL登録 | 〜30分 | 不要 |
| C. 開発実行環境 | frontend は GitHub Pages へデプロイ／server は ngrok 等のトンネル／LINE 15.6.0以上の実機準備 | 〜30分 | 不要 |
| D. アプリ内課金 | IAP申請 → 商品登録 → Webhook URL登録 → テスター登録 | 申請承認待ち含めて数日 | **本番公開には必要**（テスト決済は未認証でも可） |
| E. 本番公開 | 認証済ミニアプリ化（審査依頼） | 1〜2週間 | これが審査そのもの |

PoC段階（D・テスト決済まで）なら、Eは飛ばしてよい。

---

## A. アカウント・プロバイダー

### A-1. LINE Business ID（メールアドレスのみで作れる）

1. <https://account.line.biz/login> にアクセス → 「メールアドレスでアカウントを作成」を選ぶ。
2. メール認証 → パスワード設定 → 名前を入力。
3. ログインできる状態で次へ。

> 電話番号認証は**不要**（個人LINEとの紐付けではないため）。

### A-2. プロバイダーの作成

1. <https://developers.line.biz/console/> にビジネスIDでログイン。
2. 「新規プロバイダー作成」→ プロバイダー名（**ユーザーに見える名前**なので、サービス名・会社名・サークル名等にする）。

---

## B. ミニアプリチャネルとLIFF ID

### B-1. ミニアプリチャネルを作成

> **作業場所に注意**：ミニアプリチャネルは **LINE Developers コンソール**（<https://developers.line.biz/console/>）で作る。
> 似た名前の **LINE Official Account Manager**（<https://manager.line.biz/>、いわゆる公式アカウント管理画面）には「ミニアプリ作成」のメニューは無いので、そこを探しても見つからない。必ず Developers コンソール側を開くこと。

1. <https://developers.line.biz/console/> にビジネスIDでログイン → 作成したプロバイダーを開く。
2. ［**チャネル設定**］タブ → ［**新規チャネル作成**］ → ［**LINEミニアプリ**］を選ぶ。
   - もしここで作成ボタンを押せない／エラーになる場合は、ログインに使っているLINE Business IDに**LINEアカウントが連携されていない**可能性が高い。連携してから再試行する。
3. 入力項目（2026年5月時点の最新フォーム）：

   | 項目 | 必須 | 入力例・補足 |
   | --- | --- | --- |
   | チャネルの種類 | ✅ | 「LINEミニアプリ」になっているか確認するだけ |
   | プロバイダー | ✅ | 直前に選んだプロバイダーが入っていればOK |
   | サービスを提供する地域 | ✅ | **日本**（アプリ内課金は日本のみ） |
   | チャネルアイコン | ❌ | あとから差し替え可。未設定で進めてよい |
   | チャネル名 | ✅ | 例 `Tap Tap Coin (Dev)` ／ **「LINE」または類似文字列は含めてはいけない**（弾かれる） |
   | チャネル説明 | ✅ | 1〜2行でよい。開発担当と運営事業者が異なる場合は明記 |
   | メールアドレス | ✅ | チャネル更新通知の受信先（自分のメール） |
   | プライバシーポリシーURL | △ | **認証プロバイダーの場合のみ作成時に入力可**。未認証プロバイダー（個人開発の初回など）では入力欄が出ず、**チャネル作成後に［チャネル基本設定］から編集**する形になる |
   | サービス利用規約URL | ❌ | 任意。公開時には用意することが多いが、必須ではない |
   | サービス事業主の所在国・地域 | ✅ | 「サービス提供地域と同一」にチェック |
   | LINE開発者契約 | ✅ | 同意 |
   | LINEミニアプリプラットフォーム規約 | ✅ | 同意 |
   | LINEミニアプリポリシー | ✅ | 同意 |

   > 旧フォームにあった「業種」欄は現在のフォームには存在しない。

4. 「情報利用に関する同意について」を読んで［**同意する**］→ チャネルが作成される。
5. 作成と同時に、内部的に **開発用 / 審査用 / 本番用** の3つの内部チャネル（英語UIでは `Developing` / `Review` / `Published`）が同時に発行される。**それぞれが別のLIFF IDを持つ**。

### B-2. LIFF IDの控え

- 作成したチャネルを開き、［**ウェブアプリ設定**］タブを開く（旧UIの「LIFF」タブはここに統合されている）。
- ［**基本情報**］セクションに、**開発用 / 審査用 / 本番用 それぞれの LIFF URL と LIFF ID** が並んで表示される（例：`2000000000-XXXXXXXX`）。
- 開発段階では **開発用（Developing）の LIFF ID** を控える。
- 控えたLIFF IDは:
  - フロント：`frontend/index.html` の冒頭コメント、または `frontend/src/liff-bridge.js` の `LIFF_ID` 定数（[セットアップ方法](./README.md#1-frontend-起動)）
  - 環境変数として `.env`（`server/`）に書いても良いが、フロントが静的なのでクライアントJSに直書きでよい

### B-3. エンドポイントURLの登録

同じ［**ウェブアプリ設定**］タブで、内部チャネルごとに **エンドポイントURL** を入力する。本リポジトリは frontend を **GitHub Pages** で配信する想定（C-1 参照）。

| 内部チャネル（日本語UI / 英語UI） | 登録するURL（例） |
| --- | --- |
| 開発用 / Developing | `https://<your-user>.github.io/life-mniapp-cocos2djs-sample/`（GitHub Pages の開発用デプロイ先） |
| 審査用 / Review | 審査時に本番候補URLを入れる（審査開始時に開発用の設定が自動コピーされるので、最初は空でも可） |
| 本番用 / Published | 本番ホスティングのURL（例 `https://game.example.com`） |

> 開発用／審査用には、ベーシック認証付きのURLも登録できる（公開前の限定アクセス用）。
> 一時的にローカル動作確認したいだけならngrokのURLを入れてもよい（C-2 参照）。ただし**ngrok無料プランはURLが起動ごとに変わる**ので、毎回コンソール側の差し替えが発生する。

### B-4. スコープ

［**ウェブアプリ設定**］タブの ［**Scope**］ で:

- ✅ `profile` （`liff.getProfile()`で表示名・ユーザーID取得に必要）
- 必要に応じて `openid`（サーバーでIDトークン検証するなら）

それ以外（`email` / `chat_message.write`）はPoCでは不要。

---

## C. 開発実行環境

LIFFはHTTPS必須。ローカルの `http://localhost:3000` をそのままLIFFに登録することはできないため、**frontend と server で公開手段を分ける**のが本リポジトリの推奨構成。

| 公開対象 | 推奨手段 | 理由 |
| --- | --- | --- |
| `frontend/`（静的） | **GitHub Pages**（C-1） | URLが固定で B-3 を毎回書き換えなくて済む。push に連動して自動デプロイ |
| `server/`（IAP Webhook） | **ngrok 等のトンネル**（C-2） | 外部からの POST を受ける動的サーバーなので静的ホスティング不可 |

### C-1. frontend を GitHub Pages でホストする（推奨）

GitHub Pages なら **URL が固定**（`https://<user>.github.io/<repo>/`）になり、B-3 の「開発用」エンドポイントURLを毎回差し替える必要がない。`frontend/` 配下の script 参照はすべて相対パスのため、サブパス公開でもそのまま動く。

#### C-1-1. リポジトリ設定

1. GitHub のリポジトリページ → ［**Settings**］ → ［**Pages**］ を開く。
2. ［**Build and deployment**］ → ［**Source**］を **「GitHub Actions」** に変更する（「Deploy from a branch」ではない）。

#### C-1-2. デプロイ用 GitHub Actions ワークフロー

リポジトリ直下に **`.github/workflows/deploy-frontend.yml`** を配置済み（本リポジトリに同梱）。
このワークフローは次を行う：

- `main` ブランチへの `frontend/**` 変更push、または手動実行（`workflow_dispatch`）で起動
- `scripts/download-cocos2d.sh` を実行して `frontend/lib/cocos2d-html5/` を生成（`.gitignore` でリポジトリには含めていないため、ビルド時に毎回ダウンロードが必要）
- `frontend/` ディレクトリを Pages のアーティファクトとしてアップロード→ デプロイ

`main` に push するか、Actions タブから手動実行すれば、数分で `https://<user>.github.io/<repo>/` が更新される。

#### C-1-3. 取得した URL を LINE Developers コンソールへ登録

1. 初回デプロイ完了後、Settings → Pages の上部に表示される URL（例 `https://your-user.github.io/life-mniapp-cocos2djs-sample/`）をコピー。
2. LINE Developers コンソール → 該当チャネル → ［ウェブアプリ設定］ → 「開発用」エンドポイントURLに貼り付ける。
3. 以降は **このURL は固定**。普段は `git push` するだけでデプロイ→反映される。

#### C-1-4. LIFF ID の取り扱いに関する注意

`frontend/src/liff-bridge.js` の `LIFF_ID` 定数は GitHub に push されることになる。

- **開発用 LIFF ID** はパブリックリポジトリに置いても実害は小さい（誰かが LIFF を叩いてもこちらのサーバーには影響しない／IAPはテスター登録された人だけ）。
- ただし、本番用 LIFF ID は**push してはいけない**。本番デプロイ時はビルドステップで環境変数等から差し込む形にする（または別リポジトリで管理する）。
- リポジトリを Private にしておけば気にしなくてよい。

### C-2. server（IAP Webhook）用 HTTPSトンネル

Webhook を受ける `server/` はローカル起動が前提のため、開発中は **ngrok 等のトンネル** が必要（GitHub Pages 等の静的ホスティングでは代替できない）。

```bash
# 別ターミナルで server を起動した上で
ngrok http 4000
# → 出てきた https://yyyy.ngrok-free.app/iap/webhook を
#   D-3 の「アプリ内課金 → 設定 → Webhook URL」に登録
```

> `ngrok` の代わりに `cloudflared tunnel` / `localtunnel` / `tailscale funnel` などでもよい。**ngrok無料プランはURLが起動ごとに変わる**ので、起動するたびに D-3 の Webhook URL を差し替える運用になる。固定したいなら ngrok 有料化、または Cloudflare Tunnel を固定ドメインで運用するのが楽。
>
> GitHub Codespaces を使うなら、`gh codespace ports visibility 4000:public` でCodespace内のサーバーをそのまま外部公開でき、ngrokの代替として使える。

#### 本番について

本番では server も常時稼働の HTTPS が必須なので、Render / Fly.io / Cloud Run などにデプロイすることになる。GitHub Pages では server を本番運用できない点に注意。

### C-3. 実機

| 項目 | 条件 |
| --- | --- |
| OS | iOS / Android どちらでも可。**アプリ内課金のテストは両方で確認するのが望ましい** |
| LINEアプリのバージョン | **15.6.0以上**（IAPの動作要件） |
| LINEアカウント | 日本の電話番号で認証済みのもの。**IAPのテスト決済は日本アカウント前提** |
| Apple ID / Googleアカウント | 課金UIを通すために、ストアにログイン済みであること |

LINEバージョンの確認方法：LINEアプリ → ホーム → 設定（歯車） → 「LINEについて」。

---

## D. アプリ内課金（IAP）

### D-1. IAPの申請

1. ミニアプリチャネルを開く → **「アプリ内課金」タブ**。
2. 申請フォームに事業者情報を入力。
3. **承認待ち**。数日〜数週間かかる場合あり。

> 承認前でも商品登録UIにアクセスできることがあるが、テスト決済は走らない。**まずは申請を出してから他の準備を進める**。

### D-2. プロダクト（商品）の登録

承認後、「アプリ内課金 → プロダクト管理」で商品を登録する。本リポジトリのコードは以下の3商品を前提にしているので、**同じproductIdで登録する**こと。

| productId | 商品名 | 価格 | 種別 |
| --- | --- | --- | --- |
| `coin_100` | コイン100個 | ¥120 | 消費型 (consumable) |
| `coin_500` | コイン500個 | ¥480 | 消費型 (consumable) |
| `coin_1200` | コイン1200個 | ¥980 | 消費型 (consumable) |

productIdを変えたい場合は、`frontend/src/ShopScene.js` 内の `SHOP_ITEMS` も合わせて修正する。

### D-3. Webhook URLの登録

「アプリ内課金 → 設定」タブで、**購入完了通知の送信先URL**を登録する。

- 開発中：`https://yyyy.ngrok-free.app/iap/webhook` （C-2 で立てた server 用ngrok URL ＋ `/iap/webhook` パス）
- 本番：`https://api.example.com/iap/webhook`

> frontend 用の GitHub Pages とは別経路（ngrok）。frontend は静的なので Webhook を受け取れないため、必ず server 側のトンネルURLを登録する。

このURLが受け取るリクエストの検証ロジックは `server/index.js` に実装済み。

### D-4. テスター登録

「アプリ内課金 → 設定」タブで、**テスト決済を実行できるLINEアカウント**を登録する。ここに登録されたアカウントだけ、本番課金を発生させずにIAPフローを試せる。

- 自分のLINEアカウントを必ず登録する。
- 複数人で検証する場合は、その人のLINE IDも追加する。

### D-5. チャネルシークレットの控え

Webhookの署名検証に**チャネルシークレット**を使う。「ミニアプリチャネル基本情報」タブの「チャネルシークレット」を控え、`server/.env` の `LINE_CHANNEL_SECRET` に設定する。

> チャネルシークレットはGitに**絶対コミットしない**こと。`.env` は `.gitignore` 済み。

### D-6. チャネルアクセストークンの控え（購入予約APIに必要）

サーバーから LINE の「購入予約API」を呼ぶときに、**チャネルアクセストークン**による認証が必要。

- 「ミニアプリチャネル基本情報」→「チャネルアクセストークン」を発行（短期 or 長期）。
- これを `server/.env` の `LINE_CHANNEL_ACCESS_TOKEN` に設定する。

---

## E. 本番公開（認証済ミニアプリ化／審査）

未認証のままでもゲーム自体は公開できるが、**アプリ内課金を本番ユーザーに提供するには認証済ミニアプリ化（審査通過）が必須**。

1. プライバシーポリシー／利用規約のURLを正式版に差し替える。
2. ミニアプリのスクリーンショット、サービス説明、対象ユーザー像、決済利用の有無などを用意。
3. コンソールから「審査を依頼」する。
4. 1〜2週間で結果。差し戻しの典型例：
   - 利用規約に課金についての記述がない
   - スクリーンショットが古い／ぼやけている
   - スコープが過剰（実装で使ってないスコープを宣言）

詳細は LINE Developers 公式の「審査を依頼する（LINEミニアプリ）」ページを参照。

---

## 完了チェックリスト

人がやる作業がすべて終わっているかの最終確認:

- [ ] A: LINE Business ID取得、プロバイダー作成
- [ ] B-1: ミニアプリチャネル作成（**LINE Developersコンソール**側／地域=日本／規約3点に同意）
- [ ] B-2: ［ウェブアプリ設定］→［基本情報］から開発用LIFF IDを控えた → `frontend/src/liff-bridge.js` に設定
- [ ] B-3: ［ウェブアプリ設定］の「開発用」エンドポイントURLを登録（C-1 でデプロイした GitHub Pages のURL、もしくは ngrok URL）
- [ ] B-4: ［ウェブアプリ設定］→［Scope］で `profile` を有効化
- [ ] C-1: GitHub Settings → Pages の Source を「GitHub Actions」に設定し、`main` push でデプロイが成功している（`https://<user>.github.io/<repo>/` が開ける）
- [ ] C-2: server 用に ngrok 等の HTTPS トンネルが立っている（IAP Webhook 受信用）
- [ ] C-3: LINE 15.6.0以上の実機を用意
- [ ] D-1: IAP申請を出した（承認済み）
- [ ] D-2: コンソールに `coin_100` / `coin_500` / `coin_1200` を登録
- [ ] D-3: Webhook URLを登録（`/iap/webhook`）
- [ ] D-4: 自分のLINEをテスター登録
- [ ] D-5: チャネルシークレットを `server/.env` に設定
- [ ] D-6: チャネルアクセストークンを `server/.env` に設定
- [ ] （本番公開時）E: 認証済ミニアプリ化の審査依頼

ここまで終われば、あとはコードを動かすだけ。手順は [README.md](./README.md) へ。
