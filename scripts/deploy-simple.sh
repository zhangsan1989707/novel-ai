#!/bin/bash

set -e

# 配置
SERVER="root@DEPLOY_SERVER"
DEPLOY_DIR="/opt/novel-ai-temp"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始部署到服务器..."

# 检查是否安装 sshpass
if ! command -v sshpass &> /dev/null; then
  echo "⚠️ sshpass 未安装，尝试安装..."
  brew install hudochenkov/sshpass/sshpass 2>/dev/null || true
fi

# 密码 (用于自动化)
SSH_PASSWORD="${NOVELAI_SSH_PASSWORD:-$(cat .deploy-password 2>/dev/null || true)}"

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

echo "🧩 启用 pgvector 扩展..."
bash scripts/ensure-pgvector.sh docker-compose.yml

echo "🔄 确保数据库迁移已应用..."
# 手动应用未执行的数据库迁移
docker exec -i -e PGPASSWORD=password novelai-db psql -U novelai -d novel_ai << 'SQLEOF' || true
-- 检查并应用 AIVendor 枚举值
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'MIMO';

-- 检查并应用 ai_model_configs 表字段
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingVendor" "AIVendor";
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiKey" TEXT;
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiEndpoint" TEXT;
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
SQLEOF

echo "🏗️ 构建 Docker 镜像（利用缓存）..."
docker compose build

echo "🧹 清理端口占用..."
# 杀死可能存在的旧进程
fuser -k 3200/tcp 2>/dev/null || true
sleep 2

echo "🔄 重启容器..."
docker compose up -d --force-recreate

echo "⏳ 等待服务启动..."
sleep 25

echo "✅ 检查服务状态..."
docker compose ps

echo "🔍 检查应用日志..."
docker logs novel-ai-app-1 --tail 5 || true

echo "🌐 测试 API 连通性..."
curl -sf http://localhost:3200/api/health > /dev/null 2>&1 && echo "✅ 健康检查通过" || echo "⚠️ 健康检查失败，请查看日志"
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://DEPLOY_SERVER:3200"
