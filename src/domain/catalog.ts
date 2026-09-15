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
];

/**
 * 首页分版 Tab 的顺序 = **后端给出的数据顺序**，推荐恒在首位。
 *
 * 这里原本是一个 `HOME_TABS` 常量，写死「推荐 → 财经 → 科技 → 生活 → 文化」。
 * 它带来三个后果，最后一个才是真正要命的：
 *
 *   1. 把主领域压到最右。后端 `daily.js` 的 genOrder 是「主领域 → 依据分从高到低」，
 *      推荐页据此写「文化版先读（依据最强，信号分 10.5）」，可 Tab 上文化却排在最右边，
 *      同一屏里自相矛盾。
 *   2. 常量之外的领域（国内 / 国际 / 游戏 / 设计 / 科学 / 旅行）出报时只能被追加到末尾，
 *      排序权在常量手里，而不是在算分的那一侧。
 *   3. **Tab 渲染出来了却点不动**：actions.ts 用同一个常量做守卫
 *      （`if (!HOME_TABS.includes(domainId)) return;`），于是「国际」这种领域
 *      明明在 nav 里画出了一个可点的按钮，点下去却被守卫静默吞掉——
 *      渲染用的是「本次真的出报的领域」，守卫用的却是「常量里写过的领域」，两套名单。
 *
 * 现在两份名单合并成一份：出报顺序就是 `paper.domains` 的顺序，
 * 前端不再持有第二份「哪些领域算分版」的名单。
 */
export function visibleHomeTabs(paper: DailyPaper): DomainId[] {
  const present = paper.domains
    .map((block) => block.domainId)
    .filter((id) => id !== "recommend");
  return ["recommend", ...present];
}

/** 本次首页有没有这个分版（推荐恒有）。Tab 点击是否有效，一律以此为准。 */
export function isHomeTab(paper: DailyPaper, domainId: DomainId): boolean {
  return visibleHomeTabs(paper).includes(domainId);
}

export const BOARD_ORDER: DomainId[] = ["tech", "finance", "domestic", "world", "culture", "life"];

export function domainMeta(id: DomainId): DomainMeta {
  return DOMAIN_CATALOG.find((item) => item.id === id) ?? DOMAIN_CATALOG[0];
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
  return BOARD_ORDER.map((id) => paper.domains.find((block) => block.domainId === id)).filter(
    (block): block is DomainBlock => Boolean(block),
  );
}
