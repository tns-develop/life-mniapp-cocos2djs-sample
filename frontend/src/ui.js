/**
 * src/ui.js
 *
 * cocos2d-html5の cc.MenuItemLabel / cc.Menu でタップ可能なボタンを作るヘルパー群。
 * PoCなので装飾は最小限。色・サイズ・フォントを統一する。
 */

var UI = {
  FONT: "Arial",
  COLOR_PRIMARY: cc.color(255, 255, 255),
  COLOR_DISABLED: cc.color(128, 128, 128),
  COLOR_ACCENT: cc.color(255, 220, 100),
};

/**
 * ボタンを生成して返す（addChildする前のオブジェクト）。
 * @param {string} text 表示文字列
 * @param {number} x
 * @param {number} y
 * @param {Function} onTap タップ時コールバック
 * @param {Object} [opts] { fontSize, enabled, color }
 * @returns {cc.Menu}
 */
function makeButton(text, x, y, onTap, opts) {
  opts = opts || {};
  var fontSize = opts.fontSize || 40;
  var enabled = opts.enabled !== false;
  var color = opts.color || (enabled ? UI.COLOR_PRIMARY : UI.COLOR_DISABLED);

  var label = new cc.LabelTTF(text, UI.FONT, fontSize);
  label.setColor(color);

  var item = new cc.MenuItemLabel(label, enabled ? onTap : null);
  item.setEnabled(enabled);
  item.setPosition(x, y);

  var menu = new cc.Menu(item);
  // item側に絶対座標を持たせるためmenuは原点に置く
  menu.setPosition(0, 0);
  return menu;
}

/**
 * 中央揃えラベルを生成して返す。
 * @returns {cc.LabelTTF}
 */
function makeLabel(text, x, y, fontSize, color) {
  var lbl = new cc.LabelTTF(text, UI.FONT, fontSize || 32);
  lbl.setPosition(x, y);
  lbl.setColor(color || UI.COLOR_PRIMARY);
  return lbl;
}
