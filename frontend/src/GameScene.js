/**
 * src/GameScene.js
 *
 * ブロック崩し（Breakout）風ミニゲーム。
 * - 画面下のパドルでボールを跳ね返し、上部のブロックを崩す
 * - ライフ3。落球で-1、0でゲームオーバー
 * - 全ブロック破壊で残ライフボーナス
 * - 終了時は既存 _finish() で Best 更新 + コイン付与（score/10）
 *
 * 描画は外部画像不要。cc.DrawNode で矩形・円を毎フレーム再描画する。
 */
var GameScene = cc.Scene.extend({
  _score: 0,
  _lives: 3,
  _scoreLabel: null,
  _lifeLabel: null,
  _centerLabel: null,

  _ball: null,
  _paddle: null,
  _blocks: null,

  _paused: false,     // ライフ減直後の停止 or 終了演出中
  _finished: false,   // 二重 _finish 防止
  _resumeAt: 0,       // ボール再発射までの待機タイマー（秒）

  onEnter: function () {
    this._super();
    var self = this;
    var s = cc.winSize;

    this._score = 0;
    this._lives = 3;
    this._paused = true;       // 入場直後は短い猶予
    this._finished = false;
    this._resumeAt = 0.6;

    // --- 背景（暗めの単色） ---
    var bg = new cc.LayerColor(cc.color(17, 17, 30, 255), s.width, s.height);
    this.addChild(bg, -10);

    // --- HUD ---
    this._scoreLabel = makeLabel("SCORE: 0", s.width * 0.28, s.height * 0.95, 32, UI.COLOR_ACCENT);
    this.addChild(this._scoreLabel);

    this._lifeLabel = makeLabel("LIFE: 3", s.width * 0.78, s.height * 0.95, 32, UI.COLOR_ACCENT);
    this.addChild(this._lifeLabel);

    // 「もどる」ボタン（プラン: 上部左寄せ、パドル可動域と分離）
    this.addChild(makeButton("← もどる", s.width * 0.13, s.height * 0.90, function () {
      if (self._finished) return;
      self._finished = true;
      self._finish();
    }, { fontSize: 26 }));

    // --- ブロック ---
    this._buildBlocks(s);

    // --- パドル ---
    this._paddle = {
      x: s.width / 2,
      y: 120,
      w: 160,
      h: 22,
      color: cc.color(220, 220, 240, 255),
      node: new cc.DrawNode(),
    };
    this.addChild(this._paddle.node);
    this._drawRect(this._paddle);

    // --- ボール ---
    this._ball = {
      x: s.width / 2,
      y: this._paddle.y + this._paddle.h / 2 + 18,
      r: 12,
      vx: 0,
      vy: 0,
      color: cc.color(255, 255, 255, 255),
      node: new cc.DrawNode(),
    };
    this.addChild(this._ball.node);
    this._drawBall();

    // --- 中央メッセージ（最初は非表示文字列） ---
    this._centerLabel = makeLabel("", s.width / 2, s.height * 0.55, 64, UI.COLOR_ACCENT);
    this.addChild(this._centerLabel);

    // --- 入力（パドル追従） ---
    this._touchListener = cc.eventManager.addListener({
      event: cc.EventListener.TOUCH_ONE_BY_ONE,
      swallowTouches: false,
      onTouchBegan: function (touch) {
        self._movePaddleTo(touch.getLocation().x);
        return true;
      },
      onTouchMoved: function (touch) {
        self._movePaddleTo(touch.getLocation().x);
      },
    }, this);

    // --- 物理更新（60fps固定） ---
    this.scheduleUpdate();
  },

  onExit: function () {
    if (this._touchListener) {
      cc.eventManager.removeListener(this._touchListener);
      this._touchListener = null;
    }
    this._super();
  },

  /**
   * ブロック群を生成。
   * 8列 × 5行、左右に余白、行ごとに色を変える。
   */
  _buildBlocks: function (s) {
    var cols = 8;
    var rows = 5;
    var margin = 24;
    var gap = 4;
    var bw = (s.width - margin * 2 - gap * (cols - 1)) / cols;
    var bh = 32;
    var topY = s.height * 0.86;

    var rowColors = [
      cc.color(255, 99, 99, 255),
      cc.color(255, 165, 89, 255),
      cc.color(255, 220, 100, 255),
      cc.color(120, 220, 140, 255),
      cc.color(110, 180, 255, 255),
    ];

    this._blocks = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var b = {
          x: margin + bw / 2 + c * (bw + gap),
          y: topY - r * (bh + gap),
          w: bw,
          h: bh,
          color: rowColors[r % rowColors.length],
          node: new cc.DrawNode(),
          alive: true,
        };
        this.addChild(b.node);
        this._drawRect(b);
        this._blocks.push(b);
      }
    }
  },

  _drawRect: function (o) {
    o.node.clear();
    var p1 = cc.p(o.x - o.w / 2, o.y - o.h / 2);
    var p2 = cc.p(o.x + o.w / 2, o.y + o.h / 2);
    o.node.drawRect(p1, p2, o.color, 0, cc.color(0, 0, 0, 0));
  },

  _drawBall: function () {
    var b = this._ball;
    b.node.clear();
    b.node.drawDot(cc.p(b.x, b.y), b.r, b.color);
  },

  _movePaddleTo: function (x) {
    var s = cc.winSize;
    var halfW = this._paddle.w / 2;
    this._paddle.x = Math.max(halfW, Math.min(s.width - halfW, x));
    this._drawRect(this._paddle);
  },

  /**
   * ボールをパドル真上に再配置し、少し待ってから発射。
   */
  _resetBall: function (waitSec) {
    var b = this._ball;
    var p = this._paddle;
    b.x = p.x;
    b.y = p.y + p.h / 2 + b.r + 4;
    b.vx = 0;
    b.vy = 0;
    this._drawBall();
    this._paused = true;
    this._resumeAt = waitSec;
  },

  _launchBall: function () {
    var b = this._ball;
    var speed = 520;
    // ランダムに左右どちらか、上方向に発射
    var dir = Math.random() < 0.5 ? -1 : 1;
    var angle = (Math.PI / 4) * (0.8 + Math.random() * 0.4); // 36〜54度
    b.vx = dir * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    this._paused = false;
  },

  update: function (dt) {
    if (this._finished) return;

    // 入場直後 / 落球後の停止カウントダウン
    if (this._paused) {
      // ボールはパドルに追従させると次の発射が自然
      var b0 = this._ball;
      var p0 = this._paddle;
      b0.x = p0.x;
      b0.y = p0.y + p0.h / 2 + b0.r + 4;
      this._drawBall();

      this._resumeAt -= dt;
      if (this._resumeAt <= 0) {
        this._launchBall();
      }
      return;
    }

    var s = cc.winSize;
    var b = this._ball;

    // 大きい dt は分割して衝突抜けを防ぐ
    var steps = Math.max(1, Math.ceil((Math.abs(b.vx) + Math.abs(b.vy)) * dt / 12));
    var sub = dt / steps;
    for (var i = 0; i < steps; i++) {
      this._step(sub, s);
      if (this._paused || this._finished) break;
    }

    this._drawBall();
  },

  _step: function (dt, s) {
    var b = this._ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 壁反射（左右・上）
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
    } else if (b.x + b.r > s.width) {
      b.x = s.width - b.r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y + b.r > s.height) {
      b.y = s.height - b.r;
      b.vy = -Math.abs(b.vy);
    }

    // 画面下に落下
    if (b.y - b.r < 0) {
      this._onBallLost();
      return;
    }

    // パドル衝突（特別扱い：当たった位置で角度をズラす）
    if (this._collidesRect(b, this._paddle)) {
      var p = this._paddle;
      // めり込み解消
      b.y = p.y + p.h / 2 + b.r + 0.5;
      var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      var offset = (b.x - p.x) / (p.w / 2); // -1..1
      offset = Math.max(-1, Math.min(1, offset));
      var angle = offset * (Math.PI / 3); // ±60度
      b.vx = speed * Math.sin(angle);
      b.vy = speed * Math.cos(angle); // 常に上向き
    }

    // ブロック衝突（ヒットした最初の1個だけ反応）
    for (var i = 0; i < this._blocks.length; i++) {
      var blk = this._blocks[i];
      if (!blk.alive) continue;
      var hit = this._collideAndReflect(b, blk);
      if (hit) {
        blk.alive = false;
        blk.node.clear();
        this._score += 10;
        this._scoreLabel.setString("SCORE: " + this._score);
        if (this._isCleared()) {
          this._onCleared();
        }
        break;
      }
    }
  },

  /** 円と矩形（中心+幅高さ）の重なり判定。 */
  _collidesRect: function (b, rect) {
    var rx = rect.x - rect.w / 2;
    var ry = rect.y - rect.h / 2;
    var cx = Math.max(rx, Math.min(b.x, rx + rect.w));
    var cy = Math.max(ry, Math.min(b.y, ry + rect.h));
    var dx = b.x - cx;
    var dy = b.y - cy;
    return dx * dx + dy * dy <= b.r * b.r;
  },

  /**
   * ボールと矩形が衝突していたら、最も浅い軸を反射させる。
   * 戻り値: 衝突したか
   */
  _collideAndReflect: function (b, rect) {
    var rx = rect.x - rect.w / 2;
    var ry = rect.y - rect.h / 2;
    var cx = Math.max(rx, Math.min(b.x, rx + rect.w));
    var cy = Math.max(ry, Math.min(b.y, ry + rect.h));
    var dx = b.x - cx;
    var dy = b.y - cy;
    if (dx * dx + dy * dy > b.r * b.r) return false;

    // 矩形内/辺ぎりぎりで dx≈0, dy≈0 のときは中心からの方向で判定
    if (dx === 0 && dy === 0) {
      dx = b.x - rect.x;
      dy = b.y - rect.y;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      b.vx = (dx > 0 ? 1 : -1) * Math.abs(b.vx);
      b.x = (dx > 0 ? rect.x + rect.w / 2 + b.r : rect.x - rect.w / 2 - b.r);
    } else {
      b.vy = (dy > 0 ? 1 : -1) * Math.abs(b.vy);
      b.y = (dy > 0 ? rect.y + rect.h / 2 + b.r : rect.y - rect.h / 2 - b.r);
    }
    return true;
  },

  _isCleared: function () {
    for (var i = 0; i < this._blocks.length; i++) {
      if (this._blocks[i].alive) return false;
    }
    return true;
  },

  _onBallLost: function () {
    this._lives -= 1;
    this._lifeLabel.setString("LIFE: " + Math.max(0, this._lives));
    if (this._lives <= 0) {
      this._endGame("GAME OVER");
    } else {
      this._resetBall(0.8);
    }
  },

  _onCleared: function () {
    var bonus = this._lives * 50;
    this._score += bonus;
    this._scoreLabel.setString("SCORE: " + this._score);
    this._endGame("CLEAR!  +" + bonus);
  },

  /**
   * 終了演出（中央メッセージ）→ 少し待って _finish()。
   */
  _endGame: function (msg) {
    if (this._finished) return;
    this._finished = true;
    this._paused = true;
    this._ball.vx = 0;
    this._ball.vy = 0;
    this._centerLabel.setString(msg);

    var self = this;
    this.scheduleOnce(function () {
      self._finish();
    }, 1.5);
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
