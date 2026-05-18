#!/bin/bash

set -e

# 配置
SERVER="root@47.109.85.168"
DEPLOY_DIR="/opt/novel-ai-temp"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始部署到服务器..."

# 1. 生成版本信息
echo "📝 生成版本信息..."
cd "$PROJECT_DIR"
node scripts/generate-version.js

# 2. 使用 rsync 同步变更文件（排除不需要的文件）
echo "🔄 同步文件到服务器..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='*.tar.gz' \
  --exclude='tmp' \
  --exclude='temp' \
  --exclude='.env.local' \
  "$PROJECT_DIR/" \
  "$SERVER:$DEPLOY_DIR/"

# 3. 服务器端部署
echo "⚙️ 在服务器上执行部署..."
ssh "$SERVER" << 'EOF'
set -e
cd /opt/novel-ai-temp

echo "📦 构建 Docker 镜像..."
docker compose build --no-cache

echo "🔄 重启容器..."
docker compose up -d --force-recreate

echo "⏳ 等待服务启动..."
sleep 10

echo "✅ 检查服务状态..."
docker compose ps

echo "📋 最近日志..."
docker compose logs --tail=30
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
