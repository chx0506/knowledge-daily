// 仿真服务：零依赖模拟知乎开放平台全部接口（含直答与 OAuth 桩）。
//
// 用途：配合 ZHIHU_API_BASE 重定向，让业务后端在「零配额消耗」下跑通全链路。
//   SIM_PORT=3999 node scripts/simulate.js
//   PORT=3100 ZHIHU_ACCESS_SECRET=sim-dummy ZHIHU_API_BASE=http://127.0.0.1:3999 node server.js
//
// 数据来源纪律：
//   - samples/ 里有的接口一律回真实样本（hot / search×3 / qrec×3 / qans×3 /
//     quota / followees / favlists / q_profile）
//   - samples/ 缺的（user/contents、user/collections）按样本字段风格合成，
//     覆盖 tech/finance/world/china/life/culture 六领域，并含游戏/设计/科学/旅行信号词
//   - 未知 Query / QuestionUrl 按查询词确定性地合成，保证任何领域、任何主题都不空版
// 运维接口：GET /_sim/stats 查看各端点调用次数；GET /_sim/reset 清零。
// 降级演练：SIM_QUOTA_EXHAUST=1 时 creator 池（question_recommendations）返回 {Code:30002}。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const SAMPLES_DIR = fs.existsSync(path.join(SERVER_ROOT, 'samples'))
  ? path.join(SERVER_ROOT, 'samples')
  : path.resolve(SERVER_ROOT, '..', 'samples');

const PORT = Number(process.env.SIM_PORT) || 3999;
const QUOTA_EXHAUST = process.env.SIM_QUOTA_EXHAUST === '1';

// ---------------- 场景切换（任务四：稀疏画像）----------------
// full  ：全量信号（默认，10 个领域都有信号）
// sparse：稀疏画像——只有文化类信号（红楼梦收藏 2 条 + 红楼梦创作 1 条），
//         followees/favlists 为空。用于验证 blind 开关与关联拓展补盲：
//         tech/finance 在该画像下无信号，blind=0 应进 skipped，
//         blind=1 应走 profile_anchored 交叉召回（锚标签「红楼梦」）。
// 运行期切换：POST /_sim/scene {"scene":"sparse"} 或 GET /_sim/scene?set=full
let SCENE = 'full';
const SCENES = new Set(['full', 'sparse']);
const SPARSE_FAV_TITLES = new Set([
  '平心而论红楼梦是不是被严重高估了？',
  '为什么很多人读不下去《红楼梦》？',
]);
const SPARSE_OWN_TITLES = new Set([
  '重读《红楼梦》的完读率问题：我怎么做读书笔记',
]);

// ---------------- 样本加载 ----------------

const loadSample = (name) => JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, name), 'utf8'));

const SAMPLE = {
  hot: loadSample('raw_hot.json'),
  quota: loadSample('raw_quota.json'),
  followees: loadSample('raw_me_followees.json'),
  favlists: loadSample('raw_me_favlists.json'),
  qProfile: loadSample('raw_q_profile.json'),
  search: {
    ai: loadSample('raw_search_AI_产品设计.json'),
    reading: loadSample('raw_search_信息过载_阅读方式.json'),
    indie: loadSample('raw_search_独立开发者_App_变现.json'),
  },
  qrec: {
    ai: loadSample('raw_qrec_AI_产品设计.json'),
    reading: loadSample('raw_qrec_信息过载_阅读方式.json'),
    indie: loadSample('raw_qrec_独立开发者_App_变现.json'),
  },
  qans: {
    ai: loadSample('raw_qans_AI_产品设计.json'),
    reading: loadSample('raw_qans_信息过载_阅读方式.json'),
    indie: loadSample('raw_qans_独立开发者_App_变现.json'),
  },
};

// question_answers 按 QuestionUrl 映射：从样本回答 URL 反解问题 id
const qansByQuestionUrl = new Map();
for (const key of Object.keys(SAMPLE.qans)) {
  const sample = SAMPLE.qans[key];
  for (const it of sample.Data.Items) {
    const m = String(it.Url).match(/question\/(\d+)\/answer\//);
    if (m) qansByQuestionUrl.set(`https://www.zhihu.com/question/${m[1]}`, sample);
  }
}

// ---------------- 统计 ----------------

const stats = {
  startedAt: Date.now(),
  total: 0,
  byApi: {},      // apiId -> 次数（hot_list / zhihu_search / creator / ...）
  byPath: {},     // 'GET /api/v1/...' -> 次数
  recent: [],     // 最近 30 条
};

function track(apiId, req, url) {
  stats.total += 1;
  stats.byApi[apiId] = (stats.byApi[apiId] ?? 0) + 1;
  const pk = `${req.method} ${url.pathname}`;
  stats.byPath[pk] = (stats.byPath[pk] ?? 0) + 1;
  stats.recent.push({ at: new Date().toISOString(), api_id: apiId, method: req.method, url: req.url });
  if (stats.recent.length > 30) stats.recent.shift();
  console.log(`  [sim] ${req.method} ${req.url}  → ${apiId}`);
}

// ---------------- 工具 ----------------

const md5 = (s) => crypto.createHash('md5').update(String(s)).digest('hex');

/** 由种子字符串生成定长数字 id（字符串形式，避免 JS 大整数精度问题） */
function numId(seed, len = 19) {
  const n = BigInt('0x' + md5(seed)) % (10n ** BigInt(len));
  return n.toString().padStart(len, '0');
}

/** 确定性伪随机（同一种子同一序列，便于缓存去重验证） */
function seededRand(seed) {
  let h = 2166136261 >>> 0;
  for (const c of String(seed)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 2 ** 32;
  };
}

const int = (v, d) => { const n = Number.parseInt(v ?? '', 10); return Number.isFinite(n) ? n : d; };

function send(res, payload, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// ---------------- 合成：user/contents 与 user/collections（样本缺失，按风格合成）----------------
// 覆盖六领域信号：titles 命中各领域关键词；另含 游戏 / 设计 / 科学 / 旅行 信号词。

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

const OWN_CONTENTS = [
  { t: '我用 AI Agent 重构内容工作流的一个月', type: 'article', ago: 3, like: 486, cmt: 57, s: '把选题、检索、初稿、校对四个环节全部交给 Agent 编排之后，我的一篇深度稿从三天缩短到五小时。这篇文章完整记录了工作流设计、提示词分工和翻车现场。' },
  { t: '独立开发者订阅制变现的第一年：收入与代价', type: 'article', ago: 8, like: 892, cmt: 124, s: '上线订阅制整整一年，MRR 爬到 1200 美元。复盘定价策略、免费额度设计、流失挽留邮件的真实数据，以及被忽视的心理成本：收入可见之后，焦虑也变得具体。' },
  { t: '回到成都远程办公半年，我的居住成本账本', type: 'answer', ago: 13, like: 1532, cmt: 231, s: '从上海回成都远程办公半年，房租从五千五降到一千八，通勤时间归零。但远程的隐性成本也开始显现：协作摩擦、晋升能见度、还有越来越难划清的工作与生活边界。' },
  { t: '在杭州租房十年：一个互联网从业者的居住观察', type: 'article', ago: 19, like: 743, cmt: 96, s: '十年七次搬家，从滨江到未来科技城再到良渚。杭州的租金曲线几乎就是互联网行业的景气曲线。这篇整理了我的租房决策框架：通勤预算、生活半径和议价时机。' },
  { t: '对抗信息过载：我的主题阅读法与收藏夹整理术', type: 'article', ago: 26, like: 1124, cmt: 143, s: '收藏三千条从未回看之后，我改用主题阅读法：每月只锁定一个主题，先读综述建立框架，再读立场不同的三本书。收藏夹则每周清理、每条必加一句自己的话。' },
  { t: '重读《红楼梦》的完读率问题：我怎么做读书笔记', type: 'answer', ago: 33, like: 659, cmt: 78, s: '电子书平均完读率不到一成，《红楼梦》这种大书更考验方法。我的对策是放弃「读完」执念：带着问题翻书，找到答案就合上书。笔记只写卡片，每张卡片必须连到一张已有卡片，否则就是高级收藏夹。' },
  { t: '连续加班之后，我用睡眠监测找回了专注力', type: 'answer', ago: 41, like: 2087, cmt: 312, s: '连续加班三个月后，深睡时长跌到不足一小时。我把九十分钟的睡眠数据、静息心率整理成图表，配合九十分钟工作块实验，六周后日均深度工作回到三小时以上。' },
  { t: '一年通勤路上听完的四十本科学书', type: 'article', ago: 50, like: 921, cmt: 105, s: '每天往返两小时通勤，一年听完四十本科学类有声书，从宇宙学到行为经济学。关键是把设备、书单和笔记模板全部标准化，不带任何决策上路。' },
  { t: '产品经理的游戏化设计笔记：从塞尔达传说学到的交互', type: 'article', ago: 57, like: 1345, cmt: 167, s: '塞尔达的引导设计为什么从不让玩家迷路？我把开放世界的视觉锚点、渐进式解锁和即时反馈机制拆成了十二条可复用的产品设计原则，附自家产品的改造对照。' },
  { t: '硅谷科技公司发布会的美国式叙事观察', type: 'answer', ago: 63, like: 587, cmt: 73, s: '看了十几场硅谷科技公司的发布会，叙事结构高度模板化：先使命、再数字、后价格。观众要的不是参数，而是一个可以转述的故事。这对国内产品发布很有参照价值。' },
  { t: '冰岛环岛自驾旅行：极光观测与预算复盘', type: 'article', ago: 70, like: 1102, cmt: 189, s: '九天环岛两千公里，看到了四次极光。这篇复盘行程规划、租车与住宿的预算分配、极光预测的工具用法，以及冬季自驾的安全清单。旅行有了观察框架，风景就变成了证据。' },
];

const RECENT_FAVORITES = [
  { t: '平心而论红楼梦是不是被严重高估了？', author: '红楼一梦客', ut: 'red-chamber-dream', ago: 2, votes: 10234, s: '平心而论，《红楼梦》的文学史地位没有被高估，被高估的是「必须一字不落读完」的执念。回答从叙事结构、诗词水准、版本流变三个维度给出论据，评论区吵了三千楼。' },
  { t: '为什么很多人读不下去《红楼梦》？', author: '重读俱乐部', ut: 'reread-club', ago: 5, votes: 5678, s: '读不下去通常不是读者的问题：前四十回的人物密度、诗词的门槛、版本差异带来的割裂感，各有各的劝退点。高赞回答给了一条从第五十五回倒着读的野路子。' },
  { t: '怎么才能养成每天运动的习惯？', author: '精力管理笔记', ut: 'energy-notes', ago: 9, votes: 4321, s: '靠意志力养成运动习惯基本都会失败。有效的路径是把触发线索固定下来：同一时间、同一地点、同一套装备，前两周只求出门不求强度。' },
  { t: '为什么 Agent 是下一代软件形态？', author: '张承宇', ut: 'zhang-chengyu-42', ago: 1, votes: 8421, s: '软件的前三次范式转移分别是桌面、Web 和移动，每一次都重构了人机分工。Agent 的范式意义在于：人定义目标，机器负责路径。这篇文章从交互史角度把这件事讲清楚了。' },
  { t: '指数基金投资的隐形成本清单', author: '定投小食堂', ut: 'dingtou-etf', ago: 4, votes: 6233, s: '管理费只是冰山一角。跟踪误差、申赎冲击、分红税、汇率对冲成本加起来，一年能吃掉 1.5% 的收益。文章给出了一张可以逐项自查的成本清单。' },
  { t: '县城回流青年的就业选择：编制之外', author: '县域青年观察', ut: 'county-youth', ago: 7, votes: 9102, s: '跟踪了八位回到县城的年轻人：考编之外，电商、自媒体、本地服务数字化是三条真实存在的路。文章没有美化任何一种选择，收入曲线和代价都摆在那里。' },
  { t: '房租与通勤的交换：大城市居住决策', author: '城市数据派', ut: 'city-data-lab', ago: 11, votes: 4876, s: '用通勤时间折算时薪，再反推可承受的房租上限——这个简单的交换模型能解释大城市里大多数的居住纠结。文章附了北上广深成杭六个城市的实测数据。' },
  { t: '信息过载时代的深度阅读方法', author: '阅读方法实验室', ut: 'reading-lab', ago: 16, votes: 7654, s: '信息过载的本质不是信息太多，而是筛选机制失效。这篇提出「问题驱动阅读」：先写下三个具体问题，再决定读什么、读到哪里停。' },
  { t: '晚上睡不好的人，身体发生了什么', author: '昼夜节律实验室', ut: 'circadian-lab', ago: 23, votes: 5487, s: '入睡困难、半夜易醒、早醒三种失眠对应的生理机制完全不同。光照、体温和皮质醇节律是三个最可调节的变量，文章给了四周的自我实验方案。' },
  { t: '海外科技公司的大模型落地路径', author: '湾区科技观察', ut: 'bay-area-tech', ago: 29, votes: 3921, s: '梳理了十二家海外科技公司的大模型落地案例：真正跑通的不是聊天机器人，而是嵌入现有工作流的「看不见的 AI」。对中国市场的参照意义在于场景选择。' },
  { t: '独立游戏的收入结构：从星露谷说起', author: '游戏产业笔记', ut: 'indie-game-notes', ago: 36, votes: 6543, s: '星露谷物语一个人四年开发、累计销量破三千万份。拆解独立游戏的收入结构：平台分成、折扣节奏、长尾效应，以及为什么「小而美」在游戏行业成立。' },
  { t: '旅行中的科学观察：从冰川到火山', author: '地理漫游记', ut: 'geo-traveler', ago: 44, votes: 2876, s: '冰岛旅行的正确打开方式：带着地质学问题上路。冰川后退的速度、火山灰的成分、地热发电的原理，当旅行有了观察框架，风景就变成了证据。' },
  { t: '设计师的 AI 工具箱：从出图到交付', author: '设计前沿站', ut: 'design-frontier', ago: 52, votes: 4102, s: '一位服务大厂的设计师完整公开了自己的 AI 工作流：草图生成、CMF 方案、多轮迭代的一致性控制，以及客户交付时如何说明 AI 参与度。' },
  { t: '焦虑时代的休息学', author: '精力管理笔记', ut: 'energy-notes', ago: 66, votes: 8234, s: '身体休息、心理休息、感官休息、创造性休息是四件不同的事。周末躺平刷手机只解决第一层，剩下三层长期欠账，是现代人心累的真正原因。' },
  { t: '美国科技公司的全球竞争与中国的应对', author: '全球科技评论', ago: 81, votes: 5123, s: '从芯片管制到模型出口，美国科技公司的全球策略正在重塑产业链。文章梳理了国内从业者在工具链、市场和合规三个层面可以做的现实选择。' },
];

function synthContents() {
  const list = SCENE === 'sparse'
    ? OWN_CONTENTS.filter((x) => SPARSE_OWN_TITLES.has(x.t))
    : OWN_CONTENTS;
  return {
    Code: 0,
    Data: {
      Items: list.map((x, i) => ({
        ContentID: numId(`own:${x.t}`),
        ContentType: x.type,
        Title: x.t,
        Url: x.type === 'article'
          ? `https://zhuanlan.zhihu.com/p/${numId(`own:${x.t}`, 18)}`
          : `https://www.zhihu.com/question/${numId(`ownq:${x.t}`, 18)}/answer/${numId(`own:${x.t}`, 18)}`,
        Summary: x.s,
        CreatedAt: now() - x.ago * DAY,
        LikeCount: x.like,
        CommentCount: x.cmt,
      })),
      Paging: { IsEnd: true, Totals: list.length },
    },
    Message: 'success',
  };
}

function synthCollections() {
  const list = SCENE === 'sparse'
    ? RECENT_FAVORITES.filter((x) => SPARSE_FAV_TITLES.has(x.t))
    : RECENT_FAVORITES;
  return {
    Code: 0,
    Data: {
      Items: list.map((x) => ({
        ContentID: numId(`fav:${x.t}`),
        ContentType: 'answer',
        Title: x.t,
        Url: `https://www.zhihu.com/question/${numId(`favq:${x.t}`, 18)}/answer/${numId(`fav:${x.t}`, 18)}`,
        AuthorName: x.author,
        // C1 仿真：部分作者带 UrlToken，演示 author_url 效果（真实接口多数接口不回该字段）
        ...(x.ut ? { UrlToken: x.ut } : {}),
        Summary: x.s,
        VoteUpCount: x.votes,
        FavTime: now() - x.ago * DAY,
      })),
    },
    Message: 'success',
  };
}

// ---------------- 合成：知乎搜索（按领域 + 查询词） ----------------

/** 稀疏场景：返回与样本同构但 Items 为空的响应（followees / favlists 用） */
function emptied(sample) {
  const c = JSON.parse(JSON.stringify(sample ?? { Code: 0, Data: { Items: [] } }));
  if (Array.isArray(c?.Data?.Items)) c.Data.Items = [];
  else if (Array.isArray(c?.Data)) c.Data = [];
  return c;
}

const SEARCH_BANKS = {
  finance: [
    { t: '订阅制产品的定价误区：为什么低价套餐反而拉低留存', a: '产品笔记君', v: 3241, c: 217, s: '做订阅制 SaaS 第三年，我把定价从 9.9 美元调到 19 美元，流失率反而下降了。低价吸引来的用户留存意愿低、客服成本高，算总账是亏的。定价的本质是筛选，不是促销。' },
    { t: '一个普通上班族的指数基金定投五年复盘', a: '定投小食堂', v: 5892, c: 463, s: '2021 年开始每月定投宽基指数，五年年化 6.2%。最重要的不是择时，而是大跌那年没有停止扣款。把自动转账设在发薪日第二天，是整件事里唯一关键的纪律。' },
    { t: '自由职业者怎么做年度预算？我的三张表', a: '账本上的猫', v: 1876, c: 154, s: '收入不稳定时，预算的核心是先把固定支出压缩到月收入的四成以内。我用收入表、支出表、现金流预测表三张表管理全年，每季度复盘一次，三年没有出现过断粮。' },
    { t: '降本不等于裁员：一家五十人公司的成本结构拆解', a: '运营深水区', v: 2408, c: 189, s: '去年我们把云成本砍了三分之一，靠的不是换供应商，而是闲置资源清理、存储分层和预留实例三件事。真正的降本来自对账单的逐行审计，而不是拍脑袋的砍人。' },
    { t: '知识付费产品的退款率为什么居高不下？', a: '付费墙观察', v: 1523, c: 98, s: '访谈了十一位知识付费创作者，退款率集中在 8% 到 15%。高退款课程有三个共同点：承诺过满、试看不足、交付节奏拖沓。降低退款的最好办法是卖之前就降低预期。' },
    { t: '个人开发者收入报税的那些坑', a: '独立开发账本', v: 987, c: 132, s: '应用商店收入结算到个人卡，第二年汇算清缴被要求补税的不在少数。劳务报酬与经营所得的界定、成本扣除的凭证要求，每一步都有细节，建议收入过万就去问一次专业人士。' },
  ],
  china: [
    { t: '回到成都远程办公一年，我的账本和生活都变了', a: '蓉城远程客', v: 4123, c: 389, s: '离开上海前月薪两万二、房租五千五；回成都后远程拿八折工资、房租一千八，每天多出两小时。真正的变化是生活半径和心理状态，以及重新计算的职业安全感。' },
    { t: '县城编制内工作五年，我为什么还是选择离开', a: '小城出走记', v: 6734, c: 812, s: '很多人只看到编制的稳定，看不到县城里技能折价的速度。五年里我的专业能力几乎没有增量，跳槽时才发现市场价已经变了。稳定的价格，要用停滞来支付。' },
    { t: '杭州租房十年：一个互联网人的居住观察', a: '租房十年', v: 2956, c: 274, s: '从滨江到未来科技城再到良渚，十年搬了七次家。杭州的租金曲线几乎就是互联网行业的景气曲线，2023 年之后明显松动，议价空间第一次站在租客这边。' },
    { t: '大城市的远程岗位正在变多，但隐性门槛也在变高', a: '远程工作研究所', v: 1874, c: 156, s: '统计了主流招聘网站三个月的远程岗位：数量同比增加四成，但要求五年以上经验的比例从 35% 涨到 58%。远程正在从福利变成资深员工的特权。' },
    { t: '回流县城的年轻人，现在过得怎么样？', a: '县域青年观察', v: 3421, c: 297, s: '跟踪采访了八位前后脚回流的年轻人：两人考编上岸，三人做电商和自媒体，一人开了咖啡馆，还有两人已经重新回到省会。县城的机会真实存在，但分布极不均匀。' },
    { t: '就业市场的心态变化：从跳槽涨薪到保住饭碗', a: '职场温度计', v: 2287, c: 341, s: '今年接触到的人选里，主动看机会的少了，谈薪预期普遍下调一到两成。稳定第一次排在了成长前面。这种心态变化会反过来影响企业的招聘策略和组织设计。' },
  ],
  life: [
    { t: '连续加班三个月后，我用睡眠监测数据说服了老板', a: '睡眠自救指南', v: 5231, c: 467, s: '把三个月的深睡时长、静息心率和心率变异性整理成一张图发给主管，比任何抱怨都有说服力。数据证明长期睡眠不足的团队，产出质量在以可测量的方式下降。' },
    { t: '通勤两小时的人，如何把路上时间变成增量', a: '路上书房', v: 3892, c: 356, s: '每天往返两小时通勤，三年听完一百二十本书，写完四十篇笔记。关键是把设备、书单和笔记模板全部标准化，不带决策上路。通勤的本质是一段被迫的整块时间。' },
    { t: '对抗焦虑最有效的方法，是把担忧写下来', a: '情绪记账本', v: 4108, c: 392, s: '认知行为疗法里最朴素的一招：把担心的事写成清单，标注可控与不可控。三个月后回看，八成担忧没有发生，剩下的基本都有解法。写下来，焦虑就从情绪变成了任务。' },
    { t: '晚上睡不好的人，白天可能缺的是光照', a: '昼夜节律实验室', v: 2765, c: 243, s: '连续两周早上晒二十分钟太阳，我的入睡时间从凌晨一点半提前到十一点半。光照对褪黑素分泌的影响被严重低估，这是最便宜的睡眠干预手段。' },
    { t: '真正的休息不是刷手机：恢复精力的四个层次', a: '精力管理笔记', v: 6102, c: 518, s: '身体休息、心理休息、感官休息、创造性休息是四件事。周末躺平刷短视频只解决了第一层，剩下三层欠着，周一自然更累。休息是需要设计的，不是剩下的时间。' },
    { t: '专注力碎掉的人，可以试试九十分钟工作块', a: '深度工作实践者', v: 3345, c: 289, s: '把一天切成三个九十分钟的块，块内只干一件事，块间休息二十分钟。六周后，我的日均深度工作时间从不足一小时回到三小时以上。节奏比意志力可靠。' },
  ],
  world: [
    { t: '硅谷科技公司的 AI 发布会为什么越来越像宗教仪式', a: '湾区科技观察', v: 2876, c: 342, s: '从舞台设计到叙事结构，硅谷的发布会正在模板化：先讲使命，再讲数字，最后讲价格。观众要的不是参数，而是一个可以转述的故事。理解这套叙事，才能看懂它的影响力。' },
    { t: '美国科技行业的远程办公退潮，给全球带来什么启示', a: '全球远程观察', v: 1934, c: 218, s: '头部公司强制一周五天到岗之后，跟进者越来越多。但公开数据显示，完全到岗并没有换来产出提升，换来的是简历库的活跃。政策反复的代价最终由组织信任买单。' },
    { t: '海外独立开发者怎么做冷启动？Product Hunt 之外的九条路', a: '出海开发笔记', v: 1567, c: 143, s: 'Product Hunt 的一次性流量越来越难转化。更有效的冷启动是垂直社区、目录站、SEO 内容和小额付费推广的组合，核心目标是找到前一百个真实用户并逐个访谈。' },
    { t: '全球科技公司的大模型竞赛，正在从技术战变成成本战', a: '算力前线', v: 2241, c: 267, s: '过去一年主流模型的 API 价格下降了八成以上。当能力趋同，推理成本就是唯一的护城河，这也是开源模型真正的杀伤力所在。接下来的竞争会在账单上分胜负。' },
    { t: '美国年轻人为什么开始逃离订阅制？', a: '消费降级观察', v: 1789, c: 204, s: '流媒体、软件、健身、杂货，一个普通家庭平均背着十二个订阅。取消订阅类的工具下载量一年翻了三倍。订阅疲劳是真实的消费情绪，定价策略需要重新算账。' },
    { t: '从海外社区看中文内容出海：翻译不是最难的部分', a: '内容出海笔记', v: 1243, c: 118, s: '最难的是语境。同一个梗在中文社区是共鸣，直译过去就是冒犯。做得好的出海团队都配了本地化的共创编辑，而不是翻译外包。内容出海的本质是文化转译。' },
  ],
  culture: [
    { t: '信息过载时代，为什么重读比新书更重要', a: '重读俱乐部', v: 4521, c: 378, s: '一年读五十本新书，不如把五本好书重读三遍。重读时你会带着这一年的问题回去，看到的全是第一遍看不见的东西。经典的价值在于它能承受反复提问。' },
    { t: '我的收藏夹整理术：从松鼠病到知识资产', a: '收藏夹考古学家', v: 3156, c: 267, s: '收藏了三千条内容从未回看，后来我定了三条规矩：每周清理一次、每条加一句自己的话、三个月没用的标签合并。收藏只有经过再加工，才算真正拥有。' },
    { t: '完读率只有个位数的时代，读书方法该更新了', a: '阅读方法实验室', v: 2874, c: 312, s: '出版行业的数据说电子书平均完读率不到一成。与其追求读完，不如建立问题驱动的阅读方式：带着问题翻书，找到答案就放下。读完是手段，从来不是目的。' },
    { t: '主题阅读法实操：一个月搞懂一个陌生领域', a: '学习方法搬运工', v: 5432, c: 421, s: '选定主题后，先读一篇综述建立框架，再读三本立场不同的书，最后读一手资料。一个月足够你在任何领域达到能对话的水平。顺序比数量重要得多。' },
    { t: '为什么你收藏的学习方法从来用不上？', a: '方法论打假办', v: 2765, c: 298, s: '因为大多数方法论文章省略了执行条件。番茄钟对创意工作低效，费曼技巧对纯记忆内容浪费。方法必须匹配任务类型，否则收藏再多也只是心理安慰。' },
    { t: '读书笔记的尽头是卡片盒，但多数人用错了', a: '卡片盒实践者', v: 1987, c: 176, s: '卢曼卡片盒的核心不是分类而是连接。每张卡片只写一个想法，并且必须写下它与已有卡片的关系，否则就只是一个高级收藏夹。连接密度决定笔记的价值。' },
  ],
  tech: [
    { t: '大模型 Agent 落地半年：从 Demo 到生产的距离', a: 'Agent 工程笔记', v: 3654, c: 312, s: 'Demo 里 Agent 什么都能做，生产环境里第一件事是砍掉八成的工具调用。可控的工作流编排比自由发挥的智能更有商业价值。稳定性是 Agent 产品的第一道门槛。' },
    { t: 'AI 编程工具一年后，工程师的分化开始了', a: '代码与模型', v: 4876, c: 534, s: '会用 Agent 的工程师把重复劳动压缩到两成，把精力放在审查与设计上；拒绝工具的工程师并没有保住手艺，只是变得更慢。分化的不是技术栈，是工作方式。' },
    { t: '小团队如何低成本接入大模型？我们的三层架构', a: '小而美技术栈', v: 2134, c: 187, s: '缓存层挡掉六成重复请求，路由层把简单任务发给小模型，只有一成请求走到旗舰模型，月成本从八千降到一千二。架构设计的本质是让每一次调用都花得值。' },
    { t: '提示词工程的尽头是上下文工程', a: 'Prompt 退化论', v: 2987, c: 265, s: '当模型窗口到了百万级，雕花式的提示词技巧迅速贬值。真正难的是给模型准备正确的上下文：检索、裁剪、排序、注入。上下文质量决定输出质量的上限。' },
    { t: '开源模型追到旗舰九成之后，闭源还剩什么？', a: '模型攻防', v: 1876, c: 203, s: '基准分数之外，闭源模型还剩工具调用的稳定性、长任务的可靠性和合规支持。这三点恰恰是企业客户付钱的原因。竞争的下半场不在跑分，在交付。' },
    { t: '一个独立开发者的 AI 产品工具箱（2026 版）', a: '一人公司装备库', v: 3298, c: 276, s: '代码、原型、文案、客服机器人全部有对应的 AI 工具，全套月成本不到三百美元。工具链的成熟让一人公司真正可行，瓶颈从资源回到了判断力和执行力。' },
  ],
  gaming: [
    { t: '塞尔达传说为什么从不让玩家迷路？引导设计拆解', a: '游戏设计解剖室', ut: 'game-design-lab', v: 7865, c: 623, s: '开放世界的引导不靠任务标记，而靠视觉锚点、地形引导和好奇心驱动。三角法则、引力点、视线走廊，这些机制让玩家以为路是自己找的，实际每一步都被设计过。' },
    { t: '独立游戏这一年：小而美为什么越来越成立', a: '独立游戏观察', ut: 'indie-game-watch', v: 4521, c: 389, s: '发行平台分成下降、众筹回暖、短视频带量效率提升，让两三人的小团队也能活下来。但清单数据同样说明：首周销量九成分布在头部一成作品上，题材选择比品质更先于生死。' },
    { t: '玩家社区正在改变游戏的开发节奏', a: '游戏产业笔记', ut: 'indie-game-notes', v: 3245, c: 412, s: '抢先体验模式把玩家从消费者变成了共创者：更新路线图公开投票、MOD 作者被官方收编、社区梗进入正式剧情。开发不再是交付关系，而是长期的社区运营。' },
    { t: '电竞赛事的商业模式，正在从赞助走向分成', a: '电竞商业观察', ut: 'esports-biz', v: 2876, c: 298, s: '赛事收入过去八成靠品牌赞助，今年头部赛事的版权与游戏内道具分成首次超过四成。联盟化席位费降温之后，赛事方开始和游戏厂商算更长远的账。' },
    { t: '手游的长线运营秘诀：内容节奏比画质重要', a: '手游运营手账', ut: 'mobile-game-ops', v: 2134, c: 256, s: '统计了十款运营超过五年的手游：活下来的共同点不是画质军备竞赛，而是稳定的内容节奏——固定的版本周期、可预期的活动日历、以及从不透支玩家的付费设计。' },
    { t: '主机游戏定价 70 美元时代，玩家用脚投票了吗？', a: '主机玩家俱乐部', ut: 'console-club', v: 1987, c: 345, s: '提价两年后的数据显示：头部 IP 销量几乎不受影响，腰部作品首发销量下滑明显。玩家的对策是等打折和订阅库，首发的意义正在从「买到」变成「参与讨论」。' },
  ],
  design: [
    { t: 'AI 出图进入交付流之后，设计师的分工变了', a: '设计前沿站', ut: 'design-frontier', v: 5432, c: 467, s: '草图与灵感版环节被 AI 压缩到原来的三分之一，设计师的时间转向需求澄清、方案评审和交付把控。不会用 AI 出图不是短板，说不清设计决策依据才是。' },
    { t: '2026 年的界面设计趋势：克制比新奇更稀缺', a: '界面趋势观察', ut: 'ui-trend-watch', v: 3876, c: 312, s: '玻璃拟物、3D 元素的退烧肉眼可见，头部产品集体回归高密度排版与明确的层级。趋势报告里被引用最多的词从「沉浸」变成了「效率」，B 端审美正在反向影响 C 端。' },
    { t: '一个设计系统落地的真实成本：不只是组件库', a: '设计系统实践者', ut: 'design-system-pro', v: 3245, c: 289, s: '组件库只占总成本的三成，剩下的是设计令牌治理、跨端一致性、文档与培训。我们花了两个季度才让三十人的团队真正用起来，最大的阻力是既有页面的迁移优先级。' },
    { t: '作品集怎么打动面试官？大厂设计总监的筛选标准', a: '设计招聘内参', ut: 'design-hiring', v: 2987, c: 378, s: '每份作品集平均停留九十秒。被留下的作品集有三个共性：开头三十秒讲清业务背景、过程展示决策而非堆砌稿图、结果有可验证的数据。视觉稿再漂亮也只是入场券。' },
    { t: 'CMF 设计：消费电子产品的隐形战场', a: '工业设计笔记', ut: 'cmf-notes', v: 1876, c: 167, s: '颜色、材质、工艺决定了用户上手前三秒的判断。同一个结构，换用素皮与金属两种 CMF 方案，用户愿意支付的价格差出两成。AI 渲染让 CMF 方案的验证周期从周缩到小时。' },
    { t: '交互设计的微文案：被低估的转化杠杆', a: '微文案研究所', ut: 'microcopy-lab', v: 1654, c: 198, s: '按钮上的两个字值多少钱？我们做过四十七组 A/B 实验：把「提交」改成具体动作文案后，表单完成率平均提升 12%。微文案是最便宜的体验优化，却常年排在需求列表最后。' },
  ],
  science: [
    { t: '今年被引用最多的十篇论文，都在解决什么问题', a: '论文雷达站', ut: 'paper-radar', v: 4321, c: 356, s: '高引论文的共同点不是开创了新方向，而是给热门问题提供了可复用的工具：基准数据集、开源实现、系统性综述。科学共同体奖励的是让后人站得上去的肩膀。' },
    { t: '科普内容的可信度危机：流量与严谨如何兼得', a: '科学传播观察', ut: 'sci-comm-watch', v: 3654, c: 423, s: '对一百个热门科普视频的事实核查显示，标题夸大与正文准确可以共存——问题不在夸张本身，而在是否保留了不确定性的说明。好科普的标志是把「我们还不知道」讲清楚。' },
    { t: '室温超导、淀粉合成：大科学争议如何收场', a: '科学争论档案', ut: 'sci-debate-arch', v: 3102, c: 587, s: '近年的重大科学争议有相似的收场路径：预印本引爆舆论、同行重复实验、小范围修正、舆论退潮。真正值得跟踪的是重复实验的发表速度，它比任何声明都接近真相。' },
    { t: '天文学的新窗口：时域天文为什么火了', a: '仰望星空笔记', ut: 'astro-notes', v: 2543, c: 234, s: '新一代巡天望远镜每晚产生 TB 级数据，天文学从「看静态照片」进入「看直播」时代。引力波电磁对应体、快速射电暴、近地小行星，时域天文让普通人也能参与发现。' },
    { t: '实验可重复性危机十年后，学界改了吗', a: '科研方法论', ut: 'research-method', v: 2287, c: 312, s: '注册报告、开放数据、统计分析计划预审，这三项制度的采用率十年间从个位数涨到三成以上。改变很慢但在发生：越来越多的期刊把「能否重复」放在「是否新颖」之前。' },
    { t: '生物节律研究的最新共识：光照比褪黑素更重要', a: '生命科学速递', ut: 'life-sci-daily', v: 1876, c: 198, s: '近三年的节律研究把干预重点从补充剂转向了光照处方：晨间强光、傍晚减光、夜间避蓝光。对普通人的可执行建议浓缩成一句话：先管光，再管药。' },
  ],
  travel: [
    { t: '冰岛环岛攻略：九天行程怎么排才不赶路', a: '地理漫游记', ut: 'geo-traveler', v: 4765, c: 423, s: '环岛一号公路两千公里，九天是舒适下限。南岸瀑布与黑沙滩安排两天，东部峡湾一天，米湖与阿克雷里两天，斯奈山半岛收尾。每天驾驶不超过三小时，才看得见风景。' },
    { t: '极光观测的正确姿势：工具、地点与心态', a: '极光猎人笔记', ut: 'aurora-hunter', v: 3987, c: 356, s: 'KP 指数只是入门，真正决定成败的是云图与月相。三个免费工具组合使用能把命中率提到七成：极光预报、低层云图、光污染地图。最后一味药是耐心：值得等三小时。' },
    { t: '目的地冷热交替：小城旅行为什么接棒网红城市', a: '旅行行业观察', ut: 'travel-biz-watch', v: 3245, c: 287, s: '网红城市的客流峰值正在向周边小城外溢：住宿价格差三倍、体验差异度反而更高。旅行平台的数据说，「冷门目的地」搜索量一年翻倍，反向旅游从段子变成了真趋势。' },
    { t: '徒步装备的轻量化陷阱：不是越轻越好', a: '山野装备党', ut: 'trail-gear', v: 2654, c: 312, s: '把背包减到五公斤的经验帖看了很多，真正走过长线才知道：睡眠系统和鞋是不能省的两样。轻量化应该从不带多余的东西开始，而不是从买更贵的东西开始。' },
    { t: '机票价格的玄学背后：收益管理系统怎么定价', a: '航空业内部', ut: 'airline-insider', v: 2321, c: 276, s: '同一条航线一天变价十几次，不是大数据杀熟，而是收益管理系统按舱位库存滚动调价。周二下午最便宜的说法早已过时，真正有效的策略是提前设好心理价位并开启价格提醒。' },
    { t: '旅行行业的复苏账本：客流回来了，利润去哪了', a: '文旅商业评论', ut: 'tourism-biz', v: 1987, c: 198, s: '客流恢复到九成，利润却只回到六成：人力成本上涨、低价团内卷、平台佣金提高吃掉了差价。行业里活得好的反而是小而专的定制社，规模和利润第一次不再正相关。' },
  ],
};

const GENERIC_TITLES = [
  (q) => `如何评价${q}？最近有哪些值得关注的进展？`,
  (q) => `${q} 到底解决了什么问题？一线从业者怎么看？`,
  (q) => `关于${q}，有哪些被低估的争议点？`,
  (q) => `${q} 的入门路径：从资料到实践，应该怎么安排？`,
  (q) => `为什么${q}最近突然火了？背后是偶然还是趋势？`,
  (q) => `在${q}方向上，普通人还有哪些真实的机会？`,
  (q) => `${q} 的常见误区，你踩过几个？`,
  (q) => `如何看待${q}领域里几派观点的分歧？`,
  (q) => `${q} 实操复盘：三个月的经验与教训`,
  (q) => `${q} 会对日常工作方式产生什么实际影响？`,
];

const GENERIC_EXCERPTS = [
  (q) => `谢邀。关注${q}有一段时间了，先说结论：这件事被讨论的热度超过了他实际落地的速度，但这恰恰说明方向是真的。目前能看到的落地案例集中在头部团队，普通人的机会在于把成熟做法搬到自己的细分场景里，而不是重复造轮子。`,
  (q) => `实名反对高赞的悲观论调。${q}现在的状态很像几年前的很多技术拐点：基础设施已经就位，缺的是把细节做扎实的人。真正拉开差距的不是认知，而是有没有人愿意把一件小事连续做三个月以上。`,
  (q) => `利益相关，从业三年。${q}这件事最大的误区是把它当成单一技能问题，实际上它是流程问题：上游的输入质量、中游的协作方式、下游的验收标准，任何一环掉链子，最后的结果都会很难看。`,
  (q) => `用数据说话：我统计了公开渠道能找到的近百个与${q}相关的案例，真正跑通的不到两成，但跑通的那部分复用性很强。结论是这个方向值得投入，但要抄已经验证过的路径，不要发明新轮子。`,
  (q) => `这个问题下面情绪化的回答太多了。关于${q}，我的建议是区分三个层次：概念层了解一下即可，方法层挑一个流派人格化地学，工具层够用就好。大多数人是倒过来学的，所以越学越焦虑。`,
];

// 任务五：仿真世界的「真实话题词」表（≥2 字）。模拟真实搜索的话题性：
// 真实话题词（如「红楼梦」）的搜索结果标题含原词；无话题度的词（切词碎片
// 如「被严重高」、生僻组合）只回泛相关内容，标题不含原词——业务侧
// 「候选标签须出现在搜索结果标题里」的搜索核验依赖这个性质做淘汰。
const KNOWN_TOPICS = [
  '红楼梦', '数字人文', '文创产业', 'AI', 'Agent', '大模型', '人工智能',
  '基金', '财经', '投资', '订阅', '变现', '独立开发', '预算', '降本', '股票',
  '城市', '居住', '房租', '县城', '回流', '远程', '编制', '就业', '杭州', '成都', '通勤',
  '睡眠', '加班', '专注', '健康', '焦虑', '休息', '运动', '情绪', '失眠',
  '国际', '美国', '海外', '全球', '硅谷', '科技公司', '出海',
  '阅读', '重读', '读书', '收藏夹', '学习方法', '信息过载', '完读', '知识管理',
  '游戏', '塞尔达', '独立游戏', '星露谷', '电竞', '设计', '交互', '作品集',
  '科学', '科普', '论文', '天文', '旅行', '冰岛', '极光', '攻略', '徒步',
];
const isKnownTopic = (query) => KNOWN_TOPICS.some((k) => query.includes(k));

const DOMAIN_KEYS = {
  finance: ['财经', '成本', '预算', '付费', '收入', '股票', '基金', '降本'],
  china: ['城市', '居住', '房租', '县城', '回流', '远程', '编制', '就业', '杭州', '成都'],
  life: ['睡眠', '加班', '专注', '通勤', '健康', '焦虑', '休息', '晚上'],
  world: ['国际', '美国', '海外', '全球', '硅谷', '科技公司'],
  gaming: ['游戏', '电竞', '玩家', '塞尔达', '主机'],
  design: ['设计', '交互', '视觉', '作品集', 'CMF'],
  science: ['科学', '论文', '物理', '生物', '天文', '科普', '实验'],
  travel: ['旅行', '目的地', '攻略', '出行', '徒步', '自驾', '冰岛'],
  culture: ['文化', '读书', '书'],
};

function detectDomain(query) {
  for (const [dom, kws] of Object.entries(DOMAIN_KEYS)) {
    if (kws.some((k) => query.includes(k))) return dom;
  }
  return null;
}

function searchItem({ t, a, v, c, s, ut }, seedPrefix) {
  const isArticle = md5(seedPrefix + t)[0] < '8';
  return {
    AuthorName: a,
    ...(ut ? { UrlToken: ut } : {}),
    CommentCount: c,
    ContentID: numId(`search:${seedPrefix}${t}`),
    ContentText: s,
    ContentType: isArticle ? 'Article' : 'Answer',
    EditTime: now() - int(md5(t).slice(0, 2), 16) * DAY % (50 * DAY),
    Title: t,
    Url: isArticle
      ? `https://zhuanlan.zhihu.com/p/${numId(`search:${t}`, 18)}`
      : `https://www.zhihu.com/question/${numId(`sq:${t}`, 18)}/answer/${numId(`search:${t}`, 18)}`,
    VoteUpCount: v,
  };
}

/** 搜索分发：样本主题命中回真实样本；领域词命中回领域库；其余按查询词合成 */
function handleSearch(url) {
  const query = (url.searchParams.get('Query') || '').trim();
  const count = Math.min(int(url.searchParams.get('Count'), 10), 10);
  const qLower = query.toLowerCase();

  let items;
  if (/(信息过载|阅读|重读|读书|收藏夹|完读|学习方法)/.test(query)) {
    items = SAMPLE.search.reading.Data.Items;
  } else if (/(独立开发|变现|订阅)/.test(query) || /app/i.test(query)) {
    items = SAMPLE.search.indie.Data.Items;
  } else {
    const dom = detectDomain(query);
    if (dom) {
      items = SEARCH_BANKS[dom].map((x) => searchItem(x, 'dom'));
    } else if (/(ai|agent|产品|设计|模型|工具|互联网|开发|编程)/.test(qLower)) {
      items = SAMPLE.search.ai.Data.Items;
    } else if (isKnownTopic(query)) {
      // 真实话题词：合成结果的标题含原词
      const rand = seededRand(`search:${query}`);
      const authors = [
        { n: '深夜书桌', ut: 'midnight-desk' }, { n: '产品观察员' }, { n: '理性讨论小组', ut: 'rational-group' },
        { n: '行业内部人', ut: 'industry-insider' }, { n: '方法论爱好者' }, { n: '数据不说谎', ut: 'data-no-lie' },
        { n: '冷启动实践者' }, { n: '长期主义笔记', ut: 'longterm-notes' },
      ];
      items = GENERIC_TITLES.map((tf, i) => searchItem({
        t: tf(query),
        a: authors[i % authors.length].n,
        ut: authors[i % authors.length].ut,
        v: 400 + Math.floor(rand() * 6000),
        c: 30 + Math.floor(rand() * 400),
        s: GENERIC_EXCERPTS[i % GENERIC_EXCERPTS.length](query),
      }, 'gen'));
    } else {
      // 无话题度的词（切词碎片/生僻组合）：真实搜索只回泛相关内容，标题不含原词。
      // 从领域库按 query 确定性抽样模拟，保证「被严重高」搜不到任何含它的标题
      const pool = Object.values(SEARCH_BANKS).flat();
      const offset = Math.floor(seededRand(`search-off:${query}`)() * pool.length);
      items = Array.from({ length: 10 }, (_, i) => searchItem(pool[(offset + i) % pool.length], `off:${query}`));
    }
  }
  return { Code: 0, Data: { HasMore: false, Items: items.slice(0, count), SearchHashId: md5(`sim:${query}`) }, Message: 'success' };
}

// ---------------- 合成：问题推荐与回答 ----------------

// 合成问题的 id → 标题反查表（供通用合成回答引用题干）
const synthQuestionTitles = new Map();

const QREC_TEMPLATES = [
  (q) => `${q} 目前发展到什么阶段了？有哪些标志性事件？`,
  (q) => `普通从业者如何系统地了解${q}？`,
  (q) => `${q} 有哪些被严重低估的变化？`,
  (q) => `如何评价${q}最近一年的争议与分歧？`,
  (q) => `${q} 对日常工作方式会有什么实际影响？`,
];

function synthQuestions(query, count) {
  return QREC_TEMPLATES.slice(0, Math.max(1, count)).map((tf) => {
    const title = tf(query);
    const id = numId(`qrec:${title}`);
    const url = `https://www.zhihu.com/question/${id}`;
    synthQuestionTitles.set(id, title);
    return { Title: title, Url: url };
  });
}

function handleQrec(url) {
  const query = (url.searchParams.get('Query') || '').trim();
  const count = Math.min(int(url.searchParams.get('Count'), 5), 20);

  // 配额演练：creator 池耗尽（业务错误契约：HTTP 200 + Code）
  if (QUOTA_EXHAUST) {
    return { Code: 30002, Data: null, Message: '创作能力池当日额度已用尽（仿真演练）' };
  }

  if (!query) return SAMPLE.qProfile; // 无 query：平台侧画像探测样本

  let items;
  if (/(信息过载|阅读|重读|读书|收藏夹|完读|学习方法)/.test(query)) {
    items = SAMPLE.qrec.reading.Data.Items;
  } else if (/(独立开发|变现|订阅)/.test(query) || /app/i.test(query)) {
    items = SAMPLE.qrec.indie.Data.Items;
  } else if (/(ai|产品|设计)/i.test(query)) {
    items = SAMPLE.qrec.ai.Data.Items;
  } else {
    items = synthQuestions(query, 5);
  }
  return { Code: 0, Data: { Items: items.slice(0, count) }, Message: 'success' };
}

const GENERIC_ANSWERS = [
  { a: '认真答一发', ut: 'answer-serious', v: 3421, s: (qt) => `谢邀。关于「${qt}」，先说结论：这件事的真实进展比舆论热度慢半拍，但方向是确定的。我这两年跟踪下来的感受是，头部团队已经把路径跑通，接下来是方法论向中小团队扩散的阶段，普通人现在入场不算晚。` },
  { a: '反方辩手', ut: 'answer-contrarian', v: 2187, s: (qt) => `实名反对这个问题下的多数乐观回答。「${qt}」被过度包装的部分在于：成功案例全都附带没说出来的前提条件。把前提补齐之后你会发现，这件事对资源禀赋的要求比想象中高，盲目跟风的大概率成为分母。` },
  { a: '数据考据派', v: 1876, s: (qt) => `用数据说话。我整理了公开渠道能找到的与「${qt}」相关的近百个案例，按结果分类后有三个发现：一是成功率约两成但复用性强；二是失败案例八成死在同一个环节；三是时间投入与结果的相关性远高于天赋。` },
  { a: '一线从业者', ut: 'answer-frontline', v: 1543, s: (qt) => `利益相关，说点一线体会。「${qt}」这件事，外行看的是热闹，内行看的是流程：输入质量、协作方式、验收标准，三个环节任何一环掉链子结果都会很难看。建议新手先别急着学方法，先跟一个完整流程走一遍。` },
  { a: '长期观察者', v: 986, s: (qt) => `这个问题三年前就有人问过，三年后再看「${qt}」，当年争论的两派各对了一半：乐观派对方向的判断对了，悲观派对节奏的判断对了。我的建议是把它当成一个慢变量来配置精力，而不是当成风口来追逐。` },
];

function handleQans(url) {
  const questionUrl = (url.searchParams.get('QuestionUrl') || '').trim();
  const limit = Math.min(int(url.searchParams.get('Limit'), 20), 50);
  const offset = int(url.searchParams.get('Offset'), 0) || undefined;

  const sample = qansByQuestionUrl.get(questionUrl);
  if (sample) {
    // 尊重样本分页：带 NextOffset 翻页时仅支持第一页之后的空页（业务侧单次取 5 条）
    if (offset) return { Code: 0, Data: { Items: [], Paging: { IsEnd: true } }, Message: 'success' };
    return {
      Code: 0,
      Data: { Items: sample.Data.Items.slice(0, limit), Paging: sample.Data.Paging ?? { IsEnd: true } },
      Message: 'success',
    };
  }

  // 未知问题：按 QuestionUrl 确定性合成通用回答
  const qid = questionUrl.match(/question\/(\d+)/)?.[1] ?? questionUrl;
  const qt = synthQuestionTitles.get(qid) ?? '这个问题';
  const items = GENERIC_ANSWERS.slice(0, Math.max(1, Math.min(limit, GENERIC_ANSWERS.length))).map((x) => ({
    ContentToken: numId(`qans:${qid}:${x.a}`),
    ContentType: 'answer',
    Title: qt,
    AuthorName: x.a,
    ...(x.ut ? { UrlToken: x.ut } : {}),
    VoteUpCount: x.v,
    Summary: x.s(qt),
    Url: `https://www.zhihu.com/question/${qid}/answer/${numId(`qans:${qid}:${x.a}`)}`,
  }));
  return { Code: 0, Data: { Items: items, Paging: { IsEnd: true } }, Message: 'success' };
}

// ---------------- 额度 ----------------

function handleQuota() {
  const counted = {
    hot_list: stats.byApi.hot_list ?? 0,
    zhihu_search: stats.byApi.zhihu_search ?? 0,
    question_answers: stats.byApi.question_answers ?? 0,
    creator: stats.byApi.creator ?? 0,
    user_data: stats.byApi.user_data ?? 0,
    zhida_openai: stats.byApi.zhida_openai ?? 0,
  };
  return {
    Code: 0,
    Data: SAMPLE.quota.Data.map((q) => {
      const used = counted[q.APIID] ?? 0;
      return {
        APIID: q.APIID,
        APIName: q.APIName,
        TotalQuota: q.TotalQuota,
        TotalUsed: used,
        RemainingQuota: Math.max(0, q.TotalQuota - used),
      };
    }),
    Message: 'success',
  };
}

// ---------------- 直答：结构化调研 JSON ----------------

const REPORT_BANKS = {
  tech: {
    judgement: '大模型应用继续向具体工作流渗透，工具与分工在加速分化。',
    progress: [
      '大模型的能力更新已经从「能聊天」进入「能干活」阶段，Agent 编排成为产品竞争的主战场。',
      '一线团队共识是：生产环境里要先砍掉大部分自由工具调用，可控的工作流编排比自由的智能更有商业价值。',
      'AI 编程工具普及一年之后，工程师群体的分化开始显现：会编排 Agent 的人把重复劳动压缩到两成。',
      '小团队接入大模型的成本结构已经摸清：缓存挡重复请求、路由分大小模型，月成本可以压到原来的零头。',
      '提示词技巧在贬值，上下文工程在升值：检索、裁剪、排序、注入的质量决定了输出质量的上限。',
    ],
    schools: [
      '一派认为闭源旗舰模型的稳定性仍是企业级市场的护城河，尤其体现在工具调用和长任务可靠性上。',
      '另一派押注开源模型，认为追到旗舰九成能力之后，竞争的胜负手已经从跑分转向推理成本。',
      '还有一派更激进，干脆放弃通用 Agent，把模型嵌进垂直工作流里做「看不见的 AI」。',
      '几派的分歧本质上是对「模型能力还会不会快速跃迁」的判断不同，而不是对工程实践的分歧。',
    ],
    meaning: [
      '对你来说，值得跟踪的不是榜单分数，而是自己工作流里哪些环节已经可以稳定交给 Agent。',
      '把重复性最高的一个环节先工具化，比泛泛地关注行业进展更能积累真实判断力。',
      '工具链的成熟让个人开发者第一次拥有了接近小团队的产能，瓶颈回到了判断力与执行力。',
    ],
  },
  finance: {
    judgement: '钱的逻辑正在从流量故事回到单位经济模型，精细化运营是主线。',
    progress: [
      '订阅制产品的定价讨论明显增多，越来越多的案例显示低价套餐反而拉低留存、推高服务成本。',
      '独立开发者的收入结构被反复拆解：平台分成、退款率、税务合规成为绕不开的三本账。',
      '企业端的降本话题从裁员叙事转向账单审计，云成本、订阅支出、工具栈冗余被逐行检查。',
      '知识付费的高退款率促使创作者调整承诺方式，交付节奏和试看深度成为新的转化变量。',
    ],
    schools: [
      '一派主张用低价快速做大规模再逐步提价，认为早期的现金流比利润率重要。',
      '另一派坚持一开始就把定价定在可持续的位置，认为定价的本质是筛选用户而非促销。',
      '在资产配置话题上，指数定投派与主动管理派的争论仍在继续，但纪律的重要性已是共识。',
    ],
    meaning: [
      '对你的意义在于：任何「睡后收入」的故事背后都有一张成本清单，先看清单再看故事。',
      '把自己的固定支出、订阅支出做一次审计，往往比寻找新收入源更能改善现金流。',
      '如果你在考虑副业或独立开发，税务与合规越早理清，后期的代价越小。',
    ],
  },
  china: {
    judgement: '居住与就业的再配置仍在继续，远程与回流是两条真实的路径。',
    progress: [
      '远程岗位的数量在增加，但隐性门槛同步抬高，资深经验要求的比例明显上升。',
      '回流县城的年轻人分化明显：考编之外，电商、自媒体和本地服务数字化是三条被验证的路。',
      '一二线城市的租金议价空间明显松动，租客的谈判地位是近几年最好的时候。',
      '就业心态从跳槽涨薪转向保住饭碗，谈薪预期普遍下调，稳定第一次排在成长前面。',
    ],
    schools: [
      '一派认为编制的稳定性在不确定环境里价值上升，值得用成长性去交换。',
      '另一派指出县城的技能折价速度被低估，稳定的价格可能是停滞。',
      '中间派主张地理套利：拿一线城市的收入、付二线城市的成本，用远程岗位对冲风险。',
    ],
    meaning: [
      '对你而言，居住决策可以用通勤时间折算时薪来重新算账，而不是只看房租绝对值。',
      '远程机会的真实门槛在于可见度管理，这需要主动设计汇报与协作的节奏。',
      '无论选择哪条路，保持技能的市场定价能力，是应对不确定性的底仓。',
    ],
  },
  world: {
    judgement: '海外科技行业进入成本与叙事的双重博弈，工作方式之争远未结束。',
    progress: [
      '大模型的全球竞赛正在从技术战变成成本战，API 价格一年下降八成以上。',
      '美国科技公司的远程办公政策持续反复，强制到岗与人才流失的拉锯仍在继续。',
      '订阅疲劳成为真实的消费情绪，海外家庭平均背着十几个订阅，退订工具快速增长。',
      '科技发布会的叙事愈发模板化：先使命、再数字、后价格，故事能力成为竞争力本身。',
    ],
    schools: [
      '一派认为闭源与合规壁垒会让美国头部公司继续保持定价权。',
      '另一派认为开源生态会把推理成本压到接近零，最终的利润池在应用层。',
      '在工作方式上，到岗派与远程派各自拿着生产率数据互相反驳，共识远未形成。',
    ],
    meaning: [
      '这些外部讨论对你工作方式的参照在于：流程与工具的选择，比立场站队重要得多。',
      '海外冷启动方法的本土化（垂直社区加内容加小额推广）对个人产品同样适用。',
      '关注海外订阅退潮的信号，可以提前校准自己对订阅制产品的收入预期。',
    ],
  },
  life: {
    judgement: '睡眠、专注与精力管理继续成为高压工作下的自救主线。',
    progress: [
      '用可穿戴设备的睡眠数据与主管对话的案例变多，数据化的健康主张比抱怨更有说服力。',
      '九十分钟工作块的节奏方法在深度工作社群里被反复验证，节奏比意志力更可靠。',
      '把担忧写下来的认知行为方法重新流行，焦虑被从情绪转化为可处理的任务清单。',
      '光照与昼夜节律的关系被更多科普内容覆盖，晨间晒太阳成为最低成本的睡眠干预。',
    ],
    schools: [
      '一派主张用数据驱动的方式管理身体：睡眠监测、心率变异性、量化复盘。',
      '另一派强调环境与节奏的设计：工作块、通勤利用、休息的层次化安排。',
      '还有一派从心理层面入手，认为焦虑的根源是失控感，解决方法是重建可控清单。',
    ],
    meaning: [
      '对你的提醒是：休息是需要设计的，不是工作剩下的时间。',
      '通勤这类被迫的整块时间，经过标准化之后可以变成稳定的学习增量。',
      '如果最近状态下滑，先查睡眠和光照这两个最基础的变量，再谈方法论。',
    ],
  },
  culture: {
    judgement: '对抗信息过载的方法论继续收敛：问题驱动与重读成为共识。',
    progress: [
      '重读的价值被反复论证：带着新问题回到经典，看到的全是第一遍看不见的东西。',
      '收藏夹整理术持续进化：定期清理、强制加工、标签合并成为对抗松鼠病的三件套。',
      '主题阅读法的实操路径清晰：综述建框架、多立场对照、一手资料收口，一个月可入门一个领域。',
      '电子书完读率低迷促使阅读方法更新：带着问题翻书，找到答案就放下，读完不再是目的。',
    ],
    schools: [
      '一派是卡片盒方法的信徒，强调想法之间的连接密度决定笔记的价值。',
      '另一派认为方法论的收藏本身就是问题，方法必须匹配任务类型才有意义。',
      '还有一派主张极简：一个主题只保留三本书的容量，强迫自己取舍。',
    ],
    meaning: [
      '对你的启示是：收藏只有经过再加工才算真正拥有，否则只是数字囤积。',
      '本月如果想启动一个新主题，先用一篇综述和三个问题搭出最小框架。',
      '把「读完」的执念换成「带走三个可复用的判断」，阅读压力会小很多。',
    ],
  },
  gaming: {
    judgement: '新作节奏趋稳，行业讨论集中在商业模式与玩家共创。',
    progress: [
      '新作的话题集中在引导设计与开放世界细节上，塞尔达式的视觉锚点引导仍是被拆解最多的范式。',
      '独立游戏的生存环境在改善：发行分成下降、短视频带量效率提升，让小团队看到了可复制的活路。',
      '玩家社区正在深度介入开发节奏：抢先体验、公开路线图投票、MOD 收编成为常规操作。',
      '电竞与主机市场的讨论转向商业模式：版权分成、订阅库与首发意义的重估是三条主线。',
    ],
    schools: [
      '一派认为内容为王：首周销量的分化说明题材与品质依然是唯一的硬通货。',
      '另一派认为运营为王：稳定的内容节奏和不过度透支的付费设计，比首发爆量更决定长线。',
      '社区派则强调共创：把玩家当成开发的一部分，是小团队对抗大制作的唯一杠杆。',
    ],
    meaning: [
      '对你来说，玩家社区的讨论热度是判断一部作品是否值得投入时间的最好先行指标。',
      '关注独立游戏的商业模式复盘，对任何「小而美」的产品都有参照价值。',
    ],
  },
  design: {
    judgement: 'AI 进入交付流之后，设计分工与评审标准都在重写。',
    progress: [
      'AI 出图进入正式交付流，草图与灵感环节被大幅压缩，设计师的时间转向需求澄清与决策依据。',
      '界面趋势集体转向克制：高密度排版与明确层级回归，效率取代沉浸成为被引用最多的词。',
      '设计系统的落地经验趋于一致：组件库只是小头，令牌治理与迁移优先级才是成败关键。',
      'CMF 与微文案这类「隐形杠杆」被重新定价，AI 渲染把方案验证周期从周压到小时。',
    ],
    schools: [
      '一派认为工具只是放大器：说不清设计决策依据的人，有 AI 也做不出好方案。',
      '另一派认为工具改变分工：不会编排 AI 出图流的设计师，交付速度会落后一个量级。',
      '务实派主张按环节切分：探索期用 AI 拓宽选项，收敛期回到人工判断。',
    ],
    meaning: [
      '对你的参考是：作品集与方案汇报里，决策依据的呈现比视觉稿本身更能建立专业信任。',
      '把微文案、CMF 这类低成本高杠杆的细节排进需求列表，往往比大改版见效更快。',
    ],
  },
  science: {
    judgement: '工具型论文与可重复性制度，是当前科学讨论的两条主线。',
    progress: [
      '高引论文的分布显示：提供基准、开源实现与系统综述的工具型工作，比开新方向更受共同体奖励。',
      '重大科学争议的收场路径越来越依赖重复实验的发表速度，它比任何声明都更接近真相。',
      '可重复性危机十年之后，注册报告与开放数据的采用率显著上升，评审标准正在向「能否重复」倾斜。',
      '时域天文、生物节律等方向产出了大量可向公众解释的新成果，科普素材处于丰收期。',
    ],
    schools: [
      '一派强调科学共同体的自我修正机制正在起效，制度化的透明是唯一出路。',
      '另一派担心流量逻辑侵入科普：标题夸大与正文严谨的共存正在透支公众信任。',
      '折中派认为关键是保留不确定性的说明：把「我们还不知道」讲清楚就是好科普。',
    ],
    meaning: [
      '对你来说，跟踪科学争议时看重复实验的进展，比看双方声明更有效。',
      '节律研究的可执行结论很朴素：先管光照，再谈补充剂。',
    ],
  },
  travel: {
    judgement: '目的地冷热交替，攻略方法论与行业账本都值得关注。',
    progress: [
      '网红城市的客流正在向周边小城外溢，「冷门目的地」搜索量翻倍，反向旅游成为真趋势。',
      '长线攻略的方法论在收敛：行程舒适下限、驾驶时长控制、工具组合使用是被反复验证的框架。',
      '极光、徒步等主题旅行的内容越来越工具化：云图、预报、装备清单都有可复用的标准答案。',
      '行业端的账本显示客流恢复快于利润，小而专的定制社活得比大团更好。',
    ],
    schools: [
      '一派是方法论派：带着观察框架上路，风景才会变成证据。',
      '另一派是松弛派：反对把旅行变成任务清单，主张留白与随机。',
      '行业派则提醒：低价内卷的供给端正在影响体验底线，选供应商比选目的地更重要。',
    ],
    meaning: [
      '对你的实用建议：长途行程按每天不超过三小时驾驶来排，体验会好一个档次。',
      '关注目的地冷热交替的节奏，错开网红峰值往往能用三分之一的成本拿到同等体验。',
    ],
  },
};

function genericBank(topic) {
  return {
    judgement: `${topic}的讨论集中在落地路径与真实收益上。`.slice(0, 40),
    progress: [
      `围绕「${topic}」的讨论最近明显增多，一线从业者的共识是它已经从概念验证进入落地阶段。`,
      `目前能看到的路径大致三条：头部团队的成熟做法、垂直场景的改造应用、以及个人玩家的小步试错。`,
      `被反复提及的经验是：把「${topic}」当成流程问题而不是单点技能问题的人，进展普遍更稳。`,
      `数据派统计显示，相关案例的真实成功率约两成，但成功路径的复用性很强。`,
    ],
    schools: [
      `乐观派认为「${topic}」的窗口刚刚打开，现在入场的成本最低。`,
      `谨慎派指出被忽略的前提条件：资源禀赋和持续投入决定了大多数尝试的结局。`,
      `中间派建议区分概念、方法与工具三个层次，各取所需，避免整体性的盲目跟风。`,
    ],
    meaning: [
      `对你来说，比较稳妥的策略是先抄已经验证过的路径，再根据反馈调整投入。`,
      `把「${topic}」当作一个慢变量来配置精力，比当成风口追逐更符合大多数人的处境。`,
    ],
  };
}

const WHY_NOW_POOL = [
  '这篇把整体框架讲得最清楚，先读它建立全局认识。',
  '作者提供了一线实操数据，经验可以直接复用。',
  '观点与主流意见相反，对照着看能校准判断。',
  '这篇的分歧点本身就有信息量，适合现在细读。',
  '篇幅短但密度高，适合当下快速读完立用。',
];

const WEAVE_TEMPLATES = [
  (t) => `《${t}》把这件事的来龙去脉讲得比较完整，可以作为今天了解进展的入口。`,
  (t) => `《${t}》提供了一线视角，其中的具体做法值得对照自己的情况拆解。`,
  (t) => `围绕《${t}》的讨论能看到明显的观点分层，分歧本身就值得注意。`,
];

function handleZhida(body) {
  let prompt = '';
  try {
    const parsed = JSON.parse(body || '{}');
    const msgs = parsed.messages ?? [];
    prompt = msgs.filter((m) => m.role === 'user').map((m) => m.content).join('\n') || '';
  } catch { /* 下面按空 prompt 处理 */ }

  const domainName = (prompt.match(/领域：([^\n]+)/)?.[1] ?? '').trim();
  const [, minWs, maxWs] = prompt.match(/恰好 3 段，(\d+)-(\d+) 字/) ?? [];
  const minW = Math.max(120, int(minWs, 300));
  const maxW = Math.min(780, int(maxWs, 500));
  const recsN = Math.min(5, Math.max(2, int(prompt.match(/recommended 给 (\d+) 篇/)?.[1], 3)));

  const sources = [];
  const srcRe = /\[\d+\] id=(src_[0-9a-f]{12}) 来源类型=\S+\n标题：([^\n]+)/g;
  let m;
  while ((m = srcRe.exec(prompt)) !== null) sources.push({ source_id: m[1], title: m[2] });

  const bankMap = {
    科技: 'tech', 财经: 'finance', 国内: 'china', 国际: 'world', 生活: 'life', 文化: 'culture',
    游戏: 'gaming', 设计: 'design', 科学: 'science', 旅行: 'travel',
  };
  const bank = REPORT_BANKS[bankMap[domainName]] ?? genericBank(domainName || '这个主题');
  const rand = seededRand(`zhida:${domainName}:${sources.map((s) => s.source_id).join(',')}`);
  const pick = (arr, n) => {
    const pool = [...arr];
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  };

  const target = Math.min(maxW - 20, minW + Math.floor((maxW - minW) * 0.55));
  const weave = sources.slice(0, 2).map((s, i) => WEAVE_TEMPLATES[i % WEAVE_TEMPLATES.length](s.title.slice(0, 30)));
  const p1 = [...pick(bank.progress, 2), ...weave].join('');
  const p2 = pick(bank.schools, 2).join('');
  const p3 = pick(bank.meaning, 2).join('');
  const paras = [p1, p2, p3];
  let report = paras.join('\n\n');
  // 篇幅补足：从句库继续补句，直到达到目标长度（不超过上限）
  const extras = [...bank.progress, ...bank.schools, ...bank.meaning];
  let i = 0;
  while (report.length < target && i < extras.length * 2) {
    const s = extras[i % extras.length];
    if (!report.includes(s) && report.length + s.length <= maxW - 10) {
      paras[1] += s;
      report = paras.join('\n\n');
    }
    i += 1;
  }

  const recommended = sources.slice(0, recsN).map((s, idx) => ({
    source_id: s.source_id,
    title: s.title,
    why_now: WHY_NOW_POOL[idx % WHY_NOW_POOL.length],
  }));

  return {
    id: `chatcmpl-sim-${md5(prompt).slice(0, 10)}`,
    object: 'chat.completion',
    created: now(),
    model: 'zhida-fast-1p5',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          judgement: bank.judgement,
          report,
          recommended,
        }),
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: prompt.length, completion_tokens: report.length, total_tokens: prompt.length + report.length },
  };
}

// ---------------- 路由 ----------------

async function route(req, res, url) {
  const p = url.pathname;

  // 运维接口（不计入业务额度统计）
  if (p === '/_sim/stats') {
    return send(res, {
      uptime_s: Math.floor((Date.now() - stats.startedAt) / 1000),
      total_requests: stats.total,
      quota_exhaust_mode: QUOTA_EXHAUST,
      by_api: stats.byApi,
      by_path: stats.byPath,
      recent: stats.recent.slice(-10),
    });
  }
  if (p === '/_sim/reset') {
    stats.total = 0;
    stats.byApi = {};
    stats.byPath = {};
    stats.recent = [];
    return send(res, { ok: true });
  }
  // 任务四：画像场景切换（sparse=只有文化信号的稀疏画像）
  if (p === '/_sim/scene') {
    const set = url.searchParams.get('set');
    if (req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (SCENES.has(body.scene)) SCENE = body.scene;
    } else if (SCENES.has(set)) {
      SCENE = set;
    }
    return send(res, { ok: true, scene: SCENE });
  }

  // 内容接口
  if (p === '/api/v1/content/hot_list') { track('hot_list', req, url); return send(res, SAMPLE.hot); }
  if (p === '/api/v1/content/zhihu_search') { track('zhihu_search', req, url); return send(res, handleSearch(url)); }
  if (p === '/api/v1/content/question_answers') { track('question_answers', req, url); return send(res, handleQans(url)); }

  // 用户接口
  if (p === '/api/v1/user/question_recommendations') { track('creator', req, url); return send(res, handleQrec(url)); }
  if (p === '/api/v1/user/followees') { track('user_data', req, url); return send(res, SCENE === 'sparse' ? emptied(SAMPLE.followees) : SAMPLE.followees); }
  if (p === '/api/v1/user/favlists') { track('user_data', req, url); return send(res, SCENE === 'sparse' ? emptied(SAMPLE.favlists) : SAMPLE.favlists); }
  if (p === '/api/v1/user/contents') { track('user_data', req, url); return send(res, synthContents()); }
  if (p === '/api/v1/user/collections') { track('user_data', req, url); return send(res, synthCollections()); }

  // 额度
  if (p === '/api/v1/quota') { track('quota', req, url); return send(res, handleQuota()); }

  // 直答
  if (p === '/v1/chat/completions' && req.method === 'POST') {
    track('zhida_openai', req, url);
    return send(res, handleZhida(await readBody(req)));
  }

  // OAuth 桩（仿真模式下 OAuth 三个 URL 也会被重定向到这里）
  if (p === '/authorize') {
    track('oauth', req, url);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>知乎授权（仿真）</h1><p>这是模拟授权页，真实环境会跳转知乎。</p>');
  }
  if (p === '/access_token' && req.method === 'POST') {
    track('oauth', req, url);
    await readBody(req);
    return send(res, { access_token: `sim-oauth-${md5(String(Date.now())).slice(0, 16)}`, token_type: 'Bearer', expires_in: 7200 });
  }
  if (p === '/user') {
    track('oauth', req, url);
    return send(res, {
      uid: '123456789012345678',
      hash_id: 'sim-hash-id',
      fullname: '仿真用户',
      gender: 'unknown',
      headline: '仿真模式下的演示账号',
      description: '该账号由 scripts/simulate.js 生成，仅用于零配额调试。',
      avatar_path: '',
      url: 'https://www.zhihu.com/people/sim-user',
    });
  }

  return send(res, { Code: 10001, Message: `sim: 未实现的端点 ${req.method} ${p}` });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    await route(req, res, url);
  } catch (err) {
    console.error('  [sim] 处理出错:', err);
    send(res, { Code: 90001, Message: `sim 内部错误: ${err.message}` }, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  知乎开放平台 · 仿真服务');
  console.log(`  监听 http://127.0.0.1:${PORT}`);
  console.log(`  样本目录: ${SAMPLES_DIR}`);
  console.log(`  creator 池额度演练: ${QUOTA_EXHAUST ? '已开启（question_recommendations 返回 30002）' : '关闭'}`);
  console.log('  统计: GET /_sim/stats ｜ 清零: GET /_sim/reset\n');
});

export { server };
