import type { DailyPaper, DomainBlock, DomainId, DomainStory } from "@/domain/types";

function story(
  date: string,
  domainId: DomainId,
  slug: string,
  title: string,
  dek: string,
  body: string,
  bullets: string[],
  extras: Partial<DomainStory> = {},
): DomainStory {
  return {
    id: `${date}-${domainId}-${slug}`,
    domainId,
    title,
    dek,
    body,
    bullets,
    sourceCount: extras.sourceCount ?? 6,
    readMinutes: extras.readMinutes ?? 3,
    sourceUrl: extras.sourceUrl ?? "https://www.zhihu.com",
    heat: extras.heat,
    evidence: extras.evidence,
    judgment: extras.judgment,
    briefing: extras.briefing,
    readings: extras.readings,
    indexNote: extras.indexNote,
  };
}

function block(domainId: DomainId, lead: DomainStory, items: DomainStory[] = []): DomainBlock {
  return { domainId, lead, items };
}

function paper(input: {
  date: string;
  displayDate: string;
  weekday: string;
  lunar?: string;
  issueNo: number;
  hero: DailyPaper["hero"];
  top5: DailyPaper["top5"];
  domains: DomainBlock[];
  quote: string;
  cover: DailyPaper["cover"];
}): DailyPaper {
  return {
    id: `paper-${input.date}`,
    monthLabel: "九月.2026",
    ...input,
  };
}

const d13 = "2026-09-13";
const s13tech = story(
  d13,
  "tech",
  "prd",
  "把「写清楚」换成「验得过」",
  "市面上专注产品的人，正在把「写清楚」换成「验得过」。",
  "给林晚的产品调研：AI 进入流程之后，职责怎么重新分。",
  [],
  {
    sourceCount: 16,
    readMinutes: 6,
    evidence:
      "根据你关注的刘飞、梁宁及 3 位 AI 产品作者，收藏夹「AI 产品」「PRD 与需求」中的 12 篇，以及你本人「产品经理还要不要写 PRD」的创作主题，判断你持续关心：AI 进入产品流程之后，职责怎么重新分。今日综合知乎 16 篇（关注更新 5、收藏相关 6、主题搜索 5）。热榜上的「新模型发布」只用来确认议题还在，没有写进判断。",
    judgment: "市面上「专注产品」的讨论，已经从「用 AI 写得更快」转到「产品经理要不要还对流程负责」。",
    briefing: [
      "把这 16 篇叠在一起，能看出三条同时发生的变化。第一，PRD 没有消失，但正在从「写清楚」变成「写可验证」。多篇一线回答提到：AI 可以在一小时内产出完整文档，团队却在评审里花掉更长时间，因为没人标出验收节点。你收藏夹里反复出现的不是模板，而是「怎样算做完」。",
      "第二，真正开始分化的不是工具，是岗位。一种做法是把产品经理收成「目标设定者和审核者」，Agent 去跑调研、初稿、竞品表；另一种做法是继续让人写长文档，AI 只当润色。前者在创业团队和小组里出现得多，后者在大厂流程里更稳，也更慢。",
      "第三，市面上并不缺 AI 产品，缺的是能讲清边界的产品。搜索结果里，讲功能清单的文章很多，讲「什么任务不该交给模型」的很少。你关注的作者里，质量最高的几篇都在谈约束、失败案例和人机分责，而不是新功能。对你来说，今天有用的不是再收一套模板，而是选一个自己正在跑的需求，把「人决定 / Agent 执行 / 人验收」写成三列。写得出来，你才是在用这些讨论；写不出来，说明还停在收藏。",
    ],
    readings: [
      {
        title: "当 AI 可以写 PRD，产品经理还在负责什么",
        source: "关注的人 · 刘飞",
        why: "直接接上你自己写过的问题，先建立职责边界。",
        url: "https://zhuanlan.zhihu.com/p/189220013",
      },
      {
        title: "我们把需求评审改成了三个校验点",
        source: "知乎搜索 · 一线产品（有具体流程）",
        why: "有步骤、有失败，不是态度文。",
        url: "https://www.zhihu.com/question/661882013/answer/359120013",
      },
      {
        title: "Agent 能做完任务，和能做对任务，不是一回事",
        source: "收藏夹「AI 产品」近篇",
        why: "帮你把「更快」和「更可靠」分开。",
        url: "https://zhuanlan.zhihu.com/p/189220014",
      },
    ],
    indexNote: "原文索引：[1] 关注 · 刘飞 · PRD 职责　[2] 搜索 · 需求评审校验点　[3] 收藏 · Agent 做完 vs 做对　[4]–[16] 其余 13 篇只进入综合判断，不强制阅读。",
  },
);

export const seedPapers: DailyPaper[] = [
  paper({
    date: d13,
    displayDate: "09.13",
    weekday: "星期日",
    lunar: "甲辰年 七月廿二",
    issueNo: 14,
    hero: {
      kicker: "林晚 · 产品经理 / 杭州 · 综合 19 篇",
      title: "AI 正在改产品工作，而不只是多一个工具",
      subtitle: "根据你关注的 4 位产品/AI 创作者、收藏夹「AI 产品」「工作方法」近期 18 篇，以及你本人两篇关于 PRD 与评审的回答。",
      asideTitle: "今日判断",
      asidePoints: ["执行交出去", "目标和校验留下", "科技版最深", "文化版减速"],
      storyId: s13tech.id,
    },
    top5: [
      { storyId: s13tech.id, title: "产品经理还该不该写 PRD", domainId: "tech", heat: "收藏" },
      { storyId: s13tech.id, title: "Agent 能不能连续把活做完", domainId: "tech", heat: "搜索" },
      { storyId: `${d13}-culture-reread`, title: "重读比追新更重要", domainId: "culture", heat: "兴趣卡" },
      { storyId: `${d13}-finance-seat`, title: "为一次可验收的任务付费", domainId: "finance", heat: "补盲" },
      { storyId: `${d13}-life-off`, title: "晚上最后一次打开评审窗口", domainId: "life", heat: "切片" },
    ],
    domains: [
      block("tech", s13tech),
      block(
        "finance",
        story(
          d13,
          "finance",
          "seat",
          "为一次可验收的任务付费",
          "产品团队的钱，正在从「买一个席位」变成「为一次可验收的任务付费」。",
          "补盲：产品团队怎么为 AI 付钱。",
          [],
          {
            sourceCount: 9,
            readMinutes: 4,
            evidence:
              "你没有把财经标成主领域，但收藏夹「工作方法」和关注列表里，反复出现编制、工具预算、要不要为 AI 加席位。今日围绕「产品团队怎么为 AI 付钱」，从知乎搜索 9 篇 + 热榜发现的「企业订阅涨价」议题，综合 9 篇。个人内容里没有直接财经收藏，所以这版是补盲，不当头版。",
            judgment: "产品团队的钱，正在从「买一个席位」变成「为一次可验收的任务付费」。",
            briefing: [
              "知乎上做产品和做财务的人，最近在说同一件事：ChatGPT、Copilot、各类 Agent 的账单很好看，但很少有团队能指出它省下了哪一个岗位小时。讲「降本」的文章多，拿出工时对照表的少。",
              "和你有关的不是大盘，是评审时那句「我们要不要再开一个工具」。比较清楚的几篇经验是：先圈一个重复任务（竞品周报、纪要、初稿），记两周人工耗时，再买工具。买不起对照的，通常也讲不清效果。",
              "另一派提醒：工具费先降的是执行成本，评审和返工可能变贵。这和你科技版里「PRD 更好写、评审更难做」是同一条钱路。",
            ],
            readings: [
              { title: "我们把 AI 订阅写进项目成本，而不是研发福利", source: "知乎搜索 · 有预算表", why: "把席位费从福利改成可验收的项目成本。", url: "https://zhuanlan.zhihu.com/p/189220021" },
              { title: "工具省了写的时间，没省开会的时间", source: "知乎搜索", why: "对照你的评审痛点：更快的初稿，可能换来更贵的对齐。", url: "https://www.zhihu.com/question/661882021/answer/359120021" },
              { title: "怎样向老板解释这 2000 块该不该续", source: "知乎搜索", why: "可直接挪用话术，不必先发明一套财务语言。", url: "https://zhuanlan.zhihu.com/p/189220022" },
            ],
            indexNote: "原文索引挂这 3 篇即可，其余 6 篇只支撑「席位制在失效」这一句。",
          },
        ),
      ),
      block(
        "domestic",
        story(
          d13,
          "domestic",
          "city",
          "工作开始可拆，居住才能跟流程走",
          "小地方回流之所以又被提起，是因为产品岗的工作开始可拆、可远程。",
          "只写她收藏过的「人往哪住」。",
          [],
          {
            sourceCount: 8,
            readMinutes: 4,
            evidence:
              "根据收藏夹「城市与居住」中的 7 篇，以及你关注里两位在杭州/成都写城市的作者，判断你对国内公共议题的稳定兴趣是：工作和城市怎么互相改半径。今日综合 8 篇。热榜上的宏观时政没有进入正文。",
            judgment: "小地方回流之所以又被提起，是因为产品岗的工作开始可拆、可远程，居住选择第一次能跟流程走。",
            briefing: [
              "你收藏的不是「逃离北上广」，而是算账：房租、当面评审、带人、父母。把这些和科技版放在一起，国内版才有意义——当 Agent 接手一部分执行，产品经理对工位的依赖会下降，但对齐和验收仍可能要求人在场。",
              "知乎上比较有用的几篇，都在区分「个人贡献者可以走」和「还在带需求对齐的人走不远」。对你这种岗位，问题不是县城好不好，而是你这周必须当面做的事有几件。件数为零，城市才是变量；件数大于三，城市只是背景。",
            ],
            readings: [
              { title: "产品经理回县城的第一年，我失去的是信息密度", source: "收藏相关", why: "把「小地方」从情绪题收成信息密度账。", url: "https://zhuanlan.zhihu.com/p/189220031" },
              { title: "远程之后，哪些评审必须当面", source: "知乎搜索", why: "直接接上科技版：校验还在，人就还得在场。", url: "https://www.zhihu.com/question/661882031/answer/359120031" },
              { title: "杭州和成都的产品岗位，差在协作半径", source: "关注的人", why: "你人在杭州，这篇把城市差写成协作差。", url: "https://zhuanlan.zhihu.com/p/189220032" },
            ],
          },
        ),
      ),
      block(
        "world",
        story(
          d13,
          "world",
          "office",
          "他们在用出勤，补校验的缺口",
          "国外团队重新谈判的不是出勤，是哪些决策还必须人在一张桌子上。",
          "弱信号补盲。",
          [],
          {
            sourceCount: 7,
            readMinutes: 3,
            evidence:
              "你的关注和收藏几乎不看国际新闻。今日用热榜发现「全球科技公司回调远程」，再回知乎搜产品/研发怎么谈回办公室，综合 7 篇。这版是弱信号补盲：只保留和你「人机分责、要不要在场」相关的部分。",
            judgment: "国外团队重新谈判的不是出勤，是哪些决策还必须人在一张桌子上。",
            briefing: [
              "翻译成你的语言：Agent 可以异步交初稿，但目标、取舍、对用户负责，仍被很多团队当成必须同步的事。这和国内版、科技版是同一条缝。你不需要知道某家公司回办公室几天，只需要知道——他们在用出勤，补校验的缺口。",
              "若你已经把校验写进流程，回办公室的理由会变弱；若校验还只存在于口头，出勤会重新变成管理工具。",
            ],
            readings: [
              { title: "回办公室之后，我们到底在挽回什么", source: "知乎搜索 · 有团队案例", why: "看他们挽回的是效率，还是共同的验收标准。", url: "https://zhuanlan.zhihu.com/p/189220041" },
              { title: "远程崩掉的不是效率，是共同的验收标准", source: "知乎搜索", why: "把国际议题收回到你正在写的校验三列。", url: "https://www.zhihu.com/question/661882041/answer/359120041" },
            ],
          },
        ),
      ),
      block(
        "life",
        story(
          d13,
          "life",
          "off",
          "评审把晚上切碎了",
          "你的生活问题不是会不会休息，而是评审和信息流把晚上切碎了。",
          "只切片她正在用身体付的成本。",
          [],
          {
            sourceCount: 6,
            readMinutes: 3,
            evidence:
              "根据收藏夹「工作方法」里关于加班、专注和睡眠的 5 篇，以及你收下的兴趣方向「睡眠、通勤和身体的谈判」，判断生活版与你相关的不是养生，而是产品工作正在征收的注意力税。今日综合 6 篇。",
            judgment: "你的生活问题不是会不会休息，而是评审和信息流把晚上切碎了。",
            briefing: [
              "这 6 篇里，讲助眠产品和讲意志力的都容易空。真正接近你收藏的，是把晚睡写成「最后一次打开文档/消息的时间」。产品岗的典型消耗不是写，是不断被拉回对齐。AI 让初稿更快之后，这个消耗没有自动下降，有时还上升——因为可评审的东西变多了。",
              "所以生活版今天只给一个可做的观察：连续三天记下「晚上最后一次打开工作对话的时间」，不优化。它是科技版「校验变多」在身体上的收据。",
            ],
            readings: [
              { title: "我把下班定义成关掉所有评审窗口", source: "知乎搜索", why: "把休息从意志力改成一个可执行的关闭动作。", url: "https://zhuanlan.zhihu.com/p/189220051" },
              { title: "专注力不是美德，是环境", source: "收藏相关", why: "对应你收藏夹里那些关于加班和专注的篇目。", url: "https://www.zhihu.com/question/661882051/answer/359120051" },
            ],
          },
        ),
      ),
      block(
        "culture",
        story(
          d13,
          "culture",
          "reread",
          "把判断留在自己脑子里",
          "纸质回潮、重读、完读，在你这里不是品味，是对抗「收藏夹失控」的方法。",
          "她主动要的减速器。",
          [],
          {
            sourceCount: 8,
            readMinutes: 4,
            evidence:
              "根据你主动选择的「文化」、收下的「重读比追新更重要」，以及收藏里 4 篇关于阅读方法和旧回答的内容，判断你要文化版补的是：理解，而不是又收一层资讯。今日综合 8 篇。",
            judgment: "纸质回潮、重读、完读，在你这里不是品味，是对抗「收藏夹失控」的方法。",
            briefing: [
              "你已经有「AI 产品」「PRD 与需求」两个正在膨胀的收藏夹。知乎上讲纸质阅读、讲义、反复练习的几篇，共同点都是：难度要留下来，速度可以丢掉。这和科技版刚好相反相成——那边让你把执行交出去，这边让你把判断留在自己脑子里。",
              "对这份产品日报，文化版的任务很具体：今天科技版 3 篇原文，不要全部读完。选一篇手写 100 字：PRD 还该不该由人写。写得出来，才算读过；写不出来，就不要再收藏第 13 篇。",
            ],
            readings: [
              { title: "十分钟学会一切的承诺，开始贬值", source: "知乎搜索", why: "先拆掉「再收藏一篇就能学会」的幻觉。", url: "https://zhuanlan.zhihu.com/p/189220061" },
              { title: "我把收藏夹当成了伪学习", source: "知乎搜索", why: "直接刺你的使用方式。", url: "https://www.zhihu.com/question/661882061/answer/359120061" },
              { title: "重读旧回答，比追新一篇更有用", source: "与你收下的兴趣卡同题", why: "把发现页收下的那张卡，落成今天的一个动作。", url: "https://zhuanlan.zhihu.com/p/189220062" },
            ],
          },
        ),
      ),
    ],
    quote: "好日报，不只是信息，而是理解这个时代的另一种方式。",
    cover: {
      kicker: "正日报",
      headline: "世界并没有<br>突然改变<br>只是有些变化<br>终于被我们<br>看见了。",
      stats: "编排完成 16:24　　综合 19　原文 3",
    },
  }),
  paper({
    date: "2026-09-12",
    displayDate: "09.12",
    weekday: "星期六",
    issueNo: 13,
    hero: {
      kicker: "AI 精选 · 工作与生活",
      title: "关于工作、生活与选择的多种可能",
      subtitle: "同一天里，有人在换赛道，有人在重新定义休息。",
      asideTitle: "今天的判断",
      asidePoints: ["少追热点", "多看路径", "留下选择", "再作决定"],
      storyId: "2026-09-12-life-career",
    },
    top5: [
      { storyId: "2026-09-12-life-career", title: "转行不再是孤注一掷", domainId: "life", heat: "88.1万" },
      { storyId: "2026-09-12-tech-chip", title: "国产芯片工具链补上关键一环", domainId: "tech", heat: "76.4万" },
      { storyId: "2026-09-12-finance-consume", title: "消费市场出现新的结构性机会", domainId: "finance", heat: "64.0万" },
      { storyId: "2026-09-12-domestic-city", title: "当城市开始重新想象自己", domainId: "domestic", heat: "51.2万" },
      { storyId: "2026-09-12-culture-game", title: "游戏不只是娱乐", domainId: "culture", heat: "44.8万" },
    ],
    domains: [
      block(
        "life",
        story("2026-09-12", "life", "career", "转行不再是孤注一掷", "更多人把转行拆成可验证的小步骤。", "知乎上关于转行的讨论，正在从励志故事转向作品集、试工和收入曲线。人们要的是可回退的路径，而不是一次性跳跃。", ["先做可展示的作品", "用试工降低风险", "把生活成本算进决策"]),
      ),
      block(
        "tech",
        story("2026-09-12", "tech", "chip", "国产芯片工具链补上关键一环", "缺的不是口号，是能跑通的工具。", "一套开源编译与验证工具被更多团队采用，中小芯片团队第一次把设计周期压缩到可承受范围。", ["工具链比单点突破更重要", "开源正在降低试错成本"]),
      ),
      block(
        "finance",
        story("2026-09-12", "finance", "consume", "消费市场出现新的结构性机会", "便宜不再是唯一策略。", "服务型消费和小型品牌在下沉市场同时增长，用户愿意为确定性和体验付钱。", ["价格战开始失效", "信任成为新溢价"]),
      ),
      block(
        "domestic",
        story("2026-09-12", "domestic", "city", "当城市开始重新想象自己", "更新不再只是拆迁。", "多个街区选择保留原有肌理，用公共空间和本地商业带动更新。", ["更新变成经营问题", "居民参与决定成败"]),
      ),
      block(
        "world",
        story("2026-09-12", "world", "energy", "欧洲能源谈判进入细节阶段", "价格稳定之后，真正的问题是分配。", "各国开始讨论补贴退出节奏，工业用电和生活用电被放进同一张表。", ["补贴退出需要时间表", "工业竞争力仍是核心"]),
      ),
      block(
        "culture",
        story("2026-09-12", "culture", "game", "游戏不只是娱乐", "它正在变成一种公共文化语言。", "独立游戏和长视频解说同时增长，玩家讨论的是机制、叙事和社会隐喻，而不只是通关。", ["游戏成为当代神话", "玩家开始要求作者负责"]),
      ),
    ],
    quote: "选择变多的时候，判断力才变得昂贵。",
    cover: {
      kicker: "正日报",
      headline: "选择变多了，<br>判断才变贵。",
      stats: "编排完成 15:40　　领域 06　来源 21",
    },
  }),
  paper({
    date: "2026-09-11",
    displayDate: "09.11",
    weekday: "星期五",
    issueNo: 12,
    hero: {
      kicker: "AI 精选 · 技术现场",
      title: "模型发布只是开始",
      subtitle: "真正被记住的，是它改变了谁的工作方式。",
      asideTitle: "编辑判断",
      asidePoints: ["看发布", "看落地", "看成本", "看争议"],
      storyId: "2026-09-11-tech-kimi",
    },
    top5: [
      { storyId: "2026-09-11-tech-kimi", title: "Kimi 新版本把编程与智能体一起放开", domainId: "tech", heat: "102.0万" },
      { storyId: "2026-09-11-world-labor", title: "全球科技公司重新谈判远程办公", domainId: "world", heat: "69.5万" },
      { storyId: "2026-09-11-finance-ipo", title: "科技企业上市窗口短暂打开", domainId: "finance", heat: "55.3万" },
      { storyId: "2026-09-11-domestic-edu", title: "高校开始把 AI 写作写进学术规范", domainId: "domestic", heat: "48.7万" },
      { storyId: "2026-09-11-culture-museum", title: "博物馆夜场成为新的城市仪式", domainId: "culture", heat: "36.9万" },
    ],
    domains: [
      block(
        "tech",
        story("2026-09-11", "tech", "kimi", "Kimi 新版本把编程与智能体一起放开", "综合性能接近一线模型，上下文被拉到会员可用的长度。", "新版本同时开放编程助手和智能体能力，讨论迅速从跑分转向：它能不能稳定改完一个真实项目。", ["上下文变长改变使用方式", "会员策略决定扩散速度", "工程落地比演示更难"], { heat: "102.0万" }),
      ),
      block(
        "world",
        story("2026-09-11", "world", "labor", "全球科技公司重新谈判远程办公", "办公室回来了，但旧秩序没有回来。", "多家公司要求增加到岗天数，员工则用产出和招聘难度作为谈判筹码。", ["出勤不再等于绩效", "人才市场决定政策弹性"]),
      ),
      block(
        "finance",
        story("2026-09-11", "finance", "ipo", "科技企业上市窗口短暂打开", "投资者要的是利润路径，不是故事。", "本周两家盈利可见的科技公司通过问询，市场对纯叙事公司仍然冷淡。", ["窗口只对利润开放", "叙事溢价明显下降"]),
      ),
      block(
        "domestic",
        story("2026-09-11", "domestic", "edu", "高校开始把 AI 写作写进学术规范", "禁止已经不够，规则必须可执行。", "多所大学公布 AI 辅助写作的披露要求，重点不再是禁，而是说明使用范围。", ["披露比禁止更现实", "评分标准必须重写"]),
      ),
      block(
        "life",
        story("2026-09-11", "life", "commute", "通勤时间重新变成生活议题", "回办公室之后，人们开始计算每天被拿走的两小时。", "租房、托幼和公司班车同时进入讨论，通勤不再被当成理所当然的成本。", ["时间被重新计价", "城市结构决定工作体验"]),
      ),
      block(
        "culture",
        story("2026-09-11", "culture", "museum", "博物馆夜场成为新的城市仪式", "人们在下班后去看一张画，而不是再刷一小时视频。", "夜场票和讲解预约同时售罄，展览开始按都市晚间生活来编排。", ["文化消费回到现场", "展览在争夺晚间注意力"]),
      ),
    ],
    quote: "发布会很短，使用习惯很长。",
    cover: {
      kicker: "正日报",
      headline: "发布只是开始。",
      stats: "编排完成 17:05　　领域 06　来源 19",
    },
  }),
  paper({
    date: "2026-09-10",
    displayDate: "09.10",
    weekday: "星期四",
    issueNo: 11,
    hero: {
      kicker: "AI 精选 · 确定与不确定",
      title: "在不确定的时代，寻找确定的东西",
      subtitle: "人们开始重新要规则、合同和可验证的结果。",
      asideTitle: "今日线索",
      asidePoints: ["合同", "证据", "路径", "余量"],
      storyId: "2026-09-10-finance-risk",
    },
    top5: [
      { storyId: "2026-09-10-finance-risk", title: "企业开始为不确定性单独做预算", domainId: "finance", heat: "73.2万" },
      { storyId: "2026-09-10-tech-eval", title: "模型评测从榜单转向真实任务", domainId: "tech", heat: "68.8万" },
      { storyId: "2026-09-10-domestic-rule", title: "平台规则公开成为新的信任门槛", domainId: "domestic", heat: "52.4万" },
      { storyId: "2026-09-10-world-supply", title: "供应链正在变短，也在变贵", domainId: "world", heat: "47.1万" },
      { storyId: "2026-09-10-life-insurance", title: "年轻人把保险重新读了一遍", domainId: "life", heat: "39.6万" },
    ],
    domains: [
      block(
        "finance",
        story("2026-09-10", "finance", "risk", "企业开始为不确定性单独做预算", "现金比增长故事更有说服力。", "更多公司把汇率、供应链和监管变化写成独立预算项，而不是事后解释。", ["现金流被重新放到第一位", "预案比预测更重要"]),
      ),
      block(
        "tech",
        story("2026-09-10", "tech", "eval", "模型评测从榜单转向真实任务", "会考试，不等于会工作。", "研发团队开始用内部工单、客服对话和代码仓库当评测集，公开榜单的权重下降。", ["真实任务暴露稳定性问题", "评测集成为新的竞争壁垒"]),
      ),
      block(
        "domestic",
        story("2026-09-10", "domestic", "rule", "平台规则公开成为新的信任门槛", "算法不解释，用户就不继续。", "内容平台开始公开推荐和处罚的基本原则，争议从结果转向程序是否公正。", ["程序正义进入产品设计", "透明是最低信任成本"]),
      ),
      block(
        "world",
        story("2026-09-10", "world", "supply", "供应链正在变短，也在变贵", "近岸不是免费的安全。", "企业把部分产能迁回区域市场，交付更稳，成本也明显上升。", ["稳定被重新定价", "全球化没有消失，只是变厚"]),
      ),
      block(
        "life",
        story("2026-09-10", "life", "insurance", "年轻人把保险重新读了一遍", "他们要的是条款，不是焦虑营销。", "保险讨论从「该不该买」变成「哪一条真正赔」，对比表格开始取代口号。", ["条款阅读成为新技能", "销售话术失效"]),
      ),
      block(
        "culture",
        story("2026-09-10", "culture", "archive", "个人档案正在变成一种创作", "人们开始保存自己的阅读痕迹。", "摘录、批注和旧报纸被重新编辑成个人出版物，记忆变成可以翻页的对象。", ["存档即创作", "私人出版变容易了"]),
      ),
    ],
    quote: "不确定的时候，可验证的东西最值钱。",
    cover: {
      kicker: "正日报",
      headline: "先留下<br>可验证的东西。",
      stats: "编排完成 16:10　　领域 06　来源 18",
    },
  }),
  paper({
    date: "2026-09-09",
    displayDate: "09.09",
    weekday: "星期三",
    issueNo: 10,
    hero: {
      kicker: "AI 精选 · 城市与身体",
      title: "城市如何被重新走一遍",
      subtitle: "街道、食堂和夜班，正在决定一座城市好不好住。",
      asideTitle: "现场观察",
      asidePoints: ["步行", "食堂", "夜班", "邻里"],
      storyId: "2026-09-09-domestic-street",
    },
    top5: [
      { storyId: "2026-09-09-domestic-street", title: "步行街改造开始以居民而不是游客为先", domainId: "domestic", heat: "61.0万" },
      { storyId: "2026-09-09-life-canteen", title: "社区食堂重新成为刚需", domainId: "life", heat: "54.3万" },
      { storyId: "2026-09-09-tech-map", title: "地图软件开始标注「可停留」而不只是可达", domainId: "tech", heat: "42.7万" },
      { storyId: "2026-09-09-finance-rent", title: "租金谈判权正在回到租客一侧", domainId: "finance", heat: "40.2万" },
      { storyId: "2026-09-09-culture-night", title: "夜间书店撑起一部分城市生活", domainId: "culture", heat: "33.5万" },
    ],
    domains: [
      block(
        "domestic",
        story("2026-09-09", "domestic", "street", "步行街改造开始以居民而不是游客为先", "好走，比好看更重要。", "新一轮街区更新把座椅、遮阴和菜市场保留进去，游客拍照不再是唯一指标。", ["居民日常决定空间成败", "旅游逻辑开始让位"]),
      ),
      block(
        "life",
        story("2026-09-09", "life", "canteen", "社区食堂重新成为刚需", "一顿稳定的热饭，比生活方式更迫切。", "食堂讨论从老年人福利扩展到上班族和单人家庭，价格透明和菜品稳定成为核心。", ["公共餐饮回到城市基础设施", "稳定比花样更重要"]),
      ),
      block(
        "tech",
        story("2026-09-09", "tech", "map", "地图软件开始标注「可停留」而不只是可达", "到达之后去哪坐，也是导航问题。", "新的图层标出长椅、公厕、遮阴和夜间照明，出行从点到点变成可停留的路径。", ["基础设施被重新可视化", "地图开始理解身体"]),
      ),
      block(
        "finance",
        story("2026-09-09", "finance", "rent", "租金谈判权正在回到租客一侧", "空置比涨价更让房东焦虑。", "部分城市的租赁成交周期拉长，租客开始用对比和议价工具压低涨幅。", ["信息透明改变议价", "租赁进入买方时刻"]),
      ),
      block(
        "world",
        story("2026-09-09", "world", "heat", "高温正在改写城市工作时间", "下午不再适合原来的作息。", "多个城市试点错峰施工和延长晚间开放，气候变成市政时间表。", ["天气进入公共政策", "夜晚被重新使用"]),
      ),
      block(
        "culture",
        story("2026-09-09", "culture", "night", "夜间书店撑起一部分城市生活", "有人在 22 点之后还需要一个安静的公共房间。", "书店把灯留到更晚，阅读会和小型演出填满工作日晚上。", ["书店成为夜间公共空间", "文化消费延长到深夜"]),
      ),
    ],
    quote: "一座城市值不值得住，要看晚上还剩什么。",
    cover: {
      kicker: "正日报",
      headline: "先把路<br>走得更好。",
      stats: "编排完成 15:18　　领域 06　来源 17",
    },
  }),
  paper({
    date: "2026-09-08",
    displayDate: "09.08",
    weekday: "星期二",
    issueNo: 9,
    hero: {
      kicker: "AI 精选 · 学习现场",
      title: "学习重新变成一件很慢的事",
      subtitle: "快进失效之后，人们开始接受重复和难度。",
      asideTitle: "方法笔记",
      asidePoints: ["重复", "难度", "反馈", "间隔"],
      storyId: "2026-09-08-culture-study",
    },
    top5: [
      { storyId: "2026-09-08-culture-study", title: "深度学习重新压过短视频教程", domainId: "culture", heat: "58.6万" },
      { storyId: "2026-09-08-tech-tutor", title: "AI 导师被要求必须会说「你错了」", domainId: "tech", heat: "51.9万" },
      { storyId: "2026-09-08-domestic-exam", title: "考试之后，学生更想知道自己不会什么", domainId: "domestic", heat: "46.0万" },
      { storyId: "2026-09-08-life-focus", title: "专注力成为被重新训练的肌肉", domainId: "life", heat: "41.4万" },
      { storyId: "2026-09-08-finance-edu", title: "教育支出从报班转向工具和陪伴", domainId: "finance", heat: "35.2万" },
    ],
    domains: [
      block(
        "culture",
        story("2026-09-08", "culture", "study", "深度学习重新压过短视频教程", "十分钟学会一切的承诺，开始贬值。", "长文、讲义和反复练习重新回到学习讨论中心，人们承认困难本身是学习的一部分。", ["难度是特征不是缺陷", "短视频只适合入门"]),
      ),
      block(
        "tech",
        story("2026-09-08", "tech", "tutor", "AI 导师被要求必须会说「你错了」", "只表扬的助手，教不出判断。", "教育产品开始加入对抗性提问和错误揭示，用户要的是校正，不是陪读。", ["反馈质量决定学习效果", "温和不等于有用"]),
      ),
      block(
        "domestic",
        story("2026-09-08", "domestic", "exam", "考试之后，学生更想知道自己不会什么", "分数不够，错因分析才够。", "学校和培训开始提供题目级诊断，家长讨论从排名转向缺口。", ["诊断比排名更有用", "教学开始对错因负责"]),
      ),
      block(
        "life",
        story("2026-09-08", "life", "focus", "专注力成为被重新训练的肌肉", "人们开始给自己限时上网，而不是期待更强的意志。", "番茄钟、纸笔和关机时段同时回潮，专注被当成可训练的日常。", ["环境设计先于意志", "注意力需要恢复期"]),
      ),
      block(
        "finance",
        story("2026-09-08", "finance", "edu", "教育支出从报班转向工具和陪伴", "家长开始问：这笔钱买到的是时间还是焦虑。", "一对一答疑、学习诊断和家庭阅读被重新计算进教育预算。", ["陪伴被重新定价", "班次堆叠开始失效"]),
      ),
      block(
        "world",
        story("2026-09-08", "world", "library", "公共图书馆成为全球城市的新竞赛", "谁能让人坐得住，谁就更有吸引力。", "多个城市扩建安静座位和夜间开放，图书馆被写成人才政策的一部分。", ["安静是稀缺公共品", "学习空间进入城市竞争"]),
      ),
    ],
    quote: "学得慢一点，往往才是真的在学。",
    cover: {
      kicker: "正日报",
      headline: "慢，是一种方法。",
      stats: "编排完成 14:52　　领域 06　来源 16",
    },
  }),
];

export const TODAY = "2026-09-13";
