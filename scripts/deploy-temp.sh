#!/bin/bash
set -e

# 临时服务器发版脚本
SERVER="root@DEPLOY_SERVER"
PASSWORD="${NOVELAI_SSH_PASSWORD:-$(cat .deploy-password 2>/dev/null || true)}"
DEPLOY_DIR="/opt/novel-ai-temp"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SSHPASS_CMD="sshpass -p '$PASSWORD'"

echo " 开始发版到临时服务器..."

# 1. 生成版本信息
echo "  生成版本信息..."
cd "$PROJECT_DIR"
node scripts/generate-version.js

# 2. 打包上传
echo " 打包并上传代码..."
cd "$PROJECT_DIR"
rm -f novel-ai-code.tar.gz
COPYFILE_DISABLE=1 tar \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='*.tar.gz' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='._*' \
  --exclude='test-results' \
  --exclude='.venv' \
  --exclude='.trae' \
  --exclude='.codebuddy' \
  -czf novel-ai-code.tar.gz .

sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no novel-ai-code.tar.gz "$SERVER:$DEPLOY_DIR/"
rm -f novel-ai-code.tar.gz
echo "✅ 上传完成"

# 3. 服务器端解压、构建、重启
echo "⚙️  构建并部署..."
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" bash -s << 'REMOTE_EOF'
set -e
cd /opt/novel-ai-temp

echo " 解压..."
tar xzf novel-ai-code.tar.gz 2>/dev/null
rm -f novel-ai-code.tar.gz

echo " 构建镜像..."
docker compose build app 2>&1 | tail -3

echo " 重启服务..."
docker compose up -d --force-recreate app
sleep 10

echo "  执行数据库迁移..."
docker compose exec -T app npx prisma migrate deploy
echo "✅ 迁移完成"

sleep 10

echo " 服务状态："
docker compose ps

echo ""
echo " 健康检查："
curl -s http://localhost:3200/api/health
echo ""
REMOTE_EOF

echo ""
echo "✅ 发版完成！"
echo " 访问地址: http://DEPLOY_SERVER:3200"
