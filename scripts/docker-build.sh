#!/bin/bash
# Docker 项目构建脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_usage() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -f, --force    强制重新构建，不使用缓存"
    echo "  -n, --no-cache 构建时不使用缓存"
    echo "  -h, --help     显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              # 正常构建"
    echo "  $0 -f           # 强制重新构建"
    echo "  $0 --no-cache   # 不使用缓存构建"
}

# 解析参数
FORCE_BUILD=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force|-n|--no-cache)
            FORCE_BUILD="--no-cache"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 未知选项: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

echo -e "${GREEN}🔨 构建 NovelAI 项目...${NC}"

# 检查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose 未安装${NC}"
    exit 1
fi

# 预构建阶段: 生成 Prisma Client
echo -e "${YELLOW}📦 预生成 Prisma Client...${NC}"
docker run --rm -v "$(pwd):/app" -w /app node:20-alpine sh -c "npm ci && npx prisma generate"

# 构建 Docker 镜像
echo -e "${YELLOW}🐳 构建 Docker 镜像...${NC}"
docker-compose build $FORCE_BUILD

echo -e "${GREEN}✅ 构建完成！${NC}"
echo ""
echo "📝 下一步:"
echo "   - 启动服务: npm run docker:start"
echo "   - 运行测试: npm run docker:test"
