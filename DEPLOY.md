# 知日报 · 部署照做清单（Sealos）

> 逐条复制粘贴即可。每步都有**预期输出**，对不上就停下看第六节排查。
> 目标：拿到公网 HTTPS 地址 → 登记 OAuth 回调 → 完成知乎账号登录。

---

## 为什么必须「单服务同源」

前端调相对路径 `/api/...`，后端 CORS 只放行 `PUBLIC_BASE_URL` 自身源，
且 OAuth 回调要落在同一 origin 才能带上会话 Cookie。
所以线上由 `server/server.js` **同时托管前端 `dist/` 与 `/api`**（已实现）。

---

## 第 0 步 · 注册（约 5 分钟）

1. 打开 <https://cloud.sealos.io> 用手机号注册并登录
2. 登录后能看到「应用管理 / DevBox / 数据库 / 对象存储」等工作台入口

---

## 第 1 步 · 创建 DevBox（约 5 分钟）

1. 进入 **DevBox** → **创建项目**
2. **环境**：选 Node.js（版本 20 或以上）
3. **资源**：**2C4G** 起（构建前端需要内存，1G 容易 OOM）
4. **网络**：暴露端口填 **3000**
5. **仓库**：导入 `chx0506/knowledge-daily`（公开仓库，无需授权）
6. 创建后进入 **Web 终端**

> ⚠️ 确认 Node 版本：
> ```bash
> node -v      # 期望 v20.x 或更高
> ```
> 低于 20 就先升级，否则 Vite 7 会报错。

---

## 第 2 步 · 拉代码并构建（约 3 分钟）

```bash
# 进项目目录（DevBox 一般已 clone 好，没 clone 就执行下面这行）
cd knowledge-daily || git clone https://github.com/chx0506/knowledge-daily.git && cd knowledge-daily

# 确认拉到的是带部署修复的版本（必须看到 0cb1170 或更新）
git log --oneline -1

# 安装依赖
npm install

# 构建前端 → 产出 dist/
npm run build

# 确认产物存在
ls dist/index.html
```

**预期**：`git log` 显示 `0cb1170 后端：适配队友前端契约 + 打通单服务同源部署`；
`ls dist/index.html` 无报错。

> ⚠️ 若 `npm install` 报缓存权限错误（EPERM），改用：
> ```bash
> npm install --cache /tmp/npm-cache
> ```

---

## 第 3 步 · 配置环境变量

**先拿到要填的值。** 在**你自己的 Mac** 上执行下面这条，把输出复制走（会打印密钥，别贴到公开地方）：

```bash
cd ~/Documents/kimi/Workspaces/知乎比赛/knowledge-daily/server
grep -E '^(ZHIHU_ACCESS_SECRET|ZHIHU_OAUTH_APP_KEY)=' .env
```

这条会同时给出 `ZHIHU_ACCESS_SECRET` 和 `ZHIHU_OAUTH_APP_KEY` 两个值，
对应替换下面 `.env` 模板里的 `REPLACE_WITH_ACCESS_SECRET` 和 `REPLACE_WITH_OAUTH_APP_KEY`。

> ⚠️ **本文件不含任何真实密钥**（仓库是公开的）。密钥只存在于你本地的
> `server/.env` 和 Sealos 平台的环境变量/Secret 里，绝不写进仓库。

回到 DevBox 终端，**粘贴下面整段**（占位符替换成真实值）：

```bash
cat > knowledge-daily/server/.env <<'EOF'
PORT=3000
HOST=0.0.0.0
PUBLIC_BASE_URL=https://REPLACE_WITH_YOUR_DOMAIN
ZHIHU_ACCESS_SECRET=REPLACE_WITH_ACCESS_SECRET
ZHIHU_OAUTH_APP_ID=667
ZHIHU_OAUTH_APP_KEY=REPLACE_WITH_OAUTH_APP_KEY
ZHIHU_OAUTH_REDIRECT_URI=https://REPLACE_WITH_YOUR_DOMAIN/api/auth/callback
FREE_SLOT_QUOTA=3
PROFILE_WINDOW_DAYS=60
LOGIN_SUCCESS_REDIRECT=/
EOF
chmod 600 knowledge-daily/server/.env
```

> ⚠️ `PUBLIC_BASE_URL` 和 `ZHIHU_OAUTH_REDIRECT_URI` 里的域名**先留占位符**，
> 第 5 步拿到公网域名后再回来改。**两者必须完全一致**。
>
> ⚠️ `.env` 已在 `.gitignore` 里，不会进仓库。但仍不要把它复制到别处。

---

## 第 4 步 · 启动服务（约 1 分钟）

```bash
cd knowledge-daily
node server/server.js
```

**预期输出**（已按真实运行结果核对）：
```
  知识日报 · 数据接口后端
  监听 http://0.0.0.0:3000
  Access Secret : XXXX...XXXX
  OAuth 凭证    : 已配置
  回调地址      : https://你的域名/api/auth/callback
```

> ⚠️ **监听必须是 `0.0.0.0`**。若显示 `127.0.0.1`，说明 `HOST` 没生效——
> 容器外将完全访问不到，务必检查第 3 步的 `.env`。

**另开一个终端**验证：

```bash
curl -s localhost:3000/api/health | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/
```

**预期**：健康检查返回 `"ok":true`，且 `"missing_env":[]`；首页返回 `200`。

---

## 第 5 步 · 拿到公网地址并回填

1. 在 DevBox 界面找到**外网访问 / 预览地址**（形如 `https://xxxx.<region>.sealos.run`）
2. 用浏览器打开它，**应能看到知日报首页**
3. 回到终端，把域名填进去：

```bash
cd knowledge-daily/server
sed -i 's|REPLACE_WITH_YOUR_DOMAIN|你的实际域名（不含 https://）|g' .env
grep -E 'PUBLIC_BASE_URL|REDIRECT_URI' .env    # 确认已替换
cd .. && kill %1 2>/dev/null; node server/server.js
```

**验证公网可达**：

```bash
curl -s https://你的域名/api/health | grep -o '"ok":true'
curl -s "https://你的域名/api/auth/login?format=json"
```

**预期**：第二条返回的 `authorize_url` 里，`app_id=667`，
且 `redirect_uri` **等于** `https://你的域名/api/auth/callback`。

---

## 第 6 步 · 登记回调地址（关键，差一个字符就失败）

到知乎开放平台，把下面这个地址登记为 OAuth 回调：

```
https://你的域名/api/auth/callback
```

> ⚠️ 路径是 **`/api/auth/callback`**，不是脚手架用的 `/auth/callback`。
> 必须与第 5 步验证出的 `redirect_uri` **完全一致**。

---

## 第 7 步 · 真实登录测试

1. 浏览器打开 `https://你的域名/`
2. 点击「授权知乎账号」
3. **由你本人**在知乎授权页点最终确认（不要代点）
4. 回到应用，确认已显示登录状态

**排查**：
```bash
curl -s https://你的域名/api/auth/me
# 已登录 → {"logged_in":true,...}
# 未登录 → {"logged_in":false,"login_url":...}
```

---

## 第 8 步 · 发布为正式应用（可选但推荐）

DevBox 是开发态入口，长期对外服务建议进 **应用管理（App Launchpad）**：

1. 环境变量照抄第 3 步（改用平台的 **Secret / 环境变量**功能，**不要**写进镜像或源码）
2. 启动命令：`node server/server.js`
3. 端口：`3000`
4. 发布后拿到新的稳定域名 → **回到第 6 步重新登记回调**

> 注意：换域名就必须重新登记回调，否则登录再次失效。

---

## 六、排查表

| 症状 | 原因 |
|---|---|
| 页面打不开但进程在跑 | `HOST` 没设 `0.0.0.0`，或平台暴露端口 ≠ `PORT` |
| 构建 OOM / 卡死 | 资源给到 2C4G 以上 |
| 登录后回首页仍未登录 | `PUBLIC_BASE_URL` 与实际域名不一致 → Cookie 没带上 |
| 授权页报 redirect_uri 不合法 | 登记值与实际地址不完全一致（注意 `/api/auth/callback`） |
| 授权后 401 | 知乎账号未绑手机号 / 未实名 |
| `/api/health` 报 `missing_env` | `.env` 里对应变量为空 |
| 前端白屏 | `dist/` 没构建成功，或构建产物是旧版本 |

---

## 七、环境变量速查

| 变量 | 必填 | 说明 |
|---|:--:|---|
| `PUBLIC_BASE_URL` | ✅ | 公网地址。**同时决定 CORS 白名单与会话 Cookie 的 Secure 标志** |
| `HOST` | ✅ | 容器内必须 `0.0.0.0` |
| `PORT` | | 默认 3000，须与平台暴露端口一致 |
| `ZHIHU_ACCESS_SECRET` | ✅ | 内容接口鉴权 |
| `ZHIHU_OAUTH_APP_ID` | 登录必填 | `667` |
| `ZHIHU_OAUTH_APP_KEY` | 登录必填 | 只放平台 Secret 或本地 `.env`，**绝不进仓库/镜像** |
| `ZHIHU_OAUTH_REDIRECT_URI` | 登录必填 | `https://<域名>/api/auth/callback` |

---

## 附：Docker 部署（备选）

仓库根目录已有 `Dockerfile`（多阶段：构建前端 → 只带产物与零依赖后端）。

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
