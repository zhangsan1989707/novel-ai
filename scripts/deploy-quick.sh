#!/bin/bash

set -e

# 配置
SERVER="root@47.109.85.168"
DEPLOY_DIR="/opt/novel-ai-temp"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始快速部署到服务器..."

# 检查是否安装 sshpass
if ! command -v sshpass &> /dev/null; then
  echo "⚠️ sshpass 未安装，尝试安装..."
  brew install hudochenkov/sshpass/sshpass 2>/dev/null || true
fi

# 密码 (用于自动化)
SSH_PASSWORD="Sfpy5NN;e"

# 1. 生成版本信息
echo "📝 生成版本信息..."
cd "$PROJECT_DIR"
node scripts/generate-version.js

# 2. 使用 rsync 同步变更文件（带密码）
echo "🔄 同步文件到服务器..."
sshpass -p "$SSH_PASSWORD" rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" \
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

# 3. 服务器端部署（快速模式：利用 Docker 缓存）
echo "⚙️ 在服务器上执行部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e
cd /opt/novel-ai-temp

echo "📦 构建 Docker 镜像（使用缓存）..."
docker compose build

echo "🔄 重启容器..."
docker compose up -d --force-recreate

echo "🧩 启用 pgvector 扩展..."
bash scripts/ensure-pgvector.sh docker-compose.yml

echo "⏳ 等待服务启动..."
sleep 15

echo "✅ 检查服务状态..."
docker compose ps
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
