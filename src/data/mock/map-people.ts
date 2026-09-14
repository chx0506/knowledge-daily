export type MapPinKind = "me" | "person";
export type MapGender = "female" | "male" | "none";

export interface MapBlogger {
  name: string;
  note: string;
  avatar: string;
}

export interface MapPerson {
  id: string;
  kind: MapPinKind;
  name: string;
  handle: string;
  role: string;
  city: string;
  country: string;
  note: string;
  bio: string;
  tagline: string;
  serial: string;
  gender: MapGender;
  lat: number;
  lng: number;
  place: string;
  avatar: string;
  stamp: string;
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
    country: "中国",
    note: "城市里的店",
    bio: "把通勤路上还没被算法看见的店收进口袋。",
    tagline: "城市里的有趣灵魂",
    serial: "NO.0312",
    gender: "male",
    lat: 30.6718,
    lng: 104.0547,
    place: "宽窄巷子",
    avatar: "/map/avatars/avatar-ahe.png",
    stamp: "/map/avatars/stamp-ahe.png",
    interests: ["城市漫游", "老招牌", "独立书店", "夜间展览", "摄影", "咖啡"],
    domains: ["设计", "生活", "文化"],
    topics: ["城市更新", "字体与招牌", "成都本地", "独立设计", "夜间散步"],
    bloggers: [
      { name: "街角观察室", note: "城市笔记", avatar: "/map/avatars/blogger-trip.png" },
      { name: "老招牌档案", note: "视觉收藏", avatar: "/map/avatars/avatar-zhaoheng.png" },
      { name: "西南步行者", note: "本地生活", avatar: "/map/avatars/avatar-chenmai.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
    ],
  },
  {
    id: "card-zhaoheng",
    kind: "person",
    name: "赵衡",
    handle: "zhao-heng",
    role: "研究员",
    city: "南京",
    country: "中国",
    note: "科学条件",
    bio: "先把条件写清，再决定相不相信结论。",
    tagline: "实验室外的有趣灵魂",
    serial: "NO.0198",
    gender: "male",
    lat: 32.0448,
    lng: 118.7784,
    place: "新街口",
    avatar: "/map/avatars/avatar-zhaoheng.png",
    stamp: "/map/avatars/stamp-zhaoheng.png",
    interests: ["论文精读", "科学传播", "实验设计", "阅读", "咖啡", "对照阅读"],
    domains: ["科学", "科技", "社会"],
    topics: ["科研伦理", "统计误用", "开放科学", "科普写作", "方法讨论"],
    bloggers: [
      { name: "条件先写清", note: "方法讨论", avatar: "/map/avatars/avatar-beidao.png" },
      { name: "样本之外", note: "科学评论", avatar: "/map/avatars/blogger-ye.png" },
      { name: "减速实验室", note: "对照阅读", avatar: "/map/avatars/avatar-muzi.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
    ],
  },
  {
    id: "card-beidao",
    kind: "person",
    name: "北岛",
    handle: "beidao-berlin",
    role: "留学生",
    city: "柏林",
    country: "德国",
    note: "两种世界观",
    bio: "同一件事，用两种开头写下来。",
    tagline: "两种语言里的有趣灵魂",
    serial: "NO.0441",
    gender: "male",
    lat: 52.5225,
    lng: 13.4026,
    place: "米特区",
    avatar: "/map/avatars/avatar-beidao.png",
    stamp: "/map/avatars/stamp-beidao.png",
    interests: ["对照阅读", "翻译", "现场记录", "阅读", "咖啡", "城市漫游"],
    domains: ["社会", "文化", "科技"],
    topics: ["国际新闻", "媒体素养", "留学日常", "中德对照", "翻译笔记"],
    bloggers: [
      { name: "两种开头", note: "媒体观察", avatar: "/map/avatars/avatar-suqing.png" },
      { name: "柏林夜车", note: "留学生活", avatar: "/map/avatars/blogger-trip.png" },
      { name: "主语会变", note: "翻译笔记", avatar: "/map/avatars/avatar-muzi.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
    ],
  },
  {
    id: "me",
    kind: "me",
    name: "刘看山",
    handle: "kanshan",
    role: "今日派送员",
    city: "在路上",
    country: "世界",
    note: "今日派送中",
    bio: "每天一份，把有趣的人送到你桌上。",
    tagline: "在路上的有趣灵魂",
    serial: "NO.0001",
    gender: "none",
    lat: 30.2487,
    lng: 120.139,
    place: "西湖",
    avatar: "/map/avatars/avatar-kanshan.png",
    stamp: "/map/avatars/stamp-kanshan.png",
    interests: ["摄影", "户外", "咖啡", "阅读", "游戏", "旅行"],
    domains: ["科技", "AI", "文化"],
    topics: ["人工智能应用", "科技产品", "非虚构", "编辑部手记", "今日派送"],
    bloggers: [
      { name: "看山通讯", note: "每日一报", avatar: "/map/avatars/avatar-kanshan.png" },
      { name: "知乎日报馆", note: "公共编辑", avatar: "/map/avatars/avatar-muzi.png" },
      { name: "夜班对稿", note: "文化评论", avatar: "/map/avatars/avatar-suqing.png" },
      { name: "房东的猫", note: "路上遇见", avatar: "/map/avatars/blogger-cat.png" },
    ],
  },
  {
    id: "card-muzi",
    kind: "person",
    name: "木子",
    handle: "muzi-reread",
    role: "编辑",
    city: "北京",
    country: "中国",
    note: "重读",
    bio: "同一条主线，隔天再读一次会更清楚。",
    tagline: "旧刊里的有趣灵魂",
    serial: "NO.0226",
    gender: "female",
    lat: 39.937,
    lng: 116.4545,
    place: "三里屯",
    avatar: "/map/avatars/avatar-muzi.png",
    stamp: "/map/avatars/stamp-muzi.png",
    interests: ["重读", "访谈", "旧刊", "阅读", "咖啡", "慢半拍"],
    domains: ["文化", "影视", "社会"],
    topics: ["非虚构", "书评", "编辑室", "旧回答", "访谈手记"],
    bloggers: [
      { name: "重读俱乐部", note: "书评", avatar: "/map/avatars/avatar-beidao.png" },
      { name: "旧刊管理员", note: "档案", avatar: "/map/avatars/avatar-zhaoheng.png" },
      { name: "慢半拍编辑部", note: "文化", avatar: "/map/avatars/blogger-ye.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
    ],
  },
  {
    id: "card-chenmai",
    kind: "person",
    name: "陈麦",
    handle: "chenmai-ride",
    role: "骑行爱好者",
    city: "深圳",
    country: "中国",
    note: "身体谈判",
    bio: "二十分钟的清醒，比闹钟更早到。",
    tagline: "车把上的有趣灵魂",
    serial: "NO.0357",
    gender: "male",
    lat: 22.5242,
    lng: 113.9478,
    place: "深圳湾",
    avatar: "/map/avatars/avatar-chenmai.png",
    stamp: "/map/avatars/stamp-chenmai.png",
    interests: ["骑行", "睡眠", "通勤", "户外", "咖啡", "摄影"],
    domains: ["生活", "科学", "旅行"],
    topics: ["运动科学", "城市骑行", "作息", "身体与日程", "晨间路线"],
    bloggers: [
      { name: "二十分钟清醒", note: "骑行", avatar: "/map/avatars/avatar-ahe.png" },
      { name: "晚睡交通学", note: "生活", avatar: "/map/avatars/blogger-trip.png" },
      { name: "身体日程表", note: "健康", avatar: "/map/avatars/blogger-ye.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
    ],
  },
  {
    id: "card-suqing",
    kind: "person",
    name: "苏青",
    handle: "suqing-ledger",
    role: "财经记者",
    city: "上海",
    country: "中国",
    note: "真实账本",
    bio: "把大数字写成谁在承担风险。",
    tagline: "账本里的有趣灵魂",
    serial: "NO.0147",
    gender: "female",
    lat: 31.2404,
    lng: 121.4905,
    place: "外滩",
    avatar: "/map/avatars/avatar-suqing.png",
    stamp: "/map/avatars/stamp-suqing.png",
    interests: ["财报", "政策对照", "家庭账本", "阅读", "咖啡", "城市漫游"],
    domains: ["财经", "商业", "社会"],
    topics: ["宏观经济", "公司研究", "个人理财", "利率与风险", "家庭账户"],
    bloggers: [
      { name: "真实账本", note: "财经", avatar: "/map/avatars/avatar-zhaoheng.png" },
      { name: "被写小的", note: "公司研究", avatar: "/map/avatars/blogger-trip.png" },
      { name: "家庭账户", note: "理财", avatar: "/map/avatars/blogger-cat.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
    ],
  },
  {
    id: "card-guyan",
    kind: "person",
    name: "顾言",
    handle: "guyan-play",
    role: "游戏策划",
    city: "广州",
    country: "中国",
    note: "游戏公共讨论",
    bio: "规则为什么吵，往往比胜负更值得看。",
    tagline: "副本里的有趣灵魂",
    serial: "NO.0287",
    gender: "female",
    lat: 23.1373,
    lng: 113.327,
    place: "天河路",
    avatar: "/map/avatars/avatar-guyan.png",
    stamp: "/map/avatars/stamp-guyan.png",
    interests: ["版本笔记", "规则设计", "玩家争论", "游戏", "阅读", "咖啡"],
    domains: ["游戏", "文化", "设计"],
    topics: ["独立游戏", "游戏叙事", "系统策划", "玩家社区", "规则争论"],
    bloggers: [
      { name: "规则为什么吵", note: "游戏评论", avatar: "/map/avatars/avatar-ahe.png" },
      { name: "副本分工", note: "系统设计", avatar: "/map/avatars/blogger-ye.png" },
      { name: "公共讨论室", note: "玩家文化", avatar: "/map/avatars/avatar-chenmai.png" },
      { name: "刘看山", note: "今日派送", avatar: "/map/avatars/avatar-kanshan.png" },
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

export interface MapNetwork {
  id: string;
  label: string;
  personIds: string[];
  edges: Array<[string, string]>;
}

export const MAP_NETWORKS: MapNetwork[] = [
  {
    id: "photo",
    label: "摄影",
    personIds: ["me", "card-ahe", "card-chenmai", "card-muzi"],
    edges: [
      ["me", "card-ahe"],
      ["card-ahe", "card-chenmai"],
      ["card-chenmai", "card-muzi"],
      ["me", "card-muzi"],
    ],
  },
  {
    id: "outdoor",
    label: "户外",
    personIds: ["me", "card-chenmai", "card-guyan", "card-beidao"],
    edges: [
      ["me", "card-chenmai"],
      ["card-chenmai", "card-guyan"],
      ["card-guyan", "card-beidao"],
      ["me", "card-beidao"],
    ],
  },
  {
    id: "coffee",
    label: "咖啡",
    personIds: ["me", "card-ahe", "card-suqing", "card-muzi", "card-guyan"],
    edges: [
      ["me", "card-suqing"],
      ["card-suqing", "card-ahe"],
      ["card-ahe", "card-muzi"],
      ["card-muzi", "card-guyan"],
      ["me", "card-ahe"],
    ],
  },
  {
    id: "reading",
    label: "阅读",
    personIds: ["me", "card-zhaoheng", "card-muzi", "card-beidao", "card-suqing"],
    edges: [
      ["me", "card-zhaoheng"],
      ["card-zhaoheng", "card-muzi"],
      ["card-muzi", "card-beidao"],
      ["card-beidao", "card-suqing"],
      ["card-suqing", "me"],
    ],
  },
  {
    id: "game",
    label: "游戏",
    personIds: ["me", "card-guyan", "card-beidao", "card-chenmai"],
    edges: [
      ["me", "card-guyan"],
      ["card-guyan", "card-beidao"],
      ["card-beidao", "card-chenmai"],
    ],
  },
];

export function findMapNetwork(id: string): MapNetwork {
  return MAP_NETWORKS.find((network) => network.id === id) ?? MAP_NETWORKS[0];
}

export function peopleInNetwork(network: MapNetwork): MapPerson[] {
  return network.personIds
    .map((id) => findMapPerson(id))
    .filter((person): person is MapPerson => Boolean(person));
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceKm(from: MapPerson, to: MapPerson): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a))));
}

export function greatCircle(from: MapPerson, to: MapPerson, steps = 40): Array<[number, number]> {
  const φ1 = toRad(from.lat);
  const λ1 = toRad(from.lng);
  const φ2 = toRad(to.lat);
  const λ2 = toRad(to.lng);
  const Δ = 2 * Math.asin(
    Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2),
  );
  if (!Number.isFinite(Δ) || Δ < 1e-6) return [[from.lng, from.lat], [to.lng, to.lat]];
  const coords: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * Δ) / Math.sin(Δ);
    const B = Math.sin(f * Δ) / Math.sin(Δ);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    coords.push([(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI]);
  }
  return coords;
}

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
