import type { RemoteDaily } from "../types";

/** 真实后端 /api/daily 采样（2026-09-13，2 领域 + 4 skipped），离线降级用。 */
export const DAILY_FIXTURE: RemoteDaily = {
  "schema_version": "4.0",
  "daily_id": "d_20260913_self",
  "date": "2026-09-13",
  "generated_at": 1789307811,
  "user_ref": "self",
  "data_source": {
    "platform": "zhihu",
    "auth_mode": "access_secret_owner",
    "curation": "zhida"
  },
  "profile": {
    "user_ref": "self",
    "generated_at": 1789307786,
    "window_days": 60,
    "summary": "兴趣集中在 AI Agent、我的收藏、科技 等方向。",
    "confidence": "high",
    "confidence_reason": "用户已选择学习方向，并有 21 条知乎行为信号佐证。",
    "cold_start": false,
    "tags": [
      {
        "name": "AI Agent",
        "weight": 0.95,
        "source": "user_direction",
        "confidence_tier": "high",
        "contributing_signals": [
          "user_direction"
        ],
        "evidence": [
          {
            "type": "user_direction",
            "label": "AI Agent",
            "url": ""
          },
          {
            "type": "recommended_question",
            "label": "今年怎么这么多人想转行做AI Agent工程师，真有那么好干吗？",
            "url": "https://www.zhihu.com/question/2043476080036729691"
          }
        ]
      },
      {
        "name": "我的收藏",
        "weight": 0.83,
        "source": "favorite_list",
        "confidence_tier": "high",
        "contributing_signals": [
          "favorite_list"
        ],
        "evidence": [
          {
            "type": "favorite_list",
            "label": "我的收藏",
            "url": "https://www.zhihu.com/collection/1006137545"
          },
          {
            "type": "favorite_list",
            "label": "我的收藏",
            "url": "https://www.zhihu.com/collection/1006137542"
          },
          {
            "type": "recommended_question",
            "label": "大白兔糖纸火了，让我想起小时候「穷收藏」的快乐，现在的孩子还有吗？",
            "url": "https://www.zhihu.com/question/2068746729915151700"
          }
        ]
      },
      {
        "name": "科技",
        "weight": 0.53,
        "source": "feedback_positive",
        "confidence_tier": "medium",
        "contributing_signals": [
          "feedback_positive"
        ],
        "evidence": [
          {
            "type": "feedback",
            "label": "正向反馈 科技",
            "url": ""
          },
          {
            "type": "recommended_question",
            "label": "全世界都在ALL in AI ，AI真的是第四次工业革命吗？人类的科技树是否点错",
            "url": "https://www.zhihu.com/question/2052464126996353859"
          }
        ]
      },
      {
        "name": "平心而论",
        "weight": 0.49,
        "source": "favorite_item",
        "confidence_tier": "high",
        "contributing_signals": [
          "favorite_item"
        ],
        "evidence": [
          {
            "type": "favorite_item",
            "label": "平心而论红楼梦是不是被严重高估了？",
            "url": "https://www.zhihu.com/answer/1912591291528778473"
          },
          {
            "type": "recommended_question",
            "label": "平心而论，清朝统治者比前朝更务实吗？",
            "url": "https://www.zhihu.com/question/1965156590748413982"
          }
        ]
      }
    ],
    "user_preferences": {
      "directions": [
        "AI Agent"
      ],
      "keywords": [],
      "goal": "",
      "blocked": []
    },
    "platform_recommendation": {
      "source": "question recommend (no query)",
      "note": "官方基于账号画像返回的原始结果，未经本应用加工；样本稀疏时可能偏离真实兴趣。",
      "items": [
        {
          "title": "有没有女主特别清醒理智的文？",
          "url": "https://www.zhihu.com/question/1991462367293355334"
        },
        {
          "title": "有没有超级好看的小说推荐？",
          "url": "https://www.zhihu.com/question/1921313783382545745"
        },
        {
          "title": "有没有感情超细腻的言情小说?",
          "url": "https://www.zhihu.com/question/6611638404"
        },
        {
          "title": "有没有那种清醒又果断的爽文大女主?",
          "url": "https://www.zhihu.com/question/1988024921025168911"
        },
        {
          "title": "有没有那种女主人间清醒，且敢作敢当绝不委屈自己的文?",
          "url": "https://www.zhihu.com/question/578673095"
        }
      ]
    },
    "signal_coverage": {
      "followees": 9,
      "favorite_lists": 2,
      "favorite_items": 10,
      "own_contents": 0,
      "user_directions": 1,
      "feedback_records": 1
    },
    "unavailable_signals": [
      "browse_history",
      "search_history",
      "vote_history",
      "followed_topics"
    ]
  },
  "mainline": {
    "judgement": "AI Agent 已从对话工具走向能自主干活的成品，办公与编码赛道进入比拼交付质量与性价比的阶段。",
    "first_read": {
      "domain_id": "tech",
      "name": "科技",
      "reason": "依据最强（信号分 5），置信度最高"
    },
    "basis_text": "今日从个人内容 0 篇、知乎搜索 20 篇、问题回答 5 篇中，综合 25 篇生成。热榜仅用于发现议题。",
    "total_synthesized": 25
  },
  "domains": [
    {
      "domain_id": "tech",
      "name": "科技",
      "tier": "deep",
      "basis": {
        "text": "根据学习方向「AI Agent」、画像标签「AI Agent」，判断你在「科技」领域有持续信号。今日综合知乎 15 篇（搜索 10、个人内容 0、问题回答 5）。",
        "signals": {
          "followees": 0,
          "favorite_lists": 0,
          "favorite_items": 0,
          "own_contents": 0,
          "directions": 1
        },
        "synthesized_count": 15,
        "breakdown": {
          "search": 10,
          "personal": 0,
          "question_answers": 5
        },
        "hot_discovery_only": false
      },
      "judgement": "AI Agent 已从对话工具走向能自主干活的成品，办公与编码赛道进入比拼交付质量与性价比的阶段。",
      "report": "现在市面上的 AI Agent 有一条清晰的主线：从「你问一句它答一句」的聊天工具，升级为「你给一个需求，它自己拆任务、写代码、调用工具、改 bug」的干活式智能体。到 2026 年，这类产品已经不是概念，而是集中爆发的成品：编码侧有 Claude Code、Codex、Cursor、Trae、OpenCode 等，办公与通用侧有 WorkBuddy、OpenClaw、Manus、Gemini CLI 等一大串名字。市场增长的数字很猛，活跃 Agent 数量一年翻数倍，但你实际能感受到的变化是：产品多了、免费或低价档位多了，同时各家开始收紧无限包月，改成按量计费，「闭着眼睛用」变成了「算着额度用」。 在使用经验上，社区里大致有几派。一派是「主力模型派」：认为工具外壳不重要，关键是背后的模型，Codex、Claude 这类闭源强模型承担关键判断，DeepSeek 这类便宜模型做重复执行，最省钱的是直接用 DeepSeek API，月开销估计在一两百元内。一派是「高低搭配派」：比如 WorkBuddy（免费或低价、办公功能全、省心）+ Codex 覆盖办公加少量开发，每月一百多元搞定大部分需求；也有人用不到 200 元的 Gemini + Claude 组合做汇报逐字稿和 PPT，认为省下的加班时间远超成本。还有一派是「开源自托管派」：用 OpenClaw 这类开源智能体装在独立电脑上常驻运行，看重数据本地化和插件自由，代价是需要工程能力、版本稳定性一般。分歧点也很真实：公司配的 Claude 因信息安全限制用得不畅快，自费工具的核心诉求变成性价比和时间节省，而不是单纯追最强。 对你来说，这件事的意义有三层。第一，如果你只是想把日常工作（文档、表格、SQL、汇报）交给 AI，现在已经不必纠结「选哪个最强」，而是按场景挑：办公选 WorkBuddy 类成品，写代码选 Claude",
      "recommended": [
        {
          "source_id": "src_a1e1ecf45830",
          "title": "AI-Agent哪个好用?国内外各大Agent对比:Claude Code、Codex、Work Buddy、OpenCode等等 - 知乎",
          "author": "黑虾",
          "source_type": "搜索",
          "why_now": "横评国内外主流 Agent，快速建立产品全景认知。",
          "url": "https://zhuanlan.zhihu.com/p/2068016741008121952?utm_medium=openapi_platform&utm_source=cf621feb3f2d"
        },
        {
          "source_id": "src_9c5b89ce4b07",
          "title": "公司不报销 AI 工具费用，普通打工人自费用哪款 Agent 产品性价比最高？更能提升工作效率？",
          "author": "",
          "source_type": "搜索",
          "why_now": "真实自费视角算性价比，最贴近个人选型决策。",
          "url": "https://www.zhihu.com/question/2078145173297566799/answer/2078840238257058100"
        },
        {
          "source_id": "src_0066801ba9be",
          "title": "用什么ai agent好,怎么选,从价格实用角度来看? - 知乎",
          "author": "数据与AI爱好者",
          "source_type": "搜索",
          "why_now": "讲清免费额度与 Token 成本结构，避坑必读。",
          "url": "https://www.zhihu.com/question/2069722292402361191/answer/2078949753157699097?utm_medium=openapi_platform&utm_source=cf621feb3f2d"
        }
      ],
      "source_index": [
        {
          "source_id": "src_f6c6d7e20581",
          "title": "深入浅出完整解析AI Agent(AI智能体)的核心基础知识 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/1919046969076195976?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_a1e1ecf45830",
          "title": "AI-Agent哪个好用?国内外各大Agent对比:Claude Code、Codex、Work Buddy、OpenCode等等 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2068016741008121952?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": true
        },
        {
          "source_id": "src_9c5b89ce4b07",
          "title": "公司不报销 AI 工具费用，普通打工人自费用哪款 Agent 产品性价比最高？更能提升工作效率？",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2078145173297566799/answer/2078840238257058100",
          "cited": true
        },
        {
          "source_id": "src_c3f1399b2519",
          "title": "公司不报销 AI 工具费用，普通打工人自费用哪款 Agent 产品性价比最高？更能提升工作效率？",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2078145173297566799/answer/2078514060841302004",
          "cited": false
        },
        {
          "source_id": "src_129b9ea81cff",
          "title": "公司不报销 AI 工具费用，普通打工人自费用哪款 Agent 产品性价比最高？更能提升工作效率？",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2078145173297566799/answer/2078604939849482976",
          "cited": false
        },
        {
          "source_id": "src_71054e000048",
          "title": "公司不报销 AI 工具费用，普通打工人自费用哪款 Agent 产品性价比最高？更能提升工作效率？",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2078145173297566799/answer/2078500178470893308",
          "cited": false
        },
        {
          "source_id": "src_7d61fb843a1d",
          "title": "公司不报销 AI 工具费用，普通打工人自费用哪款 Agent 产品性价比最高？更能提升工作效率？",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2078145173297566799/answer/2080075401162919937",
          "cited": false
        },
        {
          "source_id": "src_0066801ba9be",
          "title": "用什么ai agent好,怎么选,从价格实用角度来看? - 知乎",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2069722292402361191/answer/2078949753157699097?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": true
        },
        {
          "source_id": "src_1b8ad7a2aead",
          "title": "国内这么多 AI Agent 产品,真正的差异化到底在哪? - 知乎",
          "source_type": "搜索",
          "url": "https://www.zhihu.com/question/2078146269835539602/answer/2078994280102752695?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_251450f601ff",
          "title": "字节 AI 产品向豆包集结,Agent 时代第一场巨头战役打响 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2075603562403476943?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_f94e7765d644",
          "title": "我用AI Agent重构了研发全流程:5款自研工具介绍 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2076689562827543146?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_c4a32b4d9f9f",
          "title": "15999元!绿联发布旗舰AI NAS,AI Agent等来「新家」 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2082495704098923871?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_4aef3621a270",
          "title": "OpenDroid:开源Android自主 AI Agent,让手机真正替你干活 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2073682095482979569?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_8d5d7316fd12",
          "title": "推荐6个牛逼的AI Agent项目 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2076980956469240484?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_e75bbaf4d67c",
          "title": "10 个适合企业使用的开源 AI Agent 平台:从自动化到内部应用 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2079690740024846183?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        }
      ],
      "generated_by": "zhida"
    },
    {
      "domain_id": "finance",
      "name": "财经",
      "tier": "blind",
      "basis": {
        "text": "你没有明显的「财经」个人信号，本版为补盲内容，篇幅从短。今日综合知乎 10 篇（搜索 10、个人内容 0、问题回答 0）。",
        "signals": {
          "followees": 0,
          "favorite_lists": 0,
          "favorite_items": 0,
          "own_contents": 0,
          "directions": 0
        },
        "synthesized_count": 10,
        "breakdown": {
          "search": 10,
          "personal": 0,
          "question_answers": 0
        },
        "hot_discovery_only": false
      },
      "judgement": "AI Agent从暴富神话走向成本核算时代，能否赚钱取决于把token账算清楚",
      "report": "市面上，AI Agent 赚钱叙事正在分化。一派讲神话：OpenClaw 相关的'2万变4000万'、Polymarket 月入数万美元的故事广泛流传，但亲历者普遍提醒这是极端案例，小仓位、设止损、把 API 调用费计入成本才是常态玩法。另一派开始认真算账：有人用五个 AI 员工跑 12 个行业板块的新闻监控，月成本不到 130 元；也有研究称 Agent 电脑操作的全成本约每小时 6 至 8 美元，已低于离岸外包且准确率更高。 经验上大致有三条路：一是个人建投资 agent，用搜索接口盯盘、本地库存历史交易做复盘；二是成本侧套利，德银指出前沿模型与开源模型单任务成本差约 65 倍，而 90% 的普通任务表现接近，选对模型本身就是利润；三是把 agent 流程标准化后卖给企业，或像 Agent 之间互相付费那样形成服务生态。共同点是：收入减去 token 成本、工具调用和重试开销，才是可解释的钱。 对你而言，关键是把'AI 替你赚钱'翻译成一张收支表：先估每个被接管的环节替代了多少人工分钟、乘以时薪得到单次收益，再扣掉单次运行成本，乘以调用量。收益算得出、成本可归因，这笔钱才站得住；算不清的，大概率是故事而不是现金流。",
      "recommended": [
        {
          "source_id": "src_ffc4b99f7d3b",
          "title": "AI Agent 的经济账:算力、模型路由与真实 ROI 拆解 - 知乎",
          "author": "LeavesLeo",
          "source_type": "搜索",
          "why_now": "给出单次收益减单次成本的完整ROI公式，是'可解释的钱'的核心方法论",
          "url": "https://zhuanlan.zhihu.com/p/2077343263321859686?utm_medium=openapi_platform&utm_source=cf621feb3f2d"
        },
        {
          "source_id": "src_3d88db8dd115",
          "title": "养虾实战教程:我用OpenClaw做了个能盯盘,也能深度复盘的投资agent - 知乎",
          "author": "Zilliz",
          "source_type": "搜索",
          "why_now": "个人搭投资agent的实战教程，成本项与工具选型写得具体，可复现",
          "url": "https://zhuanlan.zhihu.com/p/2016831013943279999?utm_medium=openapi_platform&utm_source=cf621feb3f2d"
        }
      ],
      "source_index": [
        {
          "source_id": "src_5e64c6ef5c94",
          "title": "OpenClaw 一夜暴富神话:2万变4000万,AI替你赚钱的时代真的来了? - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2011751943010264197?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_4dcfb5a514df",
          "title": "德银炸场:中美AI成本高达65倍,90%场景用贵了 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2052368590763042740?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_3d88db8dd115",
          "title": "养虾实战教程:我用OpenClaw做了个能盯盘,也能深度复盘的投资agent - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2016831013943279999?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": true
        },
        {
          "source_id": "src_7f0e4094d881",
          "title": "港大开源,22K+⭐ 个人 AI 量化 Agent - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2060512854873215711?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_ffc4b99f7d3b",
          "title": "AI Agent 的经济账:算力、模型路由与真实 ROI 拆解 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2077343263321859686?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": true
        },
        {
          "source_id": "src_a9ec9c13b4b9",
          "title": "Agent 成本跌破外包:护城河换了,谁先慌 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2072948435163017881?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_6d091bb969fa",
          "title": "五个 AI 员工,一个月成本不到 130 元——来自 AI 财务总监的两万字成本核算报告 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2061558417219703556?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_29be43eae664",
          "title": "Agent经济学拐点:AI Agent电脑操作小时成本已低于离岸人力外包,准确率也更高 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2070482683227025525?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_7e197bdc3e5d",
          "title": "AI 智能体 ROI 深度拆解:真实成本与回报周期 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2047326985081426598?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        },
        {
          "source_id": "src_82fe6814d4bf",
          "title": "AI Agent成本骤降60%:谷歌Gemini 3.8 Flash重新定义性价比拐点 - 知乎",
          "source_type": "搜索",
          "url": "https://zhuanlan.zhihu.com/p/2080367036895589533?utm_medium=openapi_platform&utm_source=cf621feb3f2d",
          "cited": false
        }
      ],
      "generated_by": "zhida"
    }
  ],
  "skipped_domains": [
    {
      "domain_id": "china",
      "name": "国内",
      "reason": "无信号依据，今日未生成"
    },
    {
      "domain_id": "life",
      "name": "生活",
      "reason": "无信号依据，今日未生成"
    },
    {
      "domain_id": "culture",
      "name": "文化",
      "reason": "无信号依据，今日未生成"
    },
    {
      "domain_id": "world",
      "name": "国际",
      "reason": "今日热榜议题与你的画像无交集，未生成"
    }
  ],
  "stale": false,
  "warnings": [],
  "cached": false
};
