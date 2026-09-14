# 知日报 · 部署指南（Sealos）

> 目标：拿到公网 HTTPS 地址 → 登记 OAuth 回调 → 完成知乎账号登录。
> 公网地址是**必交材料**，且 OAuth 登录人数计入人气奖。

---

## 一、为什么必须「单服务同源」

前端调的是相对路径 `/api/...`，后端 CORS 只放行 `PUBLIC_BASE_URL` 自身源，
且 OAuth 回调要落在同一 origin 才能带上会话 Cookie。

因此线上由 `server/server.js` **同时托管前端 `dist/` 与 `/api`**（已实现，静态目录不存在时自动跳过，不影响本地 Vite 开发）。

---

## 二、部署前必看：两个已修掉的坑

| 坑 | 症状 | 已修 |
|---|---|---|
| 监听写死 `127.0.0.1` | 容器内服务外部**完全访问不到**，平台健康检查失败 | 改为 `HOST` 环境变量控制，Dockerfile 里设为 `0.0.0.0` |
| 后端不托管前端 | 前端与 API 不同源，CORS 拦截 + 回调 Cookie 丢失 | 增加静态托管 + SPA 兜底 |

---

## 三、部署步骤（Sealos）

### 1. 注册与登录

访问 <https://cloud.sealos.io> 注册并登录（需手机号）。

### 2. 创建 DevBox 并导入仓库

- 进入 **DevBox** → 创建项目
- 导入 GitHub 仓库 `chx0506/knowledge-daily`（私有仓库需先授权）
- 资源建议：**2C4G** 起
- 网络：暴露 **3000** 端口

> ⚠️ `entrypoint.sh` **只负责启动，不应包含构建步骤**。构建要在开发环境里先做完。

### 3. 在 DevBox 里构建并启动

```bash
# 1) 装依赖并构建前端
cd knowledge-daily
npm install                     # 若 ~/.npm 有 root 文件：npm install --cache /tmp/npm-cache
npm run build                   # 产出 dist/

# 2) 配置环境变量（写入 entrypoint.sh 或平台 Secret，不要提交进仓库）
export PUBLIC_BASE_URL=https://<你的公网域名>
export HOST=0.0.0.0
export PORT=3000
export ZHIHU_ACCESS_SECRET=<开放平台 Access Secret>
export ZHIHU_OAUTH_APP_ID=667
export ZHIHU_OAUTH_APP_KEY=<OAuth App Key>
export ZHIHU_OAUTH_REDIRECT_URI=https://<你的公网域名>/api/auth/callback

# 3) 启动
node server/server.js
```

### 4. 发布为正式应用

DevBox 跑通后，进入 **应用管理（App Launchpad）** 发布，把上面这些环境变量配成平台的
Secret / 环境变量（**不要写进源码或镜像**）。

### 5. 登记回调地址

拿到公网域名后，把下面这个地址登记到知乎开放平台：

```
https://<你的公网域名>/api/auth/callback
```

> ⚠️ **路径是 `/api/auth/callback`**（不是 `/auth/callback`）。
> 必须与开放平台登记值**完全一致**，差一个字符就登录失败。

### 6. 验证

```bash
curl https://<你的公网域名>/api/health
# 期望：ok=true, capabilities.oauth_login=true, missing_env=[]

curl "https://<你的公网域名>/api/auth/login?format=json"
# 期望：authorize_url 里 app_id=667 且 redirect_uri 等于上面登记的地址
```

然后在浏览器打开首页 → 点击授权 → **由本人**在知乎授权页点确认。

---

## 四、用 Docker 部署（备选）

仓库根目录已备好 `Dockerfile`（多阶段：构建前端 → 只带产物与零依赖后端）。

```bash
docker build -t knowledge-daily .
docker run -p 3000:3000 \
  -e PUBLIC_BASE_URL=https://<域名> \
  -e HOST=0.0.0.0 \
  -e ZHIHU_ACCESS_SECRET=... \
  -e ZHIHU_OAUTH_APP_ID=667 \
  -e ZHIHU_OAUTH_APP_KEY=... \
  -e ZHIHU_OAUTH_REDIRECT_URI=https://<域名>/api/auth/callback \
  knowledge-daily
```

---

## 五、环境变量速查

| 变量 | 必填 | 说明 |
|---|:--:|---|
| `PUBLIC_BASE_URL` | ✅ | 部署后的公网地址。**同时决定 CORS 白名单与会话 Cookie 的 Secure 标志** |
| `HOST` | ✅ | 容器内必须 `0.0.0.0` |
| `PORT` | | 默认 3000，需与平台暴露端口一致 |
| `ZHIHU_ACCESS_SECRET` | ✅ | 内容接口鉴权（开放平台） |
| `ZHIHU_OAUTH_APP_ID` | 登录必填 | `667` |
| `ZHIHU_OAUTH_APP_KEY` | 登录必填 | 只放平台 Secret，**绝不进仓库/.env 提交/镜像** |
| `ZHIHU_OAUTH_REDIRECT_URI` | 登录必填 | `https://<域名>/api/auth/callback` |

---

## 六、排查

| 症状 | 原因 |
|---|---|
| 页面打不开但进程在跑 | `HOST` 没设 `0.0.0.0`，或平台暴露端口与 `PORT` 不一致 |
| 登录后回到首页仍未登录 | `PUBLIC_BASE_URL` 与实际域名不一致 → Cookie 未带上 |
| 授权页报 redirect_uri 不合法 | 登记值与实际地址不完全一致（含路径 `/api/auth/callback`） |
| 授权后 401 | 账号未绑手机号 / 未实名 |
