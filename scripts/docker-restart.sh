#!/bin/bash
# Docker 服务重启脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔄 重启 NovelAI Docker 服务...${NC}"

# 检查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装${NC}"
    exit 1
fi

# 重启服务
docker-compose restart

echo -e "${GREEN}✅ 服务已重启！${NC}"
echo ""
docker-compose ps
