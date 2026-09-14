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

export const HOME_TABS: DomainId[] = [
  "recommend",
  "finance",
  "tech",
  "life",
  "culture",
];

/**
 * 本次真正出报的分版（推荐恒在首位）。
 *
 * 未生成 / 被 skipped 的领域不占 Tab —— 一个点了没有内容的版位比没有这个版更糟。
 * 顺带修掉一个后果：homeTab 若停在未出报的领域上，会落到「今天没有送到」的空态，
 * 这里统一回落到推荐版。
 */
export function visibleHomeTabs(paper: DailyPaper): DomainId[] {
  return HOME_TABS.filter(
    (id) => id === "recommend" || paper.domains.some((block) => block.domainId === id),
  );
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
