#!/bin/bash

set -e

SERVER="root@DEPLOY_SERVER"
DEPLOY_DIR="/opt/novel-ai"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)

echo "🚀 开始部署（npm 方式）..."

if ! command -v sshpass &> /dev/null; then
  echo "⚠️ sshpass 未安装，尝试安装..."
  brew install hudochenkov/sshpass/sshpass 2>/dev/null || true
fi

SSH_PASSWORD="${NOVELAI_SSH_PASSWORD:-$(cat .deploy-password 2>/dev/null || true)}"

echo "📝 生成版本信息..."
cd "$PROJECT_DIR"
node scripts/generate-version.js

echo "📤 提交代码到 GitHub..."
git add -A
git commit -m "deploy: $(date +'%Y-%m-%d %H:%M:%S')" 2>/dev/null || echo "没有新提交"
git push origin dev 2>/dev/null || echo "GitHub 推送失败或已是最新"

echo "⚙️ 在服务器上执行部署..."
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e

DEPLOY_DIR="/opt/novel-ai"
cd "$DEPLOY_DIR"

echo "🔄 拉取最新代码..."
GIT_TERMINAL_PROMPT=0 git fetch origin
GIT_TERMINAL_PROMPT=0 git reset --hard origin/dev

echo "🐳 启动 PostgreSQL 数据库..."
docker compose -f docker-compose.db.yml up -d

echo "🧩 启用 pgvector 扩展..."
bash scripts/ensure-pgvector.sh docker-compose.db.yml

echo "⏳ 等待数据库就绪..."
sleep 10

echo "📦 安装 npm 依赖..."
npm ci

echo "🏗️ 生成 Prisma Client..."
npx prisma generate

echo "🗃️ 运行数据库迁移..."
npx prisma migrate deploy

echo "🏗️ 构建应用..."
npm run build

echo "📋 复制 standalone 所需的静态资源..."
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "🔄 停止旧的应用进程..."
fuser -k 3200/tcp 2>/dev/null || true
sleep 2

echo "🚀 启动应用（standalone 模式）..."
cd .next/standalone
PORT=3200 HOSTNAME=0.0.0.0 nohup node server.js > ../../app.log 2>&1 &
APP_PID=$!
cd ../..

echo "✅ 应用已启动，PID: $APP_PID"

echo "⏳ 等待服务启动..."
sleep 15

echo "🔍 检查服务状态..."
if curl -s -o /dev/null -w '%{http_code}' http://localhost:3200 | grep -q '200\|301\|302'; then
  echo "✅ 服务运行正常！"
else
  echo "⚠️  服务可能未正常响应，检查日志："
  tail -30 app.log
fi

echo ""
echo "📊 进程状态："
ps aux | grep -E "(node.*server\.js|next start)" | grep -v grep || echo "没有找到进程"
EOF

echo ""
echo "✅ 部署完成！"
echo "📍 访问地址: http://DEPLOY_SERVER:3200"
