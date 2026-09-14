# 知日报 · 部署照做清单（Sealos 应用管理）

> 你的 Sealos 工作区**没有 DevBox**，只有「应用商店 / 应用管理 / 数据库 / 对象存储 / 费用中心」。
> 应用管理只接受 **Docker 镜像**，而本机没装 Docker ——
> 所以由 **GitHub Actions 在云端构建镜像**，Sealos 负责拉取运行。
>
> 逐条照做即可，每步都有**预期结果**，对不上看第七节排查。

---

## 路径总览

```
推送代码 → GitHub Actions 自动构建镜像 → 推到 ghcr.io
        → 把镜像改成 Public → Sealos 应用管理填镜像地址 → 部署
        → 拿到公网域名 → 登记 OAuth 回调 → 登录测试
```

---

## 第 1 步 · 触发镜像构建（约 3 分钟）

代码已经推上 main，工作流会自动跑。确认一下：

1. 打开 <https://github.com/chx0506/knowledge-daily/actions>
2. 应看到 **Build and push image** 正在运行（黄色转圈）
3. 等它变成 ✅（约 2–3 分钟）

**预期**：构建成功，日志最后会打印镜像地址。

> 如果没自动触发：点进 workflow → 右侧 **Run workflow** → 选 main → 运行。

**构建出来的镜像地址**：
```
ghcr.io/chx0506/knowledge-daily:latest
```

---

## 第 2 步 · 把镜像改成公开（关键，漏了 Sealos 拉不到）

ghcr 的 package **默认是私有**的，Sealos 无法拉取。

1. 打开 <https://github.com/chx0506?tab=packages>
2. 点进 **knowledge-daily**
3. 右侧 **Package settings** → 拉到底 **Danger Zone**
4. **Change visibility** → 选 **Public** → 输入包名确认

**预期**：package 页面顶部不再显示 "Private"。

> 不想公开也行，但那样要在 Sealos 里填 GitHub 用户名 + Personal Access Token，
> 麻烦且容易出错。黑客松期间公开镜像没问题。

---

## 第 3 步 · 在 Sealos 创建应用（约 5 分钟）

进入 **应用管理** → **创建应用**，按下面填：

| 表单项 | 填什么 |
|---|---|
| 应用名称 | `knowledge-daily` |
| 镜像名称 | `ghcr.io/chx0506/knowledge-daily:latest` |
| 部署模式 | **固定实例**，实例数 `1` |
| 计算资源 | 最小规格即可（0.1 核 / 256MB 起） |
| 网络 · 协议 | **https** |
| 网络 · 端口 | **3000** |

> ⚠️ 端口必须是 **3000**，和后端 `PORT` 一致。
> 协议选 https，Sealos 会自动签发证书。

---

## 第 4 步 · 填环境变量（在同一个创建表单的「高级配置」里）

**先拿到密钥值。** 在**你自己的 Mac** 上执行，把输出复制走：

```bash
cd ~/Documents/kimi/Workspaces/知乎比赛/knowledge-daily/server
grep -E '^(ZHIHU_ACCESS_SECRET|ZHIHU_OAUTH_APP_KEY)=' .env
```

在 Sealos 的**环境变量**区域，逐条添加：

| 变量名 | 值 |
|---|---|
| `PUBLIC_BASE_URL` | 先填 `https://placeholder`，第 5 步拿到域名后回来改 |
| `HOST` | `0.0.0.0` |
| `PORT` | `3000` |
| `ZHIHU_ACCESS_SECRET` | 上面 grep 出来的值 |
| `ZHIHU_OAUTH_APP_ID` | `667` |
| `ZHIHU_OAUTH_APP_KEY` | 上面 grep 出来的值 |
| `ZHIHU_OAUTH_REDIRECT_URI` | 先填 `https://placeholder/api/auth/callback`，第 5 步改 |
| `FREE_SLOT_QUOTA` | `3` |
| `PROFILE_WINDOW_DAYS` | `60` |
| `LOGIN_SUCCESS_REDIRECT` | `/` |

> ⚠️ **`HOST=0.0.0.0` 绝对不能漏。** 漏了服务只绑容器内回环，
> 外部完全访问不到，Sealos 会一直显示未就绪。
>
> ⚠️ 密钥只填在平台的环境变量里，**不要**写进仓库或镜像。

---

## 第 5 步 · 部署并拿到公网域名

点 **部署**，等状态变成 **Running**（约 1–2 分钟）。

然后在应用详情页的**网络 / 访问方式**里找到公网地址，形如：
```
https://xxxxx.<region>.sealos.run
```

**回到第 4 步，把两个占位符改成真实域名**（改完保存，Sealos 会自动重启）：

```
PUBLIC_BASE_URL        = https://你的实际域名
ZHIHU_OAUTH_REDIRECT_URI = https://你的实际域名/api/auth/callback
```

**验证**（在你自己 Mac 上执行）：

```bash
curl -s https://你的域名/api/health | head -c 400
curl -s -o /dev/null -w "%{http_code}\n" https://你的域名/
```

**预期**：健康检查里 `"ok":true` 且 `"missing_env":[]`；首页返回 `200`。

> 首页 200 很关键——它同时证明镜像里的前端产物和后端静态托管都正常。
> 如果首页 404 但 `/api/health` 正常，说明构建时 `dist/` 没进镜像。

---

## 第 6 步 · 登记回调地址（差一个字符就登录失败）

先确认后端生成的地址是什么：

```bash
curl -s "https://你的域名/api/auth/login?format=json"
```

**预期**：返回的 `authorize_url` 里 `app_id=667`，
且 `redirect_uri` **等于** `https://你的域名/api/auth/callback`。

把这个地址登记到知乎开放平台：

```
https://你的域名/api/auth/callback
```

> ⚠️ 路径是 **`/api/auth/callback`**，不是脚手架用的 `/auth/callback`。
> 必须与上面验证出的 `redirect_uri` 完全一致（含 https、无末尾斜杠）。

---

## 第 7 步 · 真实登录测试

1. 浏览器打开 `https://你的域名/`
2. 点「授权知乎账号」
3. **由你本人**在知乎授权页点最终确认（不要代点）
4. 回到应用确认已登录

```bash
curl -s https://你的域名/api/auth/me
# 已登录 → {"logged_in":true,...}
```

---

## 七、排查表

| 症状 | 原因 |
|---|---|
| Actions 里看不到 workflow | workflow 文件没在 main 分支上 |
| Actions 构建失败 | 看日志；多为 `npm ci` 锁文件不一致 |
| Sealos 报镜像拉取失败 | **package 还是 Private**（第 2 步没做） |
| 应用一直未就绪 / 页面打不开 | **`HOST` 没设 `0.0.0.0`**，或端口不是 3000 |
| 首页 404 但 /api 正常 | 镜像里没有 `dist/`，前端没构建进镜像 |
| 登录后回首页仍未登录 | `PUBLIC_BASE_URL` 与实际域名不一致 → Cookie 没带上 |
| 授权页报 redirect_uri 不合法 | 登记值与实际地址不完全一致（注意 `/api/auth/callback`） |
| 授权后 401 | 知乎账号未绑手机号 / 未实名 |
| `/api/health` 报 `missing_env` | 对应环境变量没填或填空 |

---

## 八、环境变量速查

| 变量 | 必填 | 说明 |
|---|:--:|---|
| `PUBLIC_BASE_URL` | ✅ | 公网地址。**同时决定 CORS 白名单与会话 Cookie 的 Secure 标志** |
| `HOST` | ✅ | 必须 `0.0.0.0` |
| `PORT` | ✅ | `3000`，须与 Sealos 网络端口一致 |
| `ZHIHU_ACCESS_SECRET` | ✅ | 内容接口鉴权 |
| `ZHIHU_OAUTH_APP_ID` | 登录必填 | `667` |
| `ZHIHU_OAUTH_APP_KEY` | 登录必填 | 只填平台环境变量，**绝不进仓库/镜像** |
| `ZHIHU_OAUTH_REDIRECT_URI` | 登录必填 | `https://<域名>/api/auth/callback` |

---

## ⚠️ 关于余额

你的工作区余额显示 **¥5.00**。Sealos 按 CPU/内存**按小时计费**，
应用只要处于 Running 状态就会持续扣费。

- 提交后到 9/23（人气奖计分结束）之间需要**一直可访问**
- 建议：部署后去**费用中心**确认实际消耗速率，余额不够及时充值
- 演示/调试期间不用时可以先**暂停应用**，别让它空跑掉余额

---

## 九、后续更新代码怎么办

改完代码推到 main，Actions 会自动重新构建镜像。
但因为镜像标签是 `latest`，需要**在 Sealos 应用里手动触发一次重新部署**
（应用详情 → 变更/重启），才会拉到新镜像。
