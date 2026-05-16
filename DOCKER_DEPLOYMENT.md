# Novel AI Docker 部署指南

## 前置要求

1. **Docker Desktop** 已安装并运行
   - 下载地址：https://www.docker.com/products/docker-desktop/
   - 启动 Docker Desktop 并等待完全启动

2. **PostgreSQL 数据库**（如需使用 Docker 启动数据库）
   - 可以使用 Docker Compose 一起启动，或使用外部数据库

## 快速部署

### 1. 配置环境变量

复制 `.env.docker` 为 `.env` 并配置：

```bash
cp .env.docker .env
```

编辑 `.env` 文件，填入实际配置：

```env
DATABASE_URL="postgresql://user:password@db:5432/novel_ai"
DEFAULT_AI_VENDOR="DEEPSEEK"
DEFAULT_AI_MODEL_ID="deepseek-chat"
DEFAULT_AI_API_KEY="your-api-key"
DEEPSEEK_API_KEY="your-deepseek-api-key"
```

### 2. 启动服务

使用 Docker Compose 启动所有服务：

```bash
# 启动服务（前台运行）
docker-compose up

# 或后台运行
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app
```

### 3. 访问应用

服务启动后，访问：http://localhost:3200

## 包含 PostgreSQL 的完整部署

如需同时启动 PostgreSQL 数据库，编辑 `docker-compose.yml`：

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3200:3200"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/novel_ai
      - DEFAULT_AI_VENDOR=${DEFAULT_AI_VENDOR}
      # ... 其他环境变量
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=novel_ai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

然后启动：

```bash
docker-compose up -d

# 等待数据库就绪后，运行数据库迁移
docker-compose exec app npx prisma migrate deploy
```

## 常用命令

### 构建镜像

```bash
docker-compose build --no-cache
```

### 重新构建并启动

```bash
docker-compose down && docker-compose up -d --build
```

### 停止服务

```bash
docker-compose down
```

### 查看容器状态

```bash
docker-compose ps
```

### 进入容器调试

```bash
docker-compose exec app sh
```

### 查看日志

```bash
# 所有服务
docker-compose logs -f

# 仅 app 服务
docker-compose logs -f app

# 最近 100 行
docker-compose logs --tail 100 app
```

### 重启服务

```bash
docker-compose restart app
```

## 生产环境优化

### 使用环境变量文件

生产环境建议使用 `.env.production`：

```bash
docker-compose --env-file .env.production up -d
```

### 健康检查

Docker Compose 已配置健康检查，可以查看容器健康状态：

```bash
docker-compose ps
```

### 日志管理

生产环境建议配置日志轮转：

```yaml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 故障排查

### 1. 容器启动失败

```bash
# 查看详细日志
docker-compose logs app

# 检查配置
docker-compose config
```

### 2. 数据库连接失败

```bash
# 检查数据库是否运行
docker-compose ps db

# 测试数据库连接
docker-compose exec db psql -U postgres -d novel_ai
```

### 3. 端口被占用

修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "3201:3200"  # 映射到 3201 端口
```

### 4. 清理重建

```bash
# 完全清理（包括数据卷）
docker-compose down -v

# 重新构建
docker-compose up -d --build
```

## 更新部署

### 从代码更新

```bash
git pull

# 重新构建并启动
docker-compose up -d --build
```

### 更新依赖

```bash
# 清理缓存重新构建
docker-compose down
docker system prune -f
docker-compose up -d --build
```

## 性能优化

### 构建缓存优化

在开发机器上，确保 `.dockerignore` 正确配置。

### 生产环境建议

1. 使用 CDN 加速静态资源
2. 配置反向代理（Nginx）
3. 启用 HTTPS
4. 配置监控和告警

## 相关文件

- `Dockerfile` - Docker 镜像构建配置
- `docker-compose.yml` - 服务编排配置
- `.env.docker` - 环境变量示例
- `.dockerignore` - 构建排除文件
