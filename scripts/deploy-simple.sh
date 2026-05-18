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

# 2. 使用 tar+scp 打包上传（简单但可靠，配合 .dockerignore 优化）
echo "🔄 同步文件到服务器..."
cd "$PROJECT_DIR" && rm -f novel-ai-code.tar.gz && \
  COPYFILE_DISABLE=1 tar --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='*.tar.gz' --exclude='*.log' --exclude='.DS_Store' --exclude='._*' -czf novel-ai-code.tar.gz . && \
  sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no novel-ai-code.tar.gz "$SERVER:$DEPLOY_DIR/" && \
  rm -f novel-ai-code.tar.gz

# 3. 服务器端解压和部署
echo "⚙️ 在服务器上执行部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e
cd /opt/novel-ai-temp

echo "📦 解压文件..."
tar -xzf novel-ai-code.tar.gz
rm -f novel-ai-code.tar.gz

echo "🏗️ 构建 Docker 镜像（利用缓存）..."
docker compose build

echo "🔄 重启容器..."
docker compose up -d --force-recreate

echo "⏳ 等待服务启动..."
sleep 25

echo "✅ 检查服务状态..."
docker compose ps
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
