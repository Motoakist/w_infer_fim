#!/usr/bin/env bash
# NeurIPS2026 実験 — 更新適用スクリプト
# サーバ側で実行: sudo ./update.sh

set -euo pipefail

APP_DIR="/var/www/neurips2026"

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: sudo で実行してください"
  exit 1
fi

cd "$APP_DIR"
git fetch --all
git reset --hard origin/main
chown -R www-data:www-data "$APP_DIR"

# 静的ファイルだけなら Nginx 再起動は不要だが、設定変更があった場合は reload
if git diff HEAD@{1} HEAD --name-only | grep -q "deploy/nginx.conf"; then
  echo "==> nginx.conf に変更あり、Nginx を reload"
  cp deploy/nginx.conf /etc/nginx/sites-available/neurips2026
  # certbot が書き込んだ ssl_certificate 行を再注入する必要があるかも
  # 必要に応じて手動で /etc/nginx/sites-available/neurips2026 を確認
  nginx -t && systemctl reload nginx
fi

echo "==> 更新完了"
git log -1 --oneline
