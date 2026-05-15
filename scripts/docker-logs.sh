#!/bin/bash
# Docker 服务状态查看脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📊 NovelAI 服务状态${NC}"
echo "========================"
echo ""

# 检查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装${NC}"
    exit 1
fi

docker-compose ps

echo ""
echo "📜 最近日志 (最后 50 行):"
echo "========================"
docker-compose logs --tail=50
