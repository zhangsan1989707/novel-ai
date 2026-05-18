#!/bin/bash

set -e

# 配置
SERVER="root@47.109.85.168"
IMAGE_NAME="novel-ai-app"
IMAGE_TAG="latest"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始快速部署（本地构建 + 镜像上传）..."

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

# 2. 本地构建 Docker 镜像（AMD64 平台，兼容服务器）
echo "🏗️ 本地构建 Docker 镜像 (AMD64)..."
cd "$PROJECT_DIR"
docker build --platform linux/amd64 -t ${IMAGE_NAME}:${IMAGE_TAG} .

# 3. 保存镜像为 tar 文件
echo "📦 压缩镜像..."
docker save ${IMAGE_NAME}:${IMAGE_TAG} | gzip > ${IMAGE_NAME}-image.tar.gz

# 4. 上传镜像到服务器
echo "⬆️ 上传镜像到服务器..."
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no ${IMAGE_NAME}-image.tar.gz "$SERVER:/tmp/"

# 5. 清理本地镜像文件
echo "🧹 清理本地临时文件..."
rm -f ${IMAGE_NAME}-image.tar.gz

# 6. 服务器端加载镜像并部署
echo "⚙️ 在服务器上部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e

# 配置
IMAGE_NAME="novel-ai-app"
IMAGE_TAG="latest"
DEPLOY_DIR="/opt/novel-ai-temp"

cd /tmp

echo "📥 加载 Docker 镜像..."
docker load -i ${IMAGE_NAME}-image.tar.gz
rm -f ${IMAGE_NAME}-image.tar.gz

echo "🔄 停止旧容器..."
cd "$DEPLOY_DIR"
docker compose down || true

echo "🚀 启动新容器..."
docker compose up -d --force-recreate

echo "⏳ 等待服务启动..."
sleep 20

echo "✅ 检查服务状态..."
docker compose ps
EOF

echo ""
echo "✅ 快速部署完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
