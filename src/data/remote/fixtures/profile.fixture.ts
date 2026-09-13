import type { RemoteProfile } from "../types";

/** 真实后端 /api/profile 采样（2026-09-13，高置信画像），离线降级用。 */
export const PROFILE_FIXTURE: RemoteProfile = {
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
  ],
  "warnings": [],
  "cached": false,
  "cold_start_options": [
    "AI 产品设计",
    "独立开发者 App 变现",
    "信息过载 阅读方式",
    "交互设计",
    "科技行业观察",
    "学习方法"
  ]
};
