# 部署优化方案

## 当前部署流程的瓶颈

1. **每次传输所有文件**：使用 tar+scp 方式，即使只修改一行代码也要上传整个项目
2. **服务器上构建慢**：每次部署都在服务器上执行 npm install 和 next build
3. **没有充分利用缓存**：Docker 缓存利用不够充分

## 优化方案

### 方案一：快速同步（推荐日常使用）- `npm run deploy:quick`

- 使用 rsync 只同步变更的文件
- 服务器上利用 Docker 缓存构建
- 适合日常小改动的快速部署

### 方案二：简单可靠（默认）- `npm run deploy`

- 使用 tar+scp 上传（已优化，排除 macOS 元数据文件）
- 服务器上完整构建
- 适合第一次部署或重大变更

### 方案三：极速部署（本地构建）- `npm run deploy:fast`

- 本地构建 Docker 镜像
- 压缩镜像上传
- 服务器直接加载镜像
- 最快，但需要本地 Docker 环境

## 使用方法

### 日常开发部署
```bash
# 快速同步变更并部署
npm run deploy:quick
```

### 完整部署
```bash
# 完整可靠的部署
npm run deploy
```

### 极速部署（需要本地 Docker）
```bash
# 本地构建镜像并上传（最快）
npm run deploy:fast
```

## 优化细节

### 1. tar 打包优化
- 添加 `COPYFILE_DISABLE=1` 环境变量避免 macOS 扩展属性
- 排除 `._*` 文件（macOS 资源分支）
- 使用 `.dockerignore` 排除不必要的文件

### 2. Docker 构建缓存
- Dockerfile 使用多阶段构建
- 先复制 package.json 安装依赖，再复制源码
- 充分利用 Docker 层缓存

### 3. 文件同步优化
- rsync 使用 `-avz` 参数：归档模式、压缩、只同步变更
- `--delete` 删除服务器上已不存在的文件

## 各方案对比

| 方案 | 速度 | 复杂度 | 适用场景 |
|------|------|--------|----------|
| deploy:quick | 快 | 低 | 日常小改动 |
| deploy | 中 | 低 | 完整部署 |
| deploy:fast | 极快 | 中 | 需要本地 Docker |
