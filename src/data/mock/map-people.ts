export type MapPinKind = "me" | "person";

export interface MapBlogger {
  name: string;
  note: string;
}

export interface MapPerson {
  id: string;
  kind: MapPinKind;
  name: string;
  handle: string;
  role: string;
  city: string;
  note: string;
  x: number;
  y: number;
  avatar: string;
  interests: string[];
  domains: string[];
  topics: string[];
  bloggers: MapBlogger[];
}

export const MAP_PEOPLE: MapPerson[] = [
  {
    id: "card-ahe",
    kind: "person",
    name: "阿禾",
    handle: "ahe-chengdu",
    role: "独立设计",
    city: "成都",
    note: "城市里的店",
    x: 16,
    y: 22,
    avatar: "/map/avatars/avatar-ahe.png",
    interests: ["城市漫游", "老招牌", "独立书店", "夜间展览"],
    domains: ["设计", "生活", "文化"],
    topics: ["城市更新", "字体与招牌", "成都本地", "独立设计"],
    bloggers: [
      { name: "街角观察室", note: "城市笔记" },
      { name: "老招牌档案", note: "视觉收藏" },
      { name: "西南步行者", note: "本地生活" },
    ],
  },
  {
    id: "card-zhaoheng",
    kind: "person",
    name: "赵衡",
    handle: "zhao-heng",
    role: "研究员",
    city: "南京",
    note: "科学条件",
    x: 48,
    y: 18,
    avatar: "/map/avatars/avatar-zhaoheng.png",
    interests: ["论文精读", "科学传播", "实验设计"],
    domains: ["科学", "科技", "社会"],
    topics: ["科研伦理", "统计误用", "开放科学", "科普写作"],
    bloggers: [
      { name: "条件先写清", note: "方法讨论" },
      { name: "样本之外", note: "科学评论" },
      { name: "减速实验室", note: "对照阅读" },
    ],
  },
  {
    id: "card-beidao",
    kind: "person",
    name: "北岛",
    handle: "beidao-berlin",
    role: "留学生",
    city: "柏林",
    note: "两种世界观",
    x: 24,
    y: 38,
    avatar: "/map/avatars/avatar-beidao.png",
    interests: ["对照阅读", "翻译", "现场记录"],
    domains: ["社会", "文化", "科技"],
    topics: ["国际新闻", "媒体素养", "留学日常", "中德对照"],
    bloggers: [
      { name: "两种开头", note: "媒体观察" },
      { name: "柏林夜车", note: "留学生活" },
      { name: "主语会变", note: "翻译笔记" },
    ],
  },
  {
    id: "me",
    kind: "me",
    name: "刘看山",
    handle: "kanshan",
    role: "今日派送员",
    city: "在路上",
    note: "今日派送中",
    x: 72,
    y: 22,
    avatar: "/map/avatars/avatar-kanshan.png",
    interests: ["摄影", "户外", "咖啡", "阅读", "游戏"],
    domains: ["科技", "AI", "文化"],
    topics: ["人工智能应用", "科技产品", "非虚构", "编辑部手记"],
    bloggers: [
      { name: "看山通讯", note: "每日一报" },
      { name: "知乎日报馆", note: "公共编辑" },
      { name: "夜班对稿", note: "文化评论" },
    ],
  },
  {
    id: "card-muzi",
    kind: "person",
    name: "木子",
    handle: "muzi-reread",
    role: "编辑",
    city: "北京",
    note: "重读",
    x: 86,
    y: 30,
    avatar: "/map/avatars/avatar-muzi.png",
    interests: ["重读", "访谈", "旧刊", "慢半拍"],
    domains: ["文化", "影视", "社会"],
    topics: ["非虚构", "书评", "编辑室", "旧回答"],
    bloggers: [
      { name: "重读俱乐部", note: "书评" },
      { name: "旧刊管理员", note: "档案" },
      { name: "慢半拍编辑部", note: "文化" },
    ],
  },
  {
    id: "card-chenmai",
    kind: "person",
    name: "陈麦",
    handle: "chenmai-ride",
    role: "骑行爱好者",
    city: "深圳",
    note: "身体谈判",
    x: 22,
    y: 70,
    avatar: "/map/avatars/avatar-chenmai.png",
    interests: ["骑行", "睡眠", "通勤", "户外"],
    domains: ["生活", "科学", "旅行"],
    topics: ["运动科学", "城市骑行", "作息", "身体与日程"],
    bloggers: [
      { name: "二十分钟清醒", note: "骑行" },
      { name: "晚睡交通学", note: "生活" },
      { name: "身体日程表", note: "健康" },
    ],
  },
  {
    id: "card-suqing",
    kind: "person",
    name: "苏青",
    handle: "suqing-ledger",
    role: "财经记者",
    city: "上海",
    note: "真实账本",
    x: 50,
    y: 56,
    avatar: "/map/avatars/avatar-suqing.png",
    interests: ["财报", "政策对照", "家庭账本"],
    domains: ["财经", "商业", "社会"],
    topics: ["宏观经济", "公司研究", "个人理财", "利率与风险"],
    bloggers: [
      { name: "真实资产负债表", note: "财经" },
      { name: "被写小的一行", note: "公司研究" },
      { name: "家庭账户", note: "理财" },
    ],
  },
  {
    id: "card-guyan",
    kind: "person",
    name: "顾言",
    handle: "guyan-play",
    role: "游戏策划",
    city: "广州",
    note: "游戏公共讨论",
    x: 86,
    y: 76,
    avatar: "/map/avatars/avatar-guyan.png",
    interests: ["版本笔记", "规则设计", "玩家争论"],
    domains: ["游戏", "文化", "设计"],
    topics: ["独立游戏", "游戏叙事", "系统策划", "玩家社区"],
    bloggers: [
      { name: "规则为什么吵", note: "游戏评论" },
      { name: "副本分工", note: "系统设计" },
      { name: "公共讨论室", note: "玩家文化" },
    ],
  },
];

const TOPIC_FOLLOWS: Record<string, string[]> = {
  科技: ["科技产品", "互联网"],
  商业: ["公司研究", "商业模式"],
  AI: ["大模型", "人工智能应用"],
  游戏: ["独立游戏", "游戏叙事"],
  文化: ["非虚构", "文化评论"],
  影视: ["影像笔记", "剧评"],
  社会: ["公共讨论", "媒体素养"],
  设计: ["字体与招牌", "独立设计"],
  生活: ["城市漫游", "本地生活"],
  财经: ["宏观经济", "个人理财"],
  科学: ["科学传播", "开放科学"],
  旅行: ["城市骑行", "在地观察"],
};

export function findMapPerson(id: string): MapPerson | undefined {
  return MAP_PEOPLE.find((person) => person.id === id);
}

export function portraitForMe(selectedTopics: string[]): MapPerson {
  const me = MAP_PEOPLE.find((person) => person.kind === "me")!;
  const topics = selectedTopics.flatMap((topic) => TOPIC_FOLLOWS[topic] ?? [topic]);
  return {
    ...me,
    domains: (selectedTopics.length ? selectedTopics : me.domains).slice(0, 6),
    topics: topics.length ? [...new Set(topics)].slice(0, 6) : me.topics,
  };
}
