import type { DailyPaper, DomainBlock, DomainId, DomainMeta, DomainStory } from "./types";

export const DOMAIN_CATALOG: DomainMeta[] = [
  { id: "recommend", name: "推荐", nameEn: "PICKS", no: "00", kicker: "推荐", image: "", views: "", variant: "card" },
  {
    id: "tech",
    name: "科技",
    nameEn: "PRODUCT BRIEF",
    no: "01",
    kicker: "今日头版",
    image: "/domains/domain-cover.jpg",
    views: "12.6万",
    variant: "cover",
    sideLines: ["更快", "更小", "更自主?"],
  },
  {
    id: "finance",
    name: "财经",
    nameEn: "BUDGET",
    no: "02",
    kicker: "特别报道",
    image: "/domains/domain-special.jpg",
    views: "8.4万",
    variant: "special",
  },
  {
    id: "domestic",
    name: "国内",
    nameEn: "CITY",
    no: "03",
    kicker: "城市观察",
    image: "/domains/domain-city.jpg",
    views: "5.2万",
    variant: "card",
  },
  {
    id: "world",
    name: "国际",
    nameEn: "WORLD",
    no: "04",
    kicker: "国际现场",
    image: "/domains/domain-world.jpg",
    views: "7.1万",
    variant: "card",
  },
  {
    id: "culture",
    name: "文化",
    nameEn: "CULTURE",
    no: "05",
    kicker: "文化回望",
    image: "/domains/domain-books.jpg",
    views: "3.9万",
    variant: "card",
  },
  {
    id: "life",
    name: "生活",
    nameEn: "LIFE",
    no: "06",
    kicker: "生活切片",
    image: "/domains/domain-life.jpg",
    views: "4.6万",
    variant: "card",
  },
  {
    id: "gaming",
    name: "游戏",
    nameEn: "GAMING",
    no: "07",
    kicker: "游戏前线",
    image: "",
    views: "",
    variant: "card",
  },
  {
    id: "design",
    name: "设计",
    nameEn: "DESIGN",
    no: "08",
    kicker: "设计现场",
    image: "",
    views: "",
    variant: "card",
  },
  {
    id: "science",
    name: "科学",
    nameEn: "SCIENCE",
    no: "09",
    kicker: "科学来信",
    image: "",
    views: "",
    variant: "card",
  },
  {
    id: "travel",
    name: "旅行",
    nameEn: "TRAVEL",
    no: "10",
    kicker: "旅行拾遗",
    image: "",
    views: "",
    variant: "card",
  },
];

/**
 * 首页 Tab 动态化（后端动态领域 + 补盲开关）：
 * 1. 「推荐」固定第一；
 * 2. 当天实际生成的领域按响应顺序排，信号领域（deep/standard）在前，
 *    补盲领域（tier=blind）在后、Tab 带「拓展」标记；
 * 3. skipped_domains 排尾部，灰显并展示原因。
 */
export function homeTabs(paper: DailyPaper): DomainId[] {
  const signal = paper.domains.filter((block) => block.lead.tier !== "blind").map((block) => block.domainId);
  const blind = paper.domains.filter((block) => block.lead.tier === "blind").map((block) => block.domainId);
  const skipped = (paper.skipped ?? []).map((item) => item.id);
  return ["recommend", ...signal, ...blind, ...skipped];
}

/** 后端未来新增领域的兜底版式：通用 card + 以原 id 为名，保证渲染不炸。 */
function genericMeta(id: DomainId): DomainMeta {
  return { id, name: id, nameEn: "SECTION", no: "··", kicker: "专题", image: "", views: "", variant: "card" };
}

export const BOARD_ORDER: DomainId[] = [
  "tech",
  "finance",
  "domestic",
  "world",
  "culture",
  "life",
  "gaming",
  "design",
  "science",
  "travel",
];

export function domainMeta(id: DomainId): DomainMeta {
  return DOMAIN_CATALOG.find((item) => item.id === id) ?? genericMeta(id);
}

export function allStories(paper: DailyPaper): DomainStory[] {
  return paper.domains.flatMap((block) => [block.lead, ...block.items]);
}

export function findStory(
  papers: DailyPaper[],
  storyId: string,
): { paper: DailyPaper; story: DomainStory } | null {
  for (const paper of papers) {
    const story = allStories(paper).find((item) => item.id === storyId);
    if (story) return { paper, story };
  }
  return null;
}

export function findDomainBlock(paper: DailyPaper, domainId: DomainId) {
  return paper.domains.find((block) => block.domainId === domainId) ?? paper.domains[0];
}

export function orderedBlocks(paper: DailyPaper): DomainBlock[] {
  const ordered = BOARD_ORDER.map((id) => paper.domains.find((block) => block.domainId === id)).filter(
    (block): block is DomainBlock => Boolean(block),
  );
  // 目录外（后端未来新增）的领域排在最后，不丢版。
  const rest = paper.domains.filter((block) => !BOARD_ORDER.includes(block.domainId));
  return [...ordered, ...rest];
}
