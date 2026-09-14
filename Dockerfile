# 知日报 · 单服务同源部署镜像
#
# 为什么必须是「单服务同源」：前端调的是相对路径 /api/...，后端 CORS 只放行
# PUBLIC_BASE_URL 自身源，且知乎 OAuth 回调要落在同一 origin 才能带上会话 Cookie。
# 因此线上由 server/server.js 同时托管前端构建产物 dist/ 与 /api。
#
# 构建：docker build -t knowledge-daily .
# 运行：docker run -p 3000:3000 \
#         -e PUBLIC_BASE_URL=https://<你的域名> \
#         -e ZHIHU_ACCESS_SECRET=... \
#         -e ZHIHU_OAUTH_APP_ID=... \
#         -e ZHIHU_OAUTH_APP_KEY=... \
#         -e ZHIHU_OAUTH_REDIRECT_URI=https://<你的域名>/api/auth/callback \
#         knowledge-daily

# ---------- 构建阶段：编译前端 ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- 运行阶段：只带产物与零依赖后端 ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# 容器内必须监听 0.0.0.0，否则平台路由无法把流量转发进来
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY server ./server

# 后端零 npm 依赖（仅 node 内置模块），无需 node_modules
EXPOSE 3000
CMD ["node", "server/server.js"]
