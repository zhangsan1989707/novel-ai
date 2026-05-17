# Node.js 基础镜像
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖（仅生产依赖）
RUN npm ci --omit=dev

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建应用
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 生产阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置目录权限
RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs .next/standalone ./
COPY --from=builder --chown=nextjs:nodejs .next/static ./.next/static

USER nextjs

EXPOSE 3200

ENV PORT 3200
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
