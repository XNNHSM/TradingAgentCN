# 多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制包管理文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产镜像
FROM node:18-alpine AS production

# 创建应用用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# 从构建阶段复制必要文件
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# 创建日志目录
RUN mkdir -p logs && chown nestjs:nodejs logs

# 切换到应用用户
USER nestjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health/check || exit 1

# 启动应用
CMD ["node", "dist/main"]