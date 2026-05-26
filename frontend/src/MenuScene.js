/**
 * src/MenuScene.js
 *
 * メニュー画面。「あそぶ」「ショップ」「タイトルへ」と所持コイン表示。
 * onEnterのたびにサーバーから残高を取りにいき、localStorageと同期する。
 */
var MenuScene = cc.Scene.extend({
  _coinLabel: null,

  onEnter: function () {
    this._super();
    var self = this;
    var s = cc.winSize;

    this.addChild(makeLabel("MENU", s.width / 2, s.height * 0.88, 56, UI.COLOR_ACCENT));

    this._coinLabel = makeLabel(this._coinLabelText(), s.width / 2, s.height * 0.78, 32);
    this.addChild(this._coinLabel);

    this.addChild(makeButton("▶ あそぶ", s.width / 2, s.height * 0.58, function () {
      cc.director.runScene(new GameScene());
    }, { fontSize: 48 }));

    this.addChild(makeButton("🛒 ショップ", s.width / 2, s.height * 0.45, function () {
      cc.director.runScene(new ShopScene());
    }, { fontSize: 48 }));

    this.addChild(makeButton("← タイトルへ", s.width / 2, s.height * 0.2, function () {
      cc.director.runScene(new TitleScene());
    }, { fontSize: 36 }));

    // サーバーから最新残高を引いてきて反映（あれば）
    liffBridge.fetchMyBalance().then(function (data) {
      if (data && typeof data.coins === "number") {
        Store.setCoins(data.coins);
        if (self._coinLabel) {
          self._coinLabel.setString(self._coinLabelText());
        }
      }
    });
  },

  _coinLabelText: function () {
    return "所持コイン: " + Store.getCoins() + "  /  Best: " + Store.getBest();
  },
});
