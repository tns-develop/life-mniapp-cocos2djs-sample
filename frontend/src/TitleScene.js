/**
 * src/TitleScene.js
 *
 * タイトル画面。タップでメニュー画面へ。
 */
var TitleScene = cc.Scene.extend({
  onEnter: function () {
    this._super();
    var s = cc.winSize;

    // タイトル
    this.addChild(makeLabel("TAP TAP COIN", s.width / 2, s.height * 0.65, 72, UI.COLOR_ACCENT));

    // サブタイトル
    this.addChild(makeLabel("LINE Mini App × cocos2d-js", s.width / 2, s.height * 0.57, 24));

    // 「タップでスタート」のヒント
    var hint = makeLabel("画面をタップしてスタート", s.width / 2, s.height * 0.4, 32);
    this.addChild(hint);

    // 簡易点滅アクション
    var blink = cc.repeatForever(
      cc.sequence(cc.fadeTo(0.7, 80), cc.fadeTo(0.7, 255))
    );
    hint.runAction(blink);

    // ようこそメッセージ
    var name = liffBridge.getDisplayName();
    this.addChild(makeLabel("ようこそ " + name + " さん", s.width / 2, s.height * 0.12, 22));

    // 画面全体タップでメニューへ
    cc.eventManager.addListener({
      event: cc.EventListener.TOUCH_ONE_BY_ONE,
      swallowTouches: true,
      onTouchBegan: function () {
        cc.director.runScene(new MenuScene());
        return true;
      },
    }, this);
  },
});
