/**
 * src/liff-bridge.js
 *
 * cocos2d-js側のSceneから window.liff を直接触らず、この薄いラッパ経由で扱う。
 * - 初期化の重複呼び出しを抑止
 * - PCブラウザでも落ちないように isApiAvailable() で課金可否を判定
 *
 * 重要：LIFF_ID は LINE Developersコンソールから取得した値に書き換えること。
 *      ホストごとに切り替えたい場合は location.hostname で出し分けても良い。
 */
(function (global) {
  // ====== 設定 ======
  var LIFF_ID = "2010215624-nWbKPOv5"; // ← HUMAN-SETUP.md の B-2 で控えた値に置き換え
  // サーバー（IAP予約・Webhook受信）のオリジン。同一オリジンならそのまま "" でよい。
  var SERVER_ORIGIN = "";

  // ====== 内部状態 ======
  var _readyPromise = null;
  var _profile = null;
  var _initError = null;

  function _init() {
    if (_readyPromise) return _readyPromise;

    if (!global.liff) {
      // LIFF SDKが読み込まれていない（ネットワーク失敗等）
      _initError = new Error("LIFF SDK is not loaded");
      _readyPromise = Promise.reject(_initError);
      return _readyPromise;
    }

    _readyPromise = global.liff.init({ liffId: LIFF_ID })
      .then(function () {
        if (!global.liff.isLoggedIn()) {
          // LINE内ブラウザでは透過的にバックグラウンドでログインされる
          // 外部ブラウザではログインページに遷移する
          global.liff.login();
          // 遷移する場合はここで一旦止める
          return new Promise(function () {});
        }
        return global.liff.getProfile();
      })
      .then(function (profile) {
        _profile = profile;
        return profile;
      })
      .catch(function (e) {
        _initError = e;
        // 課金以外はゲストとして動かす方針なので、ここではrethrowしない
        console.error("[liff-bridge] init failed:", e);
      });

    return _readyPromise;
  }

  var bridge = {
    /** 初期化完了を待つPromise（多重呼び出しOK） */
    ready: function () { return _init(); },

    /** プロフィール（取得失敗時は null） */
    getProfile: function () { return _profile; },
    getDisplayName: function () { return _profile ? _profile.displayName : "ゲスト"; },
    getUserId: function () { return _profile ? _profile.userId : null; },

    /** LIFFアプリ内（LINE WebView）で開いているか */
    isInClient: function () {
      return !!(global.liff && global.liff.isInClient && global.liff.isInClient());
    },

    /** アプリ内課金が利用可能か（実機LINE 15.6.0+ かつ SDK 2.26.0+） */
    isIapAvailable: function () {
      try {
        return !!(
          global.liff &&
          global.liff.isApiAvailable &&
          global.liff.isApiAvailable("iap")
        );
      } catch (e) {
        return false;
      }
    },

    /** 初期化エラー（あれば） */
    getInitError: function () { return _initError; },

    /**
     * 商品メタ情報（ローカライズ済み価格・名称）をLINE側から取得する。
     * ShopSceneの表示で使う場合のみ呼ぶ。
     * @param {string[]} productIds
     */
    getPlatformProducts: function (productIds) {
      if (!this.isIapAvailable()) return Promise.reject(new Error("IAP not available"));
      return global.liff.iap.getPlatformProducts({ productIds: productIds });
    },

    /**
     * 購入実行。
     * 1) サーバーの /iap/reserve に productId と userId を投げて orderId を発行
     * 2) liff.iap.requestConsentAgreement() で初回同意
     * 3) liff.iap.createPayment() で決済UI起動
     *
     * 戻り値：購入完了のPromise（成功時は createPayment の結果。失敗時は例外）
     * ユーザーキャンセル時は code "CANCELED" の例外がthrowされる。
     *
     * @param {string} productId
     */
    purchase: function (productId) {
      if (!this.isIapAvailable()) {
        return Promise.reject(new Error("IAP not available in this environment"));
      }

      var userId = this.getUserId();
      if (!userId) {
        return Promise.reject(new Error("Not logged in"));
      }

      return fetch(SERVER_ORIGIN + "/iap/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productId, userId: userId }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("reserve failed: HTTP " + r.status);
          return r.json();
        })
        .then(function (res) {
          if (!res || !res.orderId) throw new Error("reserve response missing orderId");
          var orderId = res.orderId;

          // 初回購入時に同意ダイアログが出る。2回目以降はno-op
          return global.liff.iap.requestConsentAgreement()
            .then(function () {
              return global.liff.iap.createPayment({
                productId: productId,
                orderId: orderId,
              });
            })
            .then(function (paymentResult) {
              // クライアントは「決済UIが完了した」事実を受け取るだけ。
              // 実際のアイテム付与判定はサーバーのWebhookが正。
              // 必要ならここで /me などサーバーAPIを叩いて最新コイン残高を取得する。
              return { orderId: orderId, productId: productId, paymentResult: paymentResult };
            });
        });
    },

    /**
     * サーバーから自分の最新コイン残高を取得（IAP後の同期表示用）。
     * サーバー実装は server/index.js の GET /me を参照。
     */
    fetchMyBalance: function () {
      var userId = this.getUserId();
      if (!userId) return Promise.resolve(null);
      return fetch(SERVER_ORIGIN + "/me?userId=" + encodeURIComponent(userId))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    },
  };

  global.liffBridge = bridge;

  // SDKがすでに読み込まれていれば即時初期化を仕掛けておく
  if (global.liff) {
    bridge.ready();
  }
})(window);
