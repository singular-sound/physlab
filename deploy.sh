#!/bin/sh
# 构建并部署到 Cloudflare Pages（项目名 physlab）
# 需要两个环境变量：CLOUDFLARE_ACCOUNT_ID、CLOUDFLARE_API_TOKEN（要有 Pages 写权限）
# 维护者可以把它们写进同目录下的 deploy.local.sh（已被 .gitignore 忽略），这里会自动读取
set -e
cd "$(dirname "$0")"
[ -f ./deploy.local.sh ] && . ./deploy.local.sh
: "${CLOUDFLARE_ACCOUNT_ID:?缺少 CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?缺少 CLOUDFLARE_API_TOKEN}"
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN
python3 build.py
DIST="$(pwd)/dist"
if command -v wrangler >/dev/null 2>&1; then W=wrangler; else W="npx --yes wrangler"; fi
cd /tmp && $W pages deploy "$DIST" --project-name "${PAGES_PROJECT:-physlab}" --branch main --commit-dirty=true
