#!/usr/bin/env bash
# NeurIPS2026 実験 — AWS Lightsail (Ubuntu 22.04) 初期セットアップ
#
# 使い方:
#   sudo ./setup.sh experiment.example.com [GIT_REMOTE_URL]
#
# 引数:
#   $1: ドメイン名（A レコードを既にこのインスタンスに向けてあること）
#   $2: GitHub リポジトリの URL（省略可。既定は下記の REPO_URL）

set -euo pipefail

# ====== 設定 ======
DOMAIN="${1:-}"
REPO_URL="${2:-https://github.com/YOUR_USER/YOUR_REPO.git}"
APP_DIR="/var/www/neurips2026"
NGINX_SITE="/etc/nginx/sites-available/neurips2026"
DEPLOY_DIR_IN_REPO="deploy"

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: ドメイン名を引数に渡してください"
  echo "  例) sudo ./setup.sh experiment.example.com"
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: sudo で実行してください"
  exit 1
fi

# ====== 依存パッケージ ======
echo "==> apt update / install"
apt update
DEBIAN_FRONTEND=noninteractive apt install -y nginx git certbot python3-certbot-nginx

# ====== ソース取得 ======
echo "==> リポジトリを ${APP_DIR} にクローン"
if [[ -d "$APP_DIR/.git" ]]; then
  echo "   既存のリポジトリを git pull"
  git -C "$APP_DIR" pull
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi
chown -R www-data:www-data "$APP_DIR"

# ====== Nginx 設定 ======
echo "==> Nginx サイト設定を作成"
sed "s|{{DOMAIN}}|${DOMAIN}|g" "${APP_DIR}/${DEPLOY_DIR_IN_REPO}/nginx.conf" > "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/neurips2026
# default サイトを無効化（衝突を避ける）
rm -f /etc/nginx/sites-enabled/default

# Let's Encrypt webroot
mkdir -p /var/www/letsencrypt
chown -R www-data:www-data /var/www/letsencrypt

# 一旦 HTTPS ブロックの ssl_certificate 行をコメントアウトしたまま起動
# certbot 取得前は鍵がないので 443 リッスンが失敗する。
# → 一時的に 443 ブロックを無効化
sed -i 's|listen 443 ssl http2;|# listen 443 ssl http2;|' "$NGINX_SITE"
sed -i 's|listen \[::\]:443 ssl http2;|# listen [::]:443 ssl http2;|' "$NGINX_SITE"

nginx -t
systemctl reload nginx

# ====== Let's Encrypt 証明書取得 ======
echo "==> Let's Encrypt 証明書を取得"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect || {
  echo "ERROR: certbot 失敗。DNS が伝播しているか確認してください。"
  exit 1
}

# certbot は自動で 443 ブロックを書き込み、ssl_certificate を設定する。
nginx -t
systemctl reload nginx

# ====== 自動更新の cron ======
echo "==> certbot の自動更新を有効化"
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "==========================================="
echo "  デプロイ完了！"
echo "  → https://${DOMAIN}/"
echo "==========================================="
