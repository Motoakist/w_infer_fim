# NeurIPS2026 実験 — AWS Lightsail デプロイ手順

本リポジトリ（`exp/` を git ルートとして運用、`deploy/` をサブディレクトリに保持）の静的サイトを AWS Lightsail でホストする手順。

## 構成の前提

- Lightsail Linux インスタンス（Ubuntu 22.04 LTS 推奨、最安 $3.5/mo プラン以上）
- Nginx で静的配信
- HTTPS は Let's Encrypt（無料、要・独自ドメイン）
- ソースは GitHub から `git pull` で更新

**HTTPS は実質必須**。Live2D の CDN スクリプトを `https://` でロードしているため、HTTP 経由でアクセスするとブラウザが Mixed Content ブロックを起こして表情モデルが読み込めない。

---

## Step 0: 事前準備

### GitHub リポジトリの用意

`exp/` ディレクトリ内で git 初期化済みの想定。

```bash
cd /Users/satoumotoaki/Desktop/Thesis/NeurIPS2026/exp
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

> push 時に `src refspec main does not match any` が出たら、ローカルブランチ名が `master` のまま。`git branch -M main` で改名してから再 push。

### 独自ドメイン

- 既に持っているドメインを使うか、お名前.com / Cloudflare Registrar 等で安く購入
- 例: `experiment.example.com` をサブドメインとして用意

---

## Step 1: Lightsail インスタンス作成

1. AWS Lightsail コンソールで **「Create instance」**
2. Region: 東京 (`ap-northeast-1`) など実験対象に近い拠点
3. OS: **Ubuntu 22.04 LTS**（"OS Only" の Linux 系）
4. Plan: $3.5/mo（512MB RAM, 2TB transfer）から始められる
5. Instance name: `neurips2026-exp` 等

### 静的 IP のアタッチ

- Networking タブで **「Create static IP」** → インスタンスにアタッチ
- これでインスタンス再起動しても IP が変わらない

### ファイアウォール

Networking タブ → **「IPv4 Firewall」** で以下を開く（最初から開いている場合あり）:

| Application | Port |
|---|---|
| SSH | 22 |
| HTTP | 80 |
| HTTPS | 443 |

---

## Step 2: ドメインの A レコードを設定

ドメインの DNS 設定で:

| Type | Name | Value |
|---|---|---|
| A | `experiment` | `<静的IP>` |

伝播確認:

```bash
dig experiment.example.com +short
# → 静的IPが返ってくれば OK
```

---

## Step 3: インスタンスにログイン & セットアップ

### SSH 接続

Lightsail コンソールから「SSH using browser」が手っ取り早い。CLI 派なら:

```bash
ssh -i LightsailDefaultKey-ap-northeast-1.pem ubuntu@<静的IP>
```

### ブートストラップスクリプトを実行

```bash
sudo apt update && sudo apt upgrade -y
curl -O https://raw.githubusercontent.com/<USER>/<REPO>/main/deploy/setup.sh
chmod +x setup.sh
sudo ./setup.sh experiment.example.com   # ← ドメイン引数
```

`setup.sh` は以下を自動実行:

1. Nginx インストール
2. リポジトリを `/var/www/neurips2026` にクローン
3. Nginx サイト設定を `/etc/nginx/sites-available/neurips2026` に配置
4. Certbot で Let's Encrypt 証明書取得
5. Nginx 再起動

---

## Step 4: 動作確認

ブラウザで `https://experiment.example.com/` にアクセスして、課題教示画面が表示されれば OK。

DevTools の Console を開いて以下を確認:

- `Live2D init: OK`
- 試行画面で美咲の Live2D が表示される
- スライダーが推薦値と一致すると緑に光る
- 提案後に表情が切り替わる

---

## Step 5: 更新の反映

ローカルで変更 → push:

```bash
cd /Users/satoumotoaki/Desktop/Thesis/NeurIPS2026/exp
git add .
git commit -m "tweak"
git push
```

サーバ側で pull:

```bash
ssh ubuntu@<静的IP>
cd /var/www/neurips2026
sudo git pull
# 静的ファイルだけなので Nginx 再起動は不要
```

`deploy/update.sh` をインスタンスに置けば `sudo /var/www/neurips2026/deploy/update.sh` 一発で更新できる。

---

## トラブルシューティング

### Mixed content blocked

- HTTPS で配信できているか確認（`https://` でアクセス、鍵マークが出るか）
- Let's Encrypt 証明書が取得できていない場合は `sudo certbot --nginx -d experiment.example.com` を再実行

### Live2D が表示されない

- DevTools Console で `Live2D init: FAILED` が出ていないか
- jsdelivr CDN にアクセスできているか（一部ネットワークでブロックされる場合あり）

### 404: stimuli/item1.png

- `git pull` で `stimuli/` 配下の画像が同期されているか確認

---

## Qualtrics 移行時の注意

将来的に Qualtrics に移行する際:

- `main_trial.html` を Qualtrics の Text/Graphic Question に貼る
- `agent_canvas.js`, `table_view.js`, `params.js`, `expression_logic.js`, `main_trial.js` は Qualtrics の Library にアップロードして CDN URL でロード
- Lightsail 上のファイルを `https://experiment.example.com/agent_canvas.js` のように直接参照することも可能

---

## ファイル一覧

- `deploy/setup.sh` — 初期セットアップスクリプト
- `deploy/update.sh` — git pull で更新
- `deploy/nginx.conf` — Nginx サイト設定テンプレート
