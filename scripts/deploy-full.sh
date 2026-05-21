#!/bin/bash

# ============================================================
# Novel AI 项目部署脚本
# 版本: v2.0
# 适用: 阿里云 ECS 服务器
# 更新: 2026-05-21 - 支持 Next.js 16，添加数据库迁移，改进错误处理
# ============================================================

set -e

# --------------------------
# 配置项
# --------------------------
SERVER="root@47.109.85.168"
DEPLOY_DIR="/opt/novel-ai"
PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SSH_PASSWORD_FILE="$PROJECT_DIR/.deploy-password"

# --------------------------
# 函数定义
# --------------------------

error_exit() {
    echo "❌ 错误: $1" >&2
    exit 1
}

check_prerequisites() {
    echo "🔍 检查前置条件..."
    
    # 检查 sshpass
    if ! command -v sshpass &> /dev/null; then
        echo "⚠️ sshpass 未安装，尝试安装..."
        if command -v brew &> /dev/null; then
            brew install hudochenkov/sshpass/sshpass 2>/dev/null || true
        else
            error_exit "请手动安装 sshpass: sudo apt install sshpass 或 brew install hudochenkov/sshpass/sshpass"
        fi
    fi
    
    # 检查密码文件
    if [ ! -f "$SSH_PASSWORD_FILE" ]; then
        error_exit "密码文件不存在: $SSH_PASSWORD_FILE"
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        error_exit "npm 未安装"
    fi
    
    echo "✅ 前置条件检查通过"
}

load_password() {
    SSH_PASSWORD=$(cat "$SSH_PASSWORD_FILE" 2>/dev/null)
    if [ -z "$SSH_PASSWORD" ]; then
        error_exit "密码文件为空"
    fi
}

build_project() {
    echo "🏗️ 构建项目..."
    
    cd "$PROJECT_DIR"
    
    # 生成版本信息
    echo "📝 生成版本信息..."
    node scripts/generate-version.js
    
    # 构建应用
    echo "🔨 执行 npm run build..."
    npm run build
    
    echo "✅ 构建完成"
}

package_code() {
    echo "📦 打包代码..."
    
    cd "$PROJECT_DIR"
    
    # 清理旧的打包文件
    rm -f /tmp/novel-ai-code.tar.gz
    
    # 打包（排除不必要的文件）
    COPYFILE_DISABLE=1 tar --exclude='node_modules' \
                           --exclude='.next' \
                           --exclude='.git' \
                           --exclude='*.tar.gz' \
                           --exclude='*.log' \
                           --exclude='.DS_Store' \
                           --exclude='._*' \
                           -czf /tmp/novel-ai-code.tar.gz .
    
    echo "✅ 打包完成"
}

upload_code() {
    echo "⬆️ 上传代码到服务器..."
    
    sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/novel-ai-code.tar.gz "$SERVER:$DEPLOY_DIR/"
    
    echo "✅ 上传完成"
}

deploy_on_server() {
    echo "⚙️ 在服务器上部署..."
    
    sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" << 'EOF'
set -e

DEPLOY_DIR="/opt/novel-ai"

cd "$DEPLOY_DIR"

echo "📦 解压文件..."
tar -xzf novel-ai-code.tar.gz 2>/dev/null || true
rm -f novel-ai-code.tar.gz

echo "🔧 修复数据库端口配置（docker-compose.db.yml 映射端口为 5433）..."
sed -i 's|localhost:5432|localhost:5433|g' .env .env.local 2>/dev/null || true

echo "🐳 启动数据库..."
docker compose -f docker-compose.db.yml up -d 2>/dev/null || true

echo "🧩 启用 pgvector 扩展..."
bash scripts/ensure-pgvector.sh docker-compose.db.yml

echo "⏳ 等待数据库就绪..."
sleep 5

echo "🔄 确保数据库迁移已应用..."
# 手动应用未执行的数据库迁移（幂等操作，可安全重复执行）
docker exec -i -e PGPASSWORD=password novelai-db psql -U novelai -d novel_ai << 'SQLEOF' || true
-- 检查并应用 AIVendor 枚举值
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'MIMO';

-- 检查并应用 ai_model_configs 表字段
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingVendor" "AIVendor";
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiKey" TEXT;
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiEndpoint" TEXT;
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
SQLEOF

echo "📦 安装依赖..."
npm ci

echo "🏗️ 生成 Prisma Client..."
npx prisma generate

echo "🏗️ 构建应用..."
npm run build

echo "⏹️ 停止旧进程..."
fuser -k 3200/tcp 2>/dev/null || true
sleep 2

echo "🚀 启动应用..."
PORT=3200 HOSTNAME=0.0.0.0 nohup npx next start -p 3200 > app.log 2>&1 &
APP_PID=$!

echo "✅ 应用已启动，PID: $APP_PID"

echo "⏳ 等待服务启动..."
sleep 15

echo "🔍 检查服务状态..."
if curl -s -o /dev/null -w '%{http_code}' http://localhost:3200 | grep -q '200\|301\|302'; then
  echo "✅ 服务运行正常！"
else
  echo "⚠️ 服务可能未正常响应，检查日志："
  tail -30 app.log
fi

echo ""
echo "📊 进程状态："
ps aux | grep -E "(node.*server\.js|next start)" | grep -v grep || echo "没有找到进程"
EOF
    
    echo "✅ 服务器部署完成"
}

verify_deployment() {
    echo "🔍 验证部署..."
    
    sleep 5
    
    # 检查 API 健康状态
    local health_response
    health_response=$(sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER" "curl -s http://localhost:3200/api/health")
    
    if echo "$health_response" | grep -q '"ok":true'; then
        echo "✅ API 健康检查通过"
    else
        echo "❌ API 健康检查失败"
        echo "响应: $health_response"
    fi
    
    echo ""
    echo "📍 访问地址: http://47.109.85.168:3200"
}

# --------------------------
# 主流程
# --------------------------

echo "🚀 Novel AI 部署脚本 v2.0"
echo "======================"

check_prerequisites
load_password

build_project
package_code
upload_code
deploy_on_server
verify_deployment

echo ""
echo "🎉 部署流程完成！"
echo "📍 访问地址: http://47.109.85.168:3200"
echo "📝 日志文件: $DEPLOY_DIR/app.log"
