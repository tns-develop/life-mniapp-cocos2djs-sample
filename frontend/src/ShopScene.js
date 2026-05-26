/**
 * src/ShopScene.js
 *
 * ショップ画面。コインパックをタップで購入する。
 * 購入処理は liffBridge.purchase(productId) を呼び、内部でサーバーへの予約→
 * liff.iap.createPayment へと進む。
 *
 * productId は LINE Developersコンソールの「アプリ内課金 → プロダクト管理」で
 * 登録した値と一致している必要がある（HUMAN-SETUP.md の D-2）。
 */

// 商品定義（コンソールの登録内容と一致させること）
var SHOP_ITEMS = [
  { productId: "coin_100",  label: "コイン 100",  priceLabel: "¥120",  coins: 100 },
  { productId: "coin_500",  label: "コイン 500",  priceLabel: "¥480",  coins: 500 },
  { productId: "coin_1200", label: "コイン 1200", priceLabel: "¥980",  coins: 1200 },
];

var ShopScene = cc.Scene.extend({
  _coinLabel: null,
  _statusLabel: null,
  _busy: false,

  onEnter: function () {
    this._super();
    var self = this;
    var s = cc.winSize;

    this.addChild(makeLabel("SHOP", s.width / 2, s.height * 0.92, 56, UI.COLOR_ACCENT));
    this._coinLabel = makeLabel("所持コイン: " + Store.getCoins(),
                                s.width / 2, s.height * 0.84, 30);
    this.addChild(this._coinLabel);

    var iapOk = liffBridge.isIapAvailable();

    if (!iapOk) {
      this.addChild(makeLabel("（課金は実機LINE 15.6.0+ でのみ動作）",
                              s.width / 2, s.height * 0.78, 22, UI.COLOR_DISABLED));
    }

    // 商品ボタン
    SHOP_ITEMS.forEach(function (item, i) {
      var y = s.height * (0.65 - i * 0.13);
      var text = item.label + "  " + item.priceLabel;
      self.addChild(makeButton(text, s.width / 2, y, function () {
        self._buy(item);
      }, { fontSize: 42, enabled: iapOk }));
    });

    this._statusLabel = makeLabel("", s.width / 2, s.height * 0.25, 24);
    this.addChild(this._statusLabel);

    this.addChild(makeButton("← もどる", s.width / 2, s.height * 0.12, function () {
      cc.director.runScene(new MenuScene());
    }, { fontSize: 36 }));
  },

  _buy: function (item) {
    if (this._busy) return;
    this._busy = true;
    var self = this;

    this._statusLabel.setString("購入処理中…");

    liffBridge.purchase(item.productId)
      .then(function (result) {
        cc.log("purchase ok: " + JSON.stringify(result));
        self._statusLabel.setString("購入完了。残高を更新中…");

        // 真値はサーバー側。少し待ってからWebhookでの付与結果を取りにいく
        return self._reconcileBalanceWithRetry(5);
      })
      .then(function (synced) {
        if (synced) {
          self._statusLabel.setString("コインを付与しました");
        } else {
          // サーバー未起動 or Webhook未配信。PoCのフォールバックとして
          // クライアント側で暫定加算（本番ではやらない）
          Store.addCoins(item.coins);
          self._statusLabel.setString("（暫定）クライアント側でコイン付与");
        }
        self._coinLabel.setString("所持コイン: " + Store.getCoins());
      })
      .catch(function (e) {
        var msg = (e && e.message) ? e.message : String(e);
        if (msg.indexOf("CANCELED") >= 0 || (e && e.code === "CANCELED")) {
          self._statusLabel.setString("キャンセルされました");
        } else {
          self._statusLabel.setString("購入失敗: " + msg);
        }
        cc.log("purchase error: " + msg);
      })
      .then(function () {
        self._busy = false;
      });
  },

  /**
   * Webhook付与の結果がDBに反映されるのを少し待ちながら取りにいく。
   * 反映されたら true、そうでなければ false を返す。
   */
  _reconcileBalanceWithRetry: function (maxAttempts) {
    var before = Store.getCoins();
    var attempts = 0;
    function tryOnce() {
      attempts++;
      return liffBridge.fetchMyBalance().then(function (data) {
        if (data && typeof data.coins === "number") {
          // サーバーが残高を返してきた場合、それを正とする
          Store.setCoins(data.coins);
          if (data.coins > before) {
            return true; // 増えていれば付与済みとみなす
          }
        }
        if (attempts >= maxAttempts) return false;
        return new Promise(function (resolve) {
          setTimeout(resolve, 800);
        }).then(tryOnce);
      });
    }
    return tryOnce();
  },
});
