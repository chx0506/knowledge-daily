# 知乎趣报 · knowledge-daily

每天一份，看山送到的报纸。

知乎趣报把授权后的知乎兴趣信号（关注、收藏、创作、主动选择的领域）和知乎公共内容编成一份**有主线、有判断、有原文**的个性化日报。它不是再给你一条信息流，而是替你完成发现、去重、观点对照和阅读路径。

本仓库是 [知乎黑客松](https://www.zhihu.com/hackathon?activity_code=zhihu_hackathon_2026_p2) 作品：**知识炼金场 / 学习工具与知识生产**。前端是可演示的 iPhone 报纸壳，后端是零依赖的知乎开放平台适配层（schema 4.0）。

---

## 它解决什么

知乎上的经验、回答和收藏很适合学习，但信息流通常只给标题和时间。用户还要自己判断质量、拼接上下文、安排阅读顺序。

趣报做一次「知识炼金」：

- 把分散回答炼成主题脉络
- 把个人关注炼成持续学习方向
- 把不同观点炼成对照关系
- 把长文炼成可吸收的判断、短调研和下一步阅读

每份日报围绕若干领域回答四件事：今天发生了什么、为什么值得你关注、知乎上有哪些不同判断、接下来该打开哪篇原文。

---

## 产品体验

演示页是桌面舞台 + 中间一部 iPhone。手机里有完整 App 流程，右侧是同源数据的桌面小组件预览。

### 主流程

1. **引导**：首次进入选择最多 10 个兴趣领域，点「生成我的第一份报纸」。
2. **看山派送中**：出报 loading 按真实后端步骤推进——读取知乎信号 → 召回内容 → 直答生成领域调研 → 校验引用与排版。
3. **今日一报**：头版先看今天最该理解的事，再横滑推荐 / 财经 / 科技 / 生活 / 文化。
4. **短调研**：每个领域留下数据依据、一句判断、三分钟短调研，以及可点开的真实原文。
5. **发现**：划他人兴趣卡，收下的主题会改明天的编报口味。
6. **日历**：按天横滑回看已送到的旧报。
7. **我的**：改领域、学习方向、篇幅（短读 / 全版）、晨报与周末休刊；有 OAuth 时登录知乎，日报改按你自己的信号来编。
8. **看山地图**：底栏中间的刘看山入口。用 MapLibre 把兴趣网络铺在真实经纬度上，点开明信片邮票看这个人在读什么。

### 桌面小组件

演示页右栏三种皮肤共用同一份今日内容：

| 皮肤 | 说明 |
| --- | --- |
| 纸面 | 日期、判断标题、两行领域条目 |
| 大字报 | 拆行标题 + 一句今日条目 |
| 夜刊 | 号外锁屏风，适合暗色桌面 |

今日一报为空或还在离线样例时，小组件会用样报，避免只剩空壳。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | TypeScript、Vite 7、原生 DOM（无 React/Vue） |
| 地图 | MapLibre GL，底图为 Esri World Street + 高德栅格 |
| 后端 | Node.js ≥ 18，仅用内置模块，**不需要 `npm install`** |
| 数据 | 知乎开放平台（搜索、直答、用户数据、OAuth）；开发可用仿真服务零配额跑通 |

路径别名：`@/` → `src/`。

---

## 仓库结构

```
knowledge-daily/
├── index.html                 # 演示舞台 + iPhone 壳
├── src/
│   ├── main.ts                # 启动：拉今日一报、建 store、挂 shell
│   ├── app/                   # store / actions / 路由 / 小组件
│   ├── screens/               # 各页 render + onMount
│   ├── domain/                # 领域目录、日报类型、计分
│   ├── data/
│   │   ├── remote/            # HTTP 客户端、schema 映射、离线 fixture
│   │   ├── repositories/      # 日报 / 画像 / 偏好 / 旧报归档
│   │   ├── mock/              # 发现页兴趣卡、地图人物、降级样例
│   │   └── pipeline/          # 本地 mock 流水线（不再驱动首页）
│   └── styles/
├── public/                    # 报纸素材、看山 IP、地图邮票与头像
├── server/                    # 知乎适配后端（详见 server/README.md）
├── docs/                      # 黑客松方案与 PRD
└── prototypes/                # 早期 HTML 概念稿
```

加新页面：在 `src/domain/types.ts` 的 `RouteName` 加名字 → `src/screens/` 写 `renderXxx` → 在 `src/app/screens.ts` 注册 theme / hideTabs；需要底栏入口时补 `tabs`。

---

## 数据怎么走

```
知乎开放平台
        ▲
        │  Access Secret / 用户 OAuth
        │
server/（schema 4.0）
  召回 → 去重 → 质量评分 → 领域调研 → 校验
        │
        ▼
Vite 开发代理  /api  →  http://127.0.0.1:3000
        │
src/data/remote/client.ts
        │
remote-edition-repo
  成功 → DailyPaper
  失败 / 超时 / 429 / ?fixture=1 → 真实采样 fixture
        │
        ▼
首页报纸 / 日历归档 / 小组件
```

硬规则（后端保证，前端只展示）：

- `recommended` 的 `source_id` 必须能在 `source_index` 里找到
- 标题、作者、链接、来源类型一律由后端按召回池交叉引用，AI 不许编数字和链接
- 直答只做判断、调研正文和 `why_now`

前端降级纪律：

| 条件 | 行为 |
| --- | --- |
| `?fixture=1` 或 `localStorage["kd.fixture"]="1"` | 直接用 `src/data/remote/fixtures` |
| 后端不可达、超时、5xx、429 | 回退同一份 fixture，并打提示条 |
| 后端 `stale: true`（配额耗尽给了上一期缓存） | 正常展示 + stale 提示 |
| `?fixture=0` | 清掉 fixture 开关，重新打真实接口 |

今日一报 / 画像由 `remote-edition-repo` 驱动。本地 `mock-pipeline` 和 mock provider 只作降级与发现页牌堆，不再驱动首页。

---

## 快速开始

需要 **Node.js 18+**。

### 只看前端（最快）

后端没开时，前端会自动落到离线样例，页面仍可完整体验。

```bash
git clone https://github.com/chx0506/knowledge-daily.git
cd knowledge-daily
npm install
npm run dev
```

浏览器打开 [http://localhost:5173/](http://localhost:5173/)。

强制离线样例：

```text
http://localhost:5173/?fixture=1
```

### 前端 + 仿真后端（不消耗知乎额度）

适合改接口、跑冒烟。原理是把开放平台 origin 指到本地仿真服务，请求不会落到 `openapi.zhihu.com`。

终端 1：仿真开放平台（默认 `3999`）

```bash
cd server
npm run simulate
```

终端 2：业务 API（`3000`）

```bash
cd server
PORT=3000 ZHIHU_ACCESS_SECRET=sim-dummy ZHIHU_API_BASE=http://127.0.0.1:3999 node server.js
```

终端 3：前端（已代理 `/api` → `3000`）

```bash
npm run dev
```

切到自己起的后端实例：

```bash
VITE_API_TARGET=http://127.0.0.1:3001 npm run dev
```

另开终端跑冒烟（76 项）：

```bash
cd server
SMOKE_BASE=http://127.0.0.1:3000 npm run smoke
```

### 接真实知乎开放平台

```bash
cd server
cp .env.example .env
```

| 变量 | 必填 | 来源 |
| --- | :---: | --- |
| `ZHIHU_ACCESS_SECRET` | 是 | [开发者中心](https://developer.zhihu.com/profile) |
| `ZHIHU_OAUTH_APP_ID` | 登录用 | 赛事页队伍详情里的 APP_ID |
| `ZHIHU_OAUTH_APP_KEY` | 登录用 | 同上 KEY |
| `ZHIHU_OAUTH_REDIRECT_URI` | 登录用 | 必须与赛事页登记值完全一致 |

未配 OAuth 时服务照常启动，日报与策展可用；`/api/auth/login` 返回 503。`.env` 已被 gitignore，不要提交。

然后：

```bash
cd server
npm start          # http://127.0.0.1:3000
```

再在仓库根目录 `npm run dev`。开发环境必须走 Vite 代理：后端 CORS 的 `Access-Control-Allow-Origin` 固定为自身源。

---

## 后端要点

完整契约、schema 4.0、配额模型和踩坑记录见 [`server/README.md`](server/README.md)。下面是前端对接时最常用的部分。

### 接口

| 端点 | 说明 |
| --- | --- |
| `GET /api/health` | 服务与配置自检 |
| `GET /api/quota` | 各能力池当日额度 |
| `GET /api/auth/login` | 跳转知乎授权 |
| `GET /api/auth/me` | 当前登录用户 |
| `GET /api/profile` | 兴趣画像（含置信度分层） |
| `GET\|POST /api/profile/preferences` | 学习方向 / 关键词 / 目标 / 屏蔽 |
| `GET /api/daily` | 今日领域日报，`?domains=1..6&ai=false` |
| `POST /api/daily/regenerate` | 重新生成（跳过缓存） |
| `POST /api/feedback` | 日报内反馈 |
| `GET /api/topic/:topic` | 主动策展专题 |

### 日报结构（schema 4.0）

每个领域一份短调研：

1. **有数据表示**：关注、收藏、搜索等真实数字，模板生成，AI 不许改
2. **今日判断 + 短调研**：deep 500–700 字 / standard 350–550 字 / blind 200–300 字
3. **值得看的原文**：链接从召回池回填

篇幅跟画像置信度走。score 最高的领域是主领域，只有它使用推荐问题 + 回答摘要。无信号的领域当天不生成，进入 `skipped_domains`。

### 配额纪律

知乎能力池里 `creator`、`question_answers`、`hot_list` 每天大约 100 次，是硬瓶颈。默认路径把消耗挪到 5,000 次/天的 `zhihu_search` 和直答：

- 冷启动一份 3 领域日报：search ≤ 10 次，creator / question_answers 为 0
- 热榜仅国际领域发现议题；搜索与标签核验走 TTL 缓存和同 key 去重
- 直答失败或 `ai=false` 时降级为规则版调研，结构与 AI 版一致

反馈类型：`interested` / `want_more` / `read` / `mastered` / `review_later` / `irrelevant`。`irrelevant` 累计到 -2 会把该主题移入屏蔽列表。

---

## 常用脚本

仓库根目录：

```bash
npm run dev        # Vite 开发服务，默认 :5173
npm run build      # tsc --noEmit && vite build
npm run preview    # 预览生产构建
```

`server/`：

```bash
npm start          # 业务 API
npm run dev        # --watch 热重启
npm run simulate   # 仿真开放平台
npm run smoke      # 冒烟断言
```

---

## 文档

| 文档 | 内容 |
| --- | --- |
| [`docs/知识日报_黑客松作品方案.md`](docs/知识日报_黑客松作品方案.md) | 定位、栏目、画像、策展流水线、演示脚本 |
| [`docs/PRD_电子报纸独立App.md`](docs/PRD_电子报纸独立App.md) | 独立 App 形态的产品需求 |
| [`server/README.md`](server/README.md) | 后端 API、schema 4.0、配额、仿真与踩坑 |

---

## 许可

私有黑客松作品仓库。知乎开放平台凭证、OAuth token 只存在服务端，请勿把 `.env` 或钥匙串导出结果提交进 git。
