#!/bin/bash
# Docker 服务启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 启动 NovelAI Docker 服务...${NC}"

# 检查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，创建默认配置...${NC}"
    cat > .env << 'EOF'
# DeepSeek API
DEEPSEEK_API_KEY=your_api_key_here

# Database (默认值，docker-compose 会覆盖)
DATABASE_URL=postgresql://novelai:password@localhost:5432/novel_ai?schema=public
EOF
    echo -e "${YELLOW}⚠️  请编辑 .env 文件填入您的 API Key${NC}"
fi

# 构建并启动服务
docker-compose up -d --build

bash scripts/ensure-pgvector.sh docker-compose.yml

# 等待服务启动
echo -e "${GREEN}⏳ 等待服务启动...${NC}"
sleep 5

# 显示服务状态
echo ""
echo -e "${GREEN}✅ 服务启动成功！${NC}"
echo ""
echo "📊 服务状态:"
docker-compose ps
echo ""
echo "🌐 访问地址:"
echo "   - 应用: http://localhost:3200"
echo "   - 数据库: localhost:5432"
echo ""
echo "📝 常用命令:"
echo "   - 查看日志: npm run docker:logs"
echo "   - 停止服务: npm run docker:stop"
echo "   - 重启服务: npm run docker:restart"
