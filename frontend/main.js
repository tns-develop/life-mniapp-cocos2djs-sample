/**
 * cocos2d-js 起動スクリプト
 *
 * - 解像度を設定（縦持ち720x1280基準）
 * - LIFF初期化の完了を待ってから最初のSceneに遷移
 * - 失敗時はゲームをゲストモードで起動（課金は無効化される）
 */
cc.game.onStart = function () {
  // デザイン解像度＝720x1280縦長。SHOW_ALLでアスペクト比を保ったまま全体表示
  cc.view.setDesignResolutionSize(720, 1280, cc.ResolutionPolicy.SHOW_ALL);
  cc.view.resizeWithBrowserSize(true);
  cc.view.enableRetina(true);

  // 画面回転対策（縦持ち固定をJS側からも明示）
  cc.view.setOrientation(cc.ORIENTATION_PORTRAIT);

  // LIFF初期化を待ってからタイトルへ
  liffBridge.ready().then(function () {
    cc.director.runScene(new TitleScene());
  }).catch(function (e) {
    // LIFF初期化失敗 → ゲストモードでタイトルへ
    cc.log("LIFF init error (continue as guest): " + (e && e.message ? e.message : e));
    cc.director.runScene(new TitleScene());
  });
};

cc.game.run();
