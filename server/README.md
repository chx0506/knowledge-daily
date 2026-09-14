# 知识日报 · 数据接口后端

零依赖 Node 服务（仅用内置模块，**不需要 `npm install`**）。
封装知乎开放平台，按用户画像输出「领域日报」（schema 4.0）：每个领域一份短调研 ——
有数据表示 → 今日判断 + 短调研 → 值得看的原文，另含兴趣画像与知乎登录能力。

对应方案：`../../知识日报_黑客松作品方案.md`

---

## 快速开始

```bash
cd server
cp .env.example .env      # 填入凭证
npm start                 # http://127.0.0.1:3000
npm run smoke             # 另开终端跑冒烟测试（50+ 项）
```

Node ≥ 18（需要内置 `fetch`）。已验证 v24.15.0。

---

## 环境变量

| 变量 | 必填 | 从哪来 |
|---|:--:|---|
| `ZHIHU_ACCESS_SECRET` | 是 | <https://developer.zhihu.com/profile> |
| `ZHIHU_OAUTH_APP_ID` | 登录功能必填 | 赛事页面「查看分配的三方应用的 APP_ID 和 KEY」 |
| `ZHIHU_OAUTH_APP_KEY` | 登录功能必填 | 同上 |
| `ZHIHU_OAUTH_REDIRECT_URI` | 登录功能必填 | 必须与赛事页面登记值**完全一致** |

赛事页面：<https://www.zhihu.com/hackathon?activity_code=zhihu_hackathon_2026_p2>

**未配置 OAuth 时服务照常启动**，内容与策展接口全部可用，仅 `/api/auth/login` 返回 503 并提示领取入口。

macOS 取 Access Secret：`security find-generic-password -s zhihu-cli -w`
（钥匙串带 `go-keyring-base64:` 前缀，服务已内置自动解码）

---

## API

| 端点 | 说明 |
|---|---|
| `GET /api/health` | 服务与配置自检 |
| `GET /api/quota` | 9 个能力池当日额度，`bottleneck` 标出 100 额度的瓶颈池 |
| `GET /api/auth/login` | 跳转知乎授权（`?format=json` 只返回 URL）|
| `GET /api/auth/callback` | 回调，校验 state 后换 token 建会话 |
| `GET /api/auth/me` | 当前登录用户 |
| `POST /api/auth/logout` | 退出 |
| `GET /api/profile` | 兴趣画像（含置信度分层）|
| `GET\|POST /api/profile/preferences` | 学习方向 / 关键词 / 学习目标 / 屏蔽主题 |
| `GET /api/daily` | 今日领域日报（schema 4.0），`?domains=1..6&ai=false`，默认生成 3 个领域 |
| `POST /api/daily/regenerate` | 重新生成（跳过缓存）|
| `POST /api/feedback` | 日报内反馈（topic 可传领域名或主题名）|
| `GET /api/topic/:topic` | 主动策展专题（复用领域引擎的临时领域）|

### 日报响应结构（schema 4.0）

```jsonc
{
  "schema_version": "4.0",
  "daily_id": "d_20260913_self",
  "date": "2026-09-13",
  "profile": { /* 画像，含 tags[].confidence_tier（已剥离内部信号字段）*/ },

  "mainline": {                    // 推荐页聚合
    "judgement": "今日主线（取主领域判断）",
    "first_read": { "domain_id": "tech", "name": "科技",
      "reason": "依据最强（信号分 9），置信度最高" },
    "basis_text": "今日从个人内容 X 篇、知乎搜索 Y 篇、问题回答 Q 篇中，综合 Z 篇生成。热榜仅用于发现议题。",
    "total_synthesized": 19        // = 各领域 synthesized_count 之和，后端计算
  },

  "domains": [{                   // 每个领域一份短调研
    "domain_id": "tech", "name": "科技",
    "tier": "deep",               // deep 500–700字 | standard 350–550字 | blind 200–300字
    "basis": {                    // ① 有数据表示（模板生成，数字真实）
      "text": "根据你关注的 X 位相关创作者、收藏夹「…」N 篇…今日综合知乎 16 篇…",
      "signals": { "followees": 0, "favorite_lists": 0, "favorite_items": 0,
        "own_contents": 0, "directions": 0 },
      "synthesized_count": 16,
      "breakdown": { "search": 10, "personal": 4, "question_answers": 2 },
      "hot_discovery_only": false
    },
    "judgement": "今日判断一句话",   // ② 判断 + 短调研（3 段）
    "report": "短调研正文…",
    "recommended": [{             // ③ 值得看的原文（链接由后端从召回池取回，保证真实）
      "source_id": "src_xxx", "title": "...", "author": "...",
      "source_type": "关注|收藏|创作|搜索", "why_now": "为什么现在读",
      "url": "https://..."
    }],
    "source_index": [{ "source_id": "src_xxx", "title": "...",
      "source_type": "搜索", "url": "https://...", "cited": true }],
    "generated_by": "zhida"       // 或 rule_fallback（直答降级，结构完全一致）
  }],

  "skipped_domains": [{ "domain_id": "life", "name": "生活",
    "reason": "无信号依据，今日未生成" }],
  "stale": false,
  "warnings": []
}
```

**硬规则：`recommended` 的 `source_id` 必须能在 `source_index` 中找到；标题/作者/链接/来源类型
一律由后端按真实召回池交叉引用计算（URL 命中收藏 → 收藏、命中创作 → 创作、作者命中关注 → 关注），
AI 只产出判断、调研正文与 why_now，不允许编造数字与链接。**

### 反馈类型

```
interested  want_more  read  mastered  review_later  irrelevant
```

`irrelevant` 累计到 -2 会把该主题移入屏蔽列表并挤出画像（已实测生效）。

---

## 架构

```
server.js              HTTP 路由与错误映射
└── src/
    ├── config.js        .env 加载、配置自检、钥匙串格式兼容
    ├── cache.js         TTL 缓存 + 同 key 并发去重
    ├── zhihu-client.js  开放平台客户端、直答、OAuth、int64 安全解析
    ├── session.js       会话与 state 签发 / 校验 / 原子消费
    ├── preferences.js   学习方向与日报反馈存储
    ├── profile.js       画像引擎（探测 → 提取 → 复查，复查走共享缓存）
    ├── curator.js       召回原语 + 去重/评分 + 领域调研（直答/规则降级）
    ├── domains.js       领域引擎（6 领域定义、依据打分、配额纪律召回）
    └── daily.js         领域日报组装（schema 4.0）
```

### 策展流水线（schema 4.0）

```
召回 → 去重 → 质量评分 → 领域调研 → 校验
```

- **召回**：主领域用 推荐问题 + lead question 回答摘要 + 知乎搜索；其余领域仅搜索；
  个人收藏/创作中命中领域关键词的条目（各 ≤3 条）直接入池
- **去重**：URL 相同或「标题+摘要」指纹相同即合并
- **质量评分**：`兴趣 0.30 + 质量 0.25 + 时效 0.15 + 观点 0.15 + 学习增益 0.15`（方案第 6 节）
- **领域调研**：一次直答产出 judgement + 3 段短调研 + recommended(source_id, why_now)；
  依据数字由后端算好注入 prompt，AI 不许编数字
- **校验**：剔除悬空 source_id、不足篇数用池内高分条目补齐；judgement ≤60 字、report ≤800 字截断

直答只做**摘要与归纳**，事实与链接一律取自已召回的知乎原文，避免结论无法追溯。

### 领域与篇幅档位（设计文案：篇幅跟画像置信度走）

领域目录是**动态的**（D1）：候选 10 个领域（原 6 个 + 游戏/设计/科学/旅行），
统一按画像信号打分收录，`?domains=N` 取 top-N（上限 = 目录大小，`GET /api/health`
的 `domain_catalog` 可查）。画像无相关信号时新领域得分 < 2 自动进 skipped，
行为与原有 6 领域完全一致。每个领域带 `defaultQuery`（无信号补盲时的检索词）
与 `workflow` 引用（见下「领域工作流」）。

| 领域 | 只调研什么 | 无依据策略 |
|---|---|---|
| 科技 | 你所在的产品/工具市场进展 | 允许补盲 |
| 财经 | 这件事怎么变成一笔可解释的钱 | 允许补盲（缩短）|
| 国内 | 工作变化如何改居住和在场 | 无信号则跳过 |
| 国际 | 外部讨论如何反衬你的流程问题 | 热榜驱动，允许补盲（最短）|
| 生活 | 工作闭环征走了哪一块身体 | 无信号则跳过 |
| 文化 | 用什么方法把判断留在自己手里 | 无信号则跳过 |
| 游戏 / 设计 / 科学 / 旅行 | 见 `src/workflows.js` 各领域角度 | 无信号则跳过 |

依据打分：directions×3、keywords×1、收藏夹×2、收藏内容×1、本人创作×1、关注签名×0.5、画像 tag×2。
score ≥ 5 或命中主方向/top tag → deep（500–700 字 + 荐 3 篇）；score ≥ 2 → standard（350–550 字 + 3 篇）；
补盲 → blind（200–300 字 + 2 篇）。score 最高的领域为「主领域」，只有它使用 recommend + answers。

### 领域工作流（F1）

`src/workflows.js` 为每个领域定义：拆解角度（angles）、召回 query 列表（queries）、
直答提示段（promptHint）。召回时 standard/blind 用 1 个 query（无信号用 `defaultQuery`），
deep 档追加第二个角度（≤2 次搜索，仍走 query 级缓存）；直答 prompt 注入对应提示段，
禁元评论规则与校验逻辑不变。

### 增量字段（纯增量，不改既有契约）

- `domains[].recommended[].author_url` / `source_index[].author_url`（C1）：
  仅当上游带回 `UrlToken` 时为 `https://www.zhihu.com/people/{url_token}`，否则 `null`，绝不编造
- `metrics`（B2，仅 `/api/daily` 与 `/api/daily/regenerate`）：
  `{ total_ms, steps: { profile_ms, domains_ms, mainline_ms },
     api_calls: { total, by_endpoint }, sources: { search, personal, question_answers, total } }`
  API 计数在 `zhihu-client.js` 统一出口埋点（AsyncLocalStorage 按请求归因）；
  缓存命中时 `api_calls.total` 自然为 0

### 兴趣置信度分层（方案 5.1）

| 层级 | 信号 |
|---|---|
| **high** | 用户主动选择的学习方向、收藏夹、收藏内容 |
| **medium** | 本人创作、关注创作者、正向反馈 |
| **low** | 平台推荐、冷启动预设 |

平台侧 `question recommend` 在账号样本稀疏时会返回泛人生向问题
（实测返回过「追妻小说」），**只作辅助发现，不作最终画像**。
该探测走 creator 池（100 次/天），由 `PROFILE_PLATFORM_PROBE` 控制：
**缺省 off**（`platform_recommendation.items` 返回空数组并附说明，画像其余字段不受影响）；
`=1` 开启后每用户每画像周期（画像缓存 24h）消耗 1 点 creator。

### 配额保护

实测三个池每日仅 100 次，是架构硬瓶颈。**任务五后默认路径对 creator 与
question_answers 两池的消耗为 0**，成本全部挪到 5,000 次/天的 `zhihu_search`：

| 池 | 每日 | 用途 |
|---|---:|---|
| `hot_list` | 100 | 热榜（仅 world 领域用于发现议题）|
| `creator` | 100 | 仅平台画像探测（`PROFILE_PLATFORM_PROBE=1` 时启用，缺省 off）|
| `question_answers` | 100 | 默认路径已不使用（留作后续按需启用）|
| `zhihu_search` | 5,000 | 搜索（领域召回每领域 ≤2 次 + 画像标签核验 ≤4 次）|
| `zhida_openai` | 5,000 | 直答策展（每领域 1 次）|

4.0 成本模型（默认 `domains=3`，缓存全冷）：每领域 1 次 search 与 zhida
（blind / deep 档按工作流追加第 2 个角度 query，≤2 次 search）+ 画像标签核验
≤4 次 search（`qverify:` 缓存 6h、跨用户共享，摊薄后远低于 4 次）；world 如需
补盲再加 1 次热榜；画像行为数据（user_data）4–5 次、24h 缓存摊薄。
**单次冷日报 search ≤10 次**（3 领域 ×≤2 + 核验 ≤4），creator / question_answers 为 0。
措施：热榜缓存 45 分钟全站共享；搜索 2 小时、标签核验 6 小时跨用户复用；
同 key 并发只发一次远端（实测 5 并发 → 额度 +1）；领域串行处理不并发放大。

容量估算（以 `zhihu_search` 5,000 次/天为瓶颈）：

- 重度场景：每活跃用户日均 5 次全冷生成 → 5,000 ÷ (10 × 5) ≈ **100 活跃用户/天**
- 常态场景：缓存命中良好、每用户日均 2 次全冷生成 → 5,000 ÷ (10 × 2) ≈ **250 活跃用户/天**
- creator 池不再是瓶颈：默认路径消耗为 0；即便全量用户开 probe，
  100 次/天也对应 100 个画像周期/天（画像缓存 24h）

---

## 降级策略（方案 11 必做项）

| 场景 | 行为 |
|---|---|
| 直答失败 / 超时 / `ai=false` | 降级到规则版领域调研，`generated_by: rule_fallback`，结构与 AI 版完全一致 |
| 部分领域直答失败 | `data_source.curation: mixed`，其余领域不受影响 |
| 额度耗尽 (30002) | 返回上一期缓存 + `stale: true` 与说明文案，不伪造内容 |
| 鉴权失败 (20001) | 401 并引导重新授权，**不回退到 Access Secret 账号** |
| 领域无信号依据 | 当天不生成，列入 `skipped_domains` 并给出原因 |
| 领域召回为空 | 列入 `skipped_domains`，原因说明未召回到相关内容 |

---

## 安全

- `app_key`、Access Secret、OAuth token **只存在于服务端**
- 浏览器只拿随机会话 ID，`HttpOnly` + `SameSite=Lax`；HTTPS 下自动加 `Secure`
- `state` 用 `crypto.randomBytes(32)` 生成，校验后**原子消费**防重放
- 返回前端的 `user_ref` 是 uid 的 SHA-256 截断，**不下发 uid 原值**
- `uid` 为 int64，在 JSON 解析阶段即转字符串，避免精度丢失
- `.env` 已在 `.gitignore` 中

---

## 冒烟测试

```bash
npm run smoke
```

76 项，覆盖：端点可用性、领域日报 4.0 结构（mainline 聚合 / basis 数字 reconcile /
report 篇幅 / recommended ⊆ source_index / cited 标记 / skipped 原因）、
置信度分层、画像标签搜索核验（切词碎片「被严重高 / 严重高估」不进 top 标签）、
偏好与反馈闭环、缓存命中、并发去重、降级路径（`ai=false` 规则版结构一致）、
**任务五 creator 池零消耗**（冷启动日报 metrics + `/_sim/stats` 全程实证）、
`PROFILE_PLATFORM_PROBE=1` 留门（拉起第二业务实例验证探测有内容且 creator 确实消耗，测完即关）、
state 安全（缺失/伪造）、凭证不泄露、错误处理。

当前：全部通过（见仓库最新一次 `npm run smoke` 输出）。

---

## 仿真模式（零配额消耗）

不需要真实知乎凭证、不消耗任何接口额度，即可跑通全链路（含 smoke 全部断言）。
原理是 **API base 重定向**：设置 `ZHIHU_API_BASE` 后，`config.js` 会把开放平台
（`openApiBase`）与 OAuth 三个 URL 的 origin 全部替换为该地址（path 不变），
因此仿真模式下**不可能**有请求落到 `developer.zhihu.com` / `openapi.zhihu.com`。

```bash
# 终端 1：起仿真服务（默认 3999，可用 SIM_PORT 覆盖）
npm run simulate

# 终端 2：起业务服务，凭证用任意占位值，API base 指向仿真
PORT=3100 ZHIHU_ACCESS_SECRET=sim-dummy ZHIHU_API_BASE=http://127.0.0.1:3999 node server.js

# 终端 3：跑冒烟（76 项断言全绿）
SMOKE_BASE=http://127.0.0.1:3100 npm run smoke
```

仿真服务 `scripts/simulate.js` 的行为：

- **样本优先**：`samples/` 里有的接口直接回真实样本（热榜 / 搜索×3 / 问题推荐×3 /
  回答×3 / 额度 / 关注 / 收藏夹 / 平台画像探测）；`user/contents` 与 `user/collections`
  无样本，按样本字段风格合成（各 ≥10 条，覆盖六个领域，含游戏/设计/科学/旅行信号词）
- **未知查询不空版**：未命中样本的搜索词 / 推荐问题 / 问题回答按查询词确定性合成，
  直答（`/v1/chat/completions`）会解析 prompt 中的领域、篇幅档位与来源 id，
  返回结构化调研 JSON（`source_id` 一定从输入来源里选，author/url 由后端按召回池回填）。
  搜索合成遵守「话题词可核验」性质：查询命中内置 KNOWN_TOPICS 话题词（如「红楼梦」）
  时合成标题含原词；不含话题词的查询（如切词碎片「被严重高」）合成标题一律不含原词
  ——画像标签搜索核验的保留 / 淘汰两条路径因此都可在仿真下测试
- **运维接口**：`GET /_sim/stats` 查看各端点调用次数（含 creator 池计数）、
  `GET /_sim/reset` 清零
- **降级演练**：`SIM_QUOTA_EXHAUST=1 npm run simulate` 时 creator 池
  （question_recommendations）返回 `{Code: 30002}`。任务五后默认路径不再调用
  creator，该开关现仅演练 `PROFILE_PLATFORM_PROBE=1` 时探测失败的安全降级
  （画像照常返回、`platform_recommendation.items` 为空）；日报 `stale: true`
  路径（代码保留，任一上游抛 30002 即触发）需真实额度耗尽、或后续给仿真端加
  search 池耗尽开关后再演练

---

## 实测踩坑记录

| 坑 | 现象 | 正确做法 |
|---|---|---|
| 钥匙串密钥格式 | 直接用返回 `20001` | 剥离 `go-keyring-base64:` 前缀并解码（已内置）|
| 回答摘要参数名 | `QuestionURL` 返回 `10001` | 必须是 `QuestionUrl` |
| 推荐问题参数名 | 传 `Topic`/`Keyword` 返回 `Code=0` 但**结果不相关** | 必须是 `Query`，其余被静默忽略 |
| 分页 | — | 用返回的 `NextOffset`，不能按条数自算 |
| 直答返回格式 | 可能裹 Markdown 代码块 | 已做剥离与截断容错 |

---

## 拿到 OAuth 凭证后

1. App ID / App Key 填进 `.env`
2. `ZHIHU_OAUTH_REDIRECT_URI` 改成部署后的公网 HTTPS 地址
3. 赛事页面登记**完全相同**的回调地址
4. 重启，`npm run smoke` 会自动多跑两项 state 检查
5. 浏览器打开 `/api/auth/login` 完成真实授权

登录失败排查：账号未绑手机号或未实名；`redirect_uri` 有任何字符差异。
