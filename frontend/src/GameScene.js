/**
 * src/GameScene.js
 *
 * 超シンプルゲーム。画面タップでスコア+1、もどる時に最高スコア更新＋少しコイン付与。
 */
var GameScene = cc.Scene.extend({
  _score: 0,
  _scoreLabel: null,
  _hintLabel: null,
  _ticker: null,
  _elapsed: 0,
  _timeLimit: 15, // 秒

  onEnter: function () {
    this._super();
    var self = this;
    var s = cc.winSize;

    this._score = 0;
    this._elapsed = 0;

    this._scoreLabel = makeLabel("SCORE: 0", s.width / 2, s.height * 0.86, 56, UI.COLOR_ACCENT);
    this.addChild(this._scoreLabel);

    this._timerLabel = makeLabel("残り " + this._timeLimit + " 秒", s.width / 2, s.height * 0.78, 28);
    this.addChild(this._timerLabel);

    this._hintLabel = makeLabel("画面をタップ！", s.width / 2, s.height * 0.5, 36);
    this.addChild(this._hintLabel);

    this.addChild(makeButton("← もどる", s.width / 2, s.height * 0.12, function () {
      self._finish();
    }, { fontSize: 36 }));

    // タップでスコア加算
    cc.eventManager.addListener({
      event: cc.EventListener.TOUCH_ONE_BY_ONE,
      swallowTouches: false,
      onTouchBegan: function (touch, event) {
        // 「もどる」ボタン領域は MenuItemLabel が先に拾うので問題なし
        if (self._elapsed >= self._timeLimit) return false;
        self._score += 1;
        self._scoreLabel.setString("SCORE: " + self._score);
        return true;
      },
    }, this);

    // 100msごとのタイマー
    var tick = function (dt) {
      self._elapsed += dt;
      var remain = Math.max(0, Math.ceil(self._timeLimit - self._elapsed));
      self._timerLabel.setString("残り " + remain + " 秒");
      if (self._elapsed >= self._timeLimit) {
        self._hintLabel.setString("タイムアップ！「もどる」で結果へ");
        self.unschedule(tick);
      }
    };
    this._tick = tick;
    this.schedule(tick, 0.1);
  },

  _finish: function () {
    var coinsEarned = Math.floor(this._score / 10);
    Store.setBestIfHigher(this._score);
    if (coinsEarned > 0) {
      Store.addCoins(coinsEarned);
    }
    cc.director.runScene(new MenuScene());
  },
});
