# frontend/lib/

cocos2d-html5（cocos2d-js）本体を配置するディレクトリ。**Git管理外**（容量が大きいため）。

## 配置先

```
frontend/lib/cocos2d-html5/
├─ CCBoot.js
├─ cocos2d.js
├─ cocos2d/...
└─ ...（エンジン本体一式）
```

`frontend/project.json` の `engineDir` が `lib/cocos2d-html5/` を指しているので、その下にエンジン本体を展開する。

## 取得方法

リポジトリルートで:

```bash
bash scripts/download-cocos2d.sh
```

このスクリプトは GitHub の cocos2d-html5 リポジトリから ZIP を取得し、`frontend/lib/cocos2d-html5/` に展開する。

## 手動で配置する場合

1. <https://github.com/cocos2d/cocos2d-html5> から最新（または v3.17.x）のソースを取得
2. その中身を `frontend/lib/cocos2d-html5/` に丸ごとコピー
3. `CCBoot.js` が `frontend/lib/cocos2d-html5/CCBoot.js` に存在することを確認

## 別のバージョンを使う場合

- フォルダ名や `engineDir` を変えたいときは、`frontend/project.json` の `engineDir` と `frontend/index.html` の `<script src="lib/cocos2d-html5/CCBoot.js">` を両方書き換える。
- Cocos Creatorのwebビルドを使う場合は構造が大きく異なるので、`index.html`もCocos Creatorが書き出したものに合わせて差し替える。
