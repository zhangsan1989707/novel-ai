#!/bin/bash

set -e

# 配置
SERVER="root@47.109.85.168"
DEPLOY_DIR="/opt/novel-ai-temp"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始部署到服务器..."

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

# 2. 先检查并尝试安装 rsync 在服务器上
echo "🔧 检查服务器环境..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" 'command -v rsync &> /dev/null || (apt update && apt install -y rsync)' || true

# 3. 先尝试使用 rsync，如果失败则使用 tar+scp
echo "🔄 同步文件到服务器..."
if sshpass -p "$SSH_PASSWORD" rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" \
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
  "$SERVER:$DEPLOY_DIR/"; then
  echo "✅ rsync 同步完成"
else
  echo "⚠️ rsync 不可用，使用 tar+scp 模式..."
  cd "$PROJECT_DIR" && rm -f novel-ai-code.tar.gz && tar --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='*.tar.gz' -czf novel-ai-code.tar.gz . && sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no novel-ai-code.tar.gz "$SERVER:$DEPLOY_DIR/" && rm -f novel-ai-code.tar.gz
  echo "📦 解压文件..."
  sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $DEPLOY_DIR && rm -f version-info.txt && tar -xzf novel-ai-code.tar.gz && rm -f novel-ai-code.tar.gz"
fi

# 4. 服务器端部署
echo "⚙️ 在服务器上执行部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e
cd /opt/novel-ai-temp

echo "📦 构建 Docker 镜像..."
docker compose build

echo "🔄 重启容器..."
docker compose up -d --force-recreate

echo "🧩 启用 pgvector 扩展..."
bash scripts/ensure-pgvector.sh docker-compose.yml

echo "⏳ 等待服务启动..."
sleep 20

echo "✅ 检查服务状态..."
docker compose ps

echo "📋 最近日志..."
docker compose logs --tail=20
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
