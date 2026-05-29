# Novel AI 项目部署指南

## 一、版本信息

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v0.2.0 | 2026-05-25 | RAG 向量检索、分析任务管理、章节提交重播、反检测系统 |
| v0.1.0 | 2026-05-19 | 初始版本，基础创作功能 |

## 二、服务器信息

| 项目 | 值 |
|------|-----|
| 服务器地址 | DEPLOY_SERVER |
| SSH 端口 | 22 |
| 应用端口 | 3200 |
| 部署目录 | /opt/novel-ai |
| 数据库端口 | 5433 (docker-compose 映射自容器 5432) |

## 三、部署流程

### 前置条件

1. **安装 sshpass**
   ```bash
   # macOS
   brew install hudochenkov/sshpass/sshpass
   
   # Ubuntu/Debian
   sudo apt install sshpass
   ```

2. **配置密码文件**
   ```bash
   echo "***" > .deploy-password
   ```

3. **确保密码文件不在 git 版本控制中**
   ```bash
   echo ".deploy-password" >> .gitignore
   ```

4. **数据库要求**
   - PostgreSQL 14+
   - pgvector 扩展（用于 RAG 向量检索）
   - 使用 Docker 部署时已包含 pgvector 支持

### 一键部署

```bash
# 方式一：完整部署（本地构建 + 上传 + 服务器部署）
bash scripts/deploy-full.sh

# 方式二：快速部署（仅上传代码，服务器端构建）
bash scripts/deploy-simple.sh
```

### 手动部署步骤

```bash
# 1. 生成版本信息
node scripts/generate-version.js

# 2. 构建项目
npm run build

# 3. 打包代码
COPYFILE_DISABLE=1 tar --exclude='node_modules' --exclude='.next' --exclude='.git' \
  -czf /tmp/novel-ai-code.tar.gz .

# 4. 上传到服务器
sshpass -p "$SSH_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/novel-ai-code.tar.gz root@DEPLOY_SERVER:/opt/novel-ai/

# 5. 服务器端操作
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no root@DEPLOY_SERVER << 'EOF'
cd /opt/novel-ai
tar -xzf novel-ai-code.tar.gz
npm ci
npx prisma generate

# 初始化 pgvector 扩展
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" novelai-db psql -U novelai -d novel_ai << 'SQLEOF' || true
CREATE EXTENSION IF NOT EXISTS vector;
SQLEOF

# 应用数据库迁移（新增枚举和字段）
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" novelai-db psql -U novelai -d novel_ai << 'SQLEOF' || true
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'ZHIPU';
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'MIMO';
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingVendor" "AIVendor";
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiKey" TEXT;
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiEndpoint" TEXT;
SQLEOF

# 运行数据库迁移
DATABASE_URL='postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5433/novel_ai?schema=public' npx prisma migrate deploy

npm run build

# 清理端口占用并启动
fuser -k 3200/tcp 2>/dev/null || true
sleep 2
PORT=3200 HOSTNAME=0.0.0.0 nohup npx next start -p 3200 > app.log 2>&1 &
EOF
```

## 四、常见问题与解决方案

### 1. 数据库连接失败

**错误信息**：`Authentication failed against database server`

**原因**：docker-compose.db.yml 中数据库端口映射为 `5433:5432`，但代码中 DATABASE_URL 可能配置为 5432

**解决方案**（自动处理）：部署脚本会自动将 `localhost:5432` 替换为 `localhost:5433`

**手动修复**：
```bash
# 修改环境变量
sed -i 's|localhost:5432|localhost:5433|g' .env .env.local
```

### 2. 构建失败（类型错误）

**错误信息**：`Element implicitly has an 'any' type`

**解决方案**：确保 TypeScript 类型正确，使用类型断言或类型转换

### 3. 服务启动失败

**错误信息**：端口被占用

**解决方案**：
```bash
# 查找并杀死占用进程
fuser -k 3200/tcp || true
sleep 2
# 如果使用 Docker
docker compose restart app
# 如果使用直接运行
PORT=3200 HOSTNAME=0.0.0.0 nohup npx next start -p 3200 > app.log 2>&1 &
```

### 3.1 Docker 构建失败

**错误信息**：`failed to walk .next: no such file or directory` 或 standalone 相关错误

**原因**：Next.js 16 的 `output: 'standalone'` 模式可能不生成 `.next/standalone` 目录

**解决方案**：
- Dockerfile 已更新为直接复制 `.next`、`node_modules` 和 `package.json`
- 不再依赖 standalone 模式，使用 `npx next start` 启动应用

### 4. Prisma 迁移失败

**错误信息**：`P1000: Authentication failed`

**解决方案**：
```bash
# 手动指定数据库 URL
DATABASE_URL='postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5433/novel_ai?schema=public' npx prisma migrate deploy
```

### 4.1 数据库枚举/字段缺失

**错误信息**：`The column ai_model_configs.embeddingVendor does not exist` 或 `invalid input value for enum AIVendor: "MIMO"`

**原因**：新增的 AI 厂商（如 ZHIPU、MIMO）或表字段（embeddingVendor 等）未在数据库中应用

**解决方案**：部署脚本已自动处理，手动执行：
```bash
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" novelai-db psql -U novelai -d novel_ai << 'EOF'
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'ZHIPU';
ALTER TYPE "AIVendor" ADD VALUE IF NOT EXISTS 'MIMO';
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingVendor" "AIVendor";
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiKey" TEXT;
ALTER TABLE "ai_model_configs" ADD COLUMN IF NOT EXISTS "embeddingApiEndpoint" TEXT;
EOF
```

### 4.2 pgvector 扩展缺失

**错误信息**：`type "vector" does not exist` 或 `operator does not exist: vector <-> vector`

**原因**：pgvector 扩展未在数据库中启用

**解决方案**：
```bash
docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" novelai-db psql -U novelai -d novel_ai << 'EOF'
CREATE EXTENSION IF NOT EXISTS vector;
EOF
```

### 5. GitHub 无法访问

**错误信息**：`Connection timed out`

**解决方案**：使用本地打包上传方式，不要使用 git clone/pull

## 五、验证部署

```bash
# 检查服务健康状态
curl http://DEPLOY_SERVER:3200/api/health

# 预期响应：
# {"ok":true,"service":"novel-ai","checks":{"database":{"ok":true},"aiConfig":{"ok":true}}}

# 创建测试项目
curl -X POST http://DEPLOY_SERVER:3200/api/novel/projects \
  -H 'Content-Type: application/json' \
  -d '{"title":"测试项目","genre":"玄幻","platform":"QIDIAN","lengthType":"LONG","corePitch":"测试"}'
```

## 六、日志查看

```bash
# 查看应用日志
sshpass -p "$SSH_PASSWORD" ssh root@DEPLOY_SERVER "tail -30 /opt/novel-ai/app.log"

# 查看进程状态
sshpass -p "$SSH_PASSWORD" ssh root@DEPLOY_SERVER "ps aux | grep node"
```

## 七、注意事项

1. **密码安全**：不要将 `.deploy-password` 提交到 git
2. **数据库端口**：docker-compose.db.yml 映射端口为 5433，部署脚本会自动处理
3. **环境变量**：确保 `.env.local` 包含正确的配置
4. **端口冲突**：确保 3200 端口未被其他服务占用（脚本会自动清理）
5. **构建缓存**：服务器端构建可利用 npm ci 缓存
6. **时区设置**：确保服务器时区正确（建议使用 Asia/Shanghai）
7. **Next.js 16 兼容**：Dockerfile 已更新为不依赖 standalone 模式
8. **数据库迁移**：部署脚本会自动检查并应用新增的枚举值和表字段
9. **健康检查**：部署完成后会自动测试 API 连通性
10. **pgvector 扩展**：确保 PostgreSQL 启用 pgvector 扩展用于 RAG 向量检索
11. **RAG 向量重建**：首次部署或更新后，可在项目设置中重建向量索引
12. **AI 厂商配置**：新增支持 ZHIPU（智谱）和 MIMO（秘塔），需在 `.env` 中配置对应密钥