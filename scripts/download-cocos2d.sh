#!/usr/bin/env bash
#
# scripts/download-cocos2d.sh
#
# cocos2d-html5 を GitHub から取得して frontend/lib/cocos2d-html5/ に展開する。
# - リポジトリルートから実行する想定
# - 既存の lib/cocos2d-html5/ がある場合は上書きしない（強制したい場合は --force）
#
# 使い方:
#   bash scripts/download-cocos2d.sh
#   bash scripts/download-cocos2d.sh --force
#   bash scripts/download-cocos2d.sh --ref v3.17.2     # 特定タグを指定

set -euo pipefail

# 引数解析
FORCE=0
REF="develop"   # cocos2d-html5の最新は develop ブランチが事実上の最終形
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --ref)   REF="$2"; shift 2 ;;
    *)       echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# このスクリプトの位置からリポジトリルートを特定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$REPO_ROOT/frontend/lib/cocos2d-html5"

if [[ -d "$DEST" && "$FORCE" -ne 1 ]]; then
  echo "[skip] $DEST is already populated."
  echo "       Re-run with --force to overwrite."
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ARCHIVE_URL="https://codeload.github.com/cocos2d/cocos2d-html5/zip/refs/heads/${REF}"
# タグ指定の場合（v3.17.2など）はrefs/tagsを試す
case "$REF" in
  v*|*[0-9].[0-9]*)
    ARCHIVE_URL="https://codeload.github.com/cocos2d/cocos2d-html5/zip/refs/tags/${REF}"
    ;;
esac

echo "[1/3] downloading $ARCHIVE_URL"
curl -fsSL "$ARCHIVE_URL" -o "$TMP/cocos2d.zip"

echo "[2/3] extracting"
unzip -q "$TMP/cocos2d.zip" -d "$TMP"

# 展開後のディレクトリは cocos2d-html5-<ref> という命名
EXTRACTED="$(find "$TMP" -maxdepth 1 -type d -name 'cocos2d-html5-*' | head -n1)"
if [[ -z "$EXTRACTED" ]]; then
  echo "ERROR: could not find extracted cocos2d-html5 directory"
  exit 1
fi

echo "[3/3] moving into $DEST"
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
mv "$EXTRACTED" "$DEST"

echo
echo "Done. cocos2d-html5 has been installed at:"
echo "  $DEST"
echo
echo "Verify:"
ls -la "$DEST/CCBoot.js" 2>/dev/null || echo "WARN: CCBoot.js not found at root. ref=$REF may not have that layout."
