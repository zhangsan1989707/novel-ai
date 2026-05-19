# Novel AI 项目部署指南

## 一、服务器信息

| 项目 | 值 |
|------|-----|
| 服务器地址 | 47.109.85.168 |
| SSH 端口 | 22 |
| 应用端口 | 3200 |
| 部署目录 | /opt/novel-ai |
| 数据库端口 | 5433 (docker-compose 映射自容器 5432) |

## 二、部署流程

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
   echo "Sfpy5NN;e" > .deploy-password
   ```

3. **确保密码文件不在 git 版本控制中**
   ```bash
   echo ".deploy-password" >> .gitignore
   ```

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
sshpass -p "密码" scp -o StrictHostKeyChecking=no /tmp/novel-ai-code.tar.gz root@47.109.85.168:/opt/novel-ai/

# 5. 服务器端操作
sshpass -p "密码" ssh -o StrictHostKeyChecking=no root@47.109.85.168 << 'EOF'
cd /opt/novel-ai
tar -xzf novel-ai-code.tar.gz
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
fuser -k 3200/tcp || true
sleep 2
cd .next/standalone
PORT=3200 HOSTNAME=0.0.0.0 nohup node server.js > ../../app.log 2>&1 &
EOF
```

## 三、常见问题与解决方案

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
fuser -k 3200/tcp
sleep 2
# 重新启动
cd .next/standalone && PORT=3200 HOSTNAME=0.0.0.0 nohup node server.js > ../../app.log 2>&1 &
```

### 4. Prisma 迁移失败

**错误信息**：`P1000: Authentication failed`

**解决方案**：
```bash
# 手动指定数据库 URL
DATABASE_URL='postgresql://novelai:password@localhost:5433/novel_ai?schema=public' npx prisma migrate deploy
```

### 5. GitHub 无法访问

**错误信息**：`Connection timed out`

**解决方案**：使用本地打包上传方式，不要使用 git clone/pull

## 四、验证部署

```bash
# 检查服务健康状态
curl http://47.109.85.168:3200/api/health

# 预期响应：
# {"ok":true,"service":"novel-ai","checks":{"database":{"ok":true},"aiConfig":{"ok":true}}}

# 创建测试项目
curl -X POST http://47.109.85.168:3200/api/novel/projects \
  -H 'Content-Type: application/json' \
  -d '{"title":"测试项目","genre":"玄幻","platform":"QIDIAN","lengthType":"LONG","corePitch":"测试"}'
```

## 五、日志查看

```bash
# 查看应用日志
sshpass -p "密码" ssh root@47.109.85.168 "tail -30 /opt/novel-ai/app.log"

# 查看进程状态
sshpass -p "密码" ssh root@47.109.85.168 "ps aux | grep node"
```

## 六、注意事项

1. **密码安全**：不要将 `.deploy-password` 提交到 git
2. **数据库端口**：docker-compose.db.yml 映射端口为 5433，部署脚本会自动处理
3. **环境变量**：确保 `.env.local` 包含正确的配置
4. **端口冲突**：确保 3200 端口未被其他服务占用
5. **构建缓存**：服务器端构建可利用 npm ci 缓存
6. **时区设置**：确保服务器时区正确（建议使用 Asia/Shanghai）