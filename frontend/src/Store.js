/**
 * src/Store.js
 *
 * PoC用の最小状態管理。コインと最高スコアを localStorage に保持する。
 *
 * 注意：本番ではコイン残高は必ずサーバー側を真実とする。
 * localStorage はユーザー側で書き換え可能なので、課金で得たコインの真値ではない。
 * ShopSceneでは購入完了後にサーバーから fetchMyBalance() で同期する設計を推奨。
 */
var Store = {
  KEY_COINS: "ttc_coins",
  KEY_BEST: "ttc_best_score",

  getCoins: function () {
    var v = parseInt(localStorage.getItem(Store.KEY_COINS) || "0", 10);
    return isNaN(v) ? 0 : v;
  },

  setCoins: function (n) {
    var v = Math.max(0, Math.floor(n));
    localStorage.setItem(Store.KEY_COINS, String(v));
    return v;
  },

  addCoins: function (n) {
    return Store.setCoins(Store.getCoins() + n);
  },

  getBest: function () {
    var v = parseInt(localStorage.getItem(Store.KEY_BEST) || "0", 10);
    return isNaN(v) ? 0 : v;
  },

  setBestIfHigher: function (score) {
    if (score > Store.getBest()) {
      localStorage.setItem(Store.KEY_BEST, String(score));
      return true;
    }
    return false;
  },
};
