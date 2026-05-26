/**
 * server/index.js
 *
 * LINEミニアプリ アプリ内課金（IAP）用の最小サーバー。
 *
 * 提供エンドポイント:
 *   POST /iap/reserve   ... クライアントから呼ばれ、orderId を発行して返す
 *   POST /iap/webhook   ... LINEから呼ばれる購入完了通知。x-line-signature検証
 *   GET  /me?userId=... ... ユーザーの現在残高を返す（クライアントの同期用）
 *   GET  /healthz       ... ヘルスチェック
 *
 * データ永続化はメモリ（Map）。再起動で全消える。PoC前提。
 * 本番は SQLite / PostgreSQL / DynamoDB 等に置き換える。
 */

require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const { randomUUID } = require("crypto");

const PORT = Number(process.env.PORT || 4000);
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
// 本番は LINE_PURCHASE_RESERVE_URL を公式ドキュメントに従って設定する。
// 未設定の場合はモックモードで動作（orderIdをローカル生成のみ）。
const LINE_PURCHASE_RESERVE_URL = process.env.LINE_PURCHASE_RESERVE_URL || "";

// 商品マスタ（クライアントと一致させる）
const PRODUCTS = {
  coin_100:  { coins: 100,  priceJpy: 120 },
  coin_500:  { coins: 500,  priceJpy: 480 },
  coin_1200: { coins: 1200, priceJpy: 980 },
};

// メモリストア
const reservations = new Map(); // orderId -> { userId, productId, status, createdAt }
const processed = new Set();    // 付与済み orderId（冪等性のため）
const balances = new Map();     // userId -> coins

function getBalance(userId) {
  return balances.get(userId) || 0;
}
function addCoins(userId, delta) {
  const v = getBalance(userId) + delta;
  balances.set(userId, v);
  return v;
}

const app = express();

// /iap/webhook だけは生バイトが必要なので、JSONパースより先にrawで取る
app.use("/iap/webhook", express.raw({ type: "*/*" }));
app.use(express.json());

// ---------- ヘルス ----------
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    secretConfigured: Boolean(LINE_CHANNEL_SECRET),
    tokenConfigured: Boolean(LINE_CHANNEL_ACCESS_TOKEN),
    reserveMode: LINE_PURCHASE_RESERVE_URL ? "real" : "mock",
  });
});

// ---------- 自分の残高取得 ----------
app.get("/me", (req, res) => {
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ error: "userId required" });
  res.json({ userId, coins: getBalance(userId) });
});

// ---------- 購入予約 ----------
app.post("/iap/reserve", async (req, res) => {
  try {
    const { productId, userId } = req.body || {};
    if (!productId || !userId) {
      return res.status(400).json({ error: "productId and userId required" });
    }
    if (!PRODUCTS[productId]) {
      return res.status(400).json({ error: "unknown productId: " + productId });
    }

    const orderId = await reserveOnLine({ productId, userId });
    reservations.set(orderId, {
      userId,
      productId,
      status: "reserved",
      createdAt: Date.now(),
    });

    console.log(`[reserve] orderId=${orderId} userId=${userId} productId=${productId}`);
    res.json({ orderId });
  } catch (e) {
    console.error("[reserve] error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * LINEの「購入予約API」を叩いて orderId を発行する。
 * 公式ドキュメントの最新版を確認してエンドポイント・リクエスト形を合わせること。
 * 未設定時はローカルでUUIDを生成して返すモック動作。
 */
async function reserveOnLine({ productId, userId }) {
  if (!LINE_PURCHASE_RESERVE_URL) {
    // モック：UUIDを orderId として返す
    return `mock-${randomUUID()}`;
  }
  const resp = await fetch(LINE_PURCHASE_RESERVE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ productId, userId }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`LINE reserve API failed: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  if (!data || !data.orderId) {
    throw new Error("LINE reserve API response missing orderId");
  }
  return data.orderId;
}

// ---------- Webhook受信 ----------
app.post("/iap/webhook", (req, res) => {
  // 1. 署名検証
  if (!LINE_CHANNEL_SECRET) {
    console.warn("[webhook] LINE_CHANNEL_SECRET not configured. Rejecting.");
    return res.status(500).end();
  }
  const signature = req.headers["x-line-signature"];
  const raw = req.body; // Buffer
  const expected = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(raw)
    .digest("base64");
  if (signature !== expected) {
    console.warn("[webhook] signature mismatch");
    return res.status(401).end();
  }

  // 2. パース
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch (e) {
    console.warn("[webhook] JSON parse failed:", e.message);
    return res.status(400).end();
  }

  // 3. ハンドリング（ペイロード構造は公式ドキュメントを参照して合わせること）
  //    本サンプルは想定形:
  //      { type, orderId, productId, userId, status }  または
  //      { events: [{ type, orderId, productId, userId, status }, ...] }
  const events = Array.isArray(payload.events) ? payload.events : [payload];

  for (const ev of events) {
    handleEvent(ev);
  }

  res.status(200).end();
});

function handleEvent(ev) {
  if (!ev || !ev.orderId) {
    console.warn("[webhook] event missing orderId:", ev);
    return;
  }

  // 冪等性：同じ orderId は1回しか付与しない
  if (processed.has(ev.orderId)) {
    console.log(`[webhook] orderId=${ev.orderId} already processed, skip`);
    return;
  }

  // 想定するステータスのみ付与（PURCHASED / COMPLETED 等。公式仕様に合わせる）
  const status = (ev.status || ev.type || "").toUpperCase();
  const isSuccess = ["PURCHASED", "COMPLETED", "SUCCESS"].includes(status);
  if (!isSuccess) {
    console.log(`[webhook] orderId=${ev.orderId} status=${status} (no grant)`);
    return;
  }

  // 予約レコードから userId / productId を取り出す（イベントに含まれる場合はそちらを優先）
  const reservation = reservations.get(ev.orderId);
  const userId = ev.userId || (reservation && reservation.userId);
  const productId = ev.productId || (reservation && reservation.productId);
  if (!userId || !productId) {
    console.warn(`[webhook] cannot resolve user/product for orderId=${ev.orderId}`);
    return;
  }
  const product = PRODUCTS[productId];
  if (!product) {
    console.warn(`[webhook] unknown productId in event: ${productId}`);
    return;
  }

  const newBalance = addCoins(userId, product.coins);
  processed.add(ev.orderId);
  if (reservation) {
    reservation.status = "granted";
    reservations.set(ev.orderId, reservation);
  }
  console.log(`[webhook] GRANTED userId=${userId} +${product.coins} -> ${newBalance} (orderId=${ev.orderId})`);
}

// ---------- 起動 ----------
app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
  console.log(`  LINE_CHANNEL_SECRET: ${LINE_CHANNEL_SECRET ? "set" : "NOT SET (webhook will return 500)"}`);
  console.log(`  reserve mode      : ${LINE_PURCHASE_RESERVE_URL ? "real" : "mock (UUID)"}`);
});
