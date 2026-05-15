#!/bin/bash
# Docker 服务停止脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 停止 NovelAI Docker 服务...${NC}"

# 检查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装${NC}"
    exit 1
fi

# 停止并移除容器
docker-compose down

echo -e "${GREEN}✅ 服务已停止${NC}"
echo ""
echo "💡 提示:"
echo "   - 数据卷 (postgres_data) 保留，如需删除使用: docker-compose down -v"
echo "   - 完全清理: docker system prune -a"
