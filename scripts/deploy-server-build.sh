#!/bin/bash

set -e

SERVER="root@47.109.85.168"
DEPLOY_DIR="/opt/novel-ai"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始部署（服务器端构建）..."

if ! command -v sshpass &> /dev/null; then
  echo "⚠️ sshpass 未安装，尝试安装..."
  brew install hudochenkov/sshpass/sshpass 2>/dev/null || true
fi

SSH_PASSWORD="Sfpy5NN;e"

echo "📝 生成版本信息..."
cd "$PROJECT_DIR"
node scripts/generate-version.js

echo "📤 提交代码到 GitHub..."
git add -A
git commit -m "deploy: $(date +'%Y-%m-%d %H:%M:%S')" || echo "没有新提交"
git push origin dev || echo "GitHub 推送失败"

echo "⚙️ 在服务器上执行部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e

DEPLOY_DIR="/opt/novel-ai"
GITHUB_REPO="https://github.com/zhangsan1989707/novel-ai.git"
BRANCH="dev"

echo "📦 拉取最新代码..."
cd "$DEPLOY_DIR"
git stash || true
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH

echo "🏗️ 构建 Docker 镜像..."
docker build --platform linux/amd64 -t novel-ai-app:latest .

echo "🔄 重启容器..."
docker compose down || true
docker compose up -d --force-recreate

echo "🧩 启用 pgvector 扩展..."
bash scripts/ensure-pgvector.sh docker-compose.yml

echo "⏳ 等待服务启动..."
sleep 30

echo "✅ 检查服务状态..."
docker compose ps
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
