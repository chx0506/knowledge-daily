/**
 * schema 4.0 → 前端视图模型的唯一映射点。
 * 后端输出的已是策展成品（basis / judgement / report / recommended），
 * 这里只做结构对齐与文案裁剪，不做二次打分或排序。
 */
import type {
  DailyPaper,
  DomainBlock,
  DomainId,
  DomainReading,
  DomainStory,
  DossierView,
  ProfileView,
  SkippedDomain,
} from "@/domain/types";
import type {
  RemoteDaily,
  RemoteDomainId,
  RemoteDomainReport,
  RemoteProfile,
  RemoteSignalCoverage,
  RemoteTopicDossier,
  EditionSource,
} from "./types";

/** 后端 6 领域 → 前端目录 id（前端把「国内」叫 domestic，其余同名）。 */
export const REMOTE_TO_FRONT_DOMAIN: Record<RemoteDomainId, DomainId> = {
  tech: "tech",
  finance: "finance",
  china: "domestic",
  world: "world",
  life: "life",
  culture: "culture",
};

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const MONTH_NAMES = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];

const CURATION_LABEL: Record<string, string> = {
  zhida: "知乎直答策展",
  rule_fallback: "规则策展",
  mixed: "混合策展",
};

const TIER_LABEL: Record<string, string> = {
  deep: "深读",
  standard: "标准",
  blind: "补盲",
};

const COVERAGE_LABELS: Array<[keyof RemoteSignalCoverage, string]> = [
  ["followees", "关注的人"],
  ["favorite_lists", "收藏夹"],
  ["favorite_items", "收藏内容"],
  ["own_contents", "个人创作"],
  ["user_directions", "学习方向"],
  ["feedback_records", "反馈记录"],
];

function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** report 是纯文本、按空格或换行分段，统一切成段落数组。 */
function reportParagraphs(report: string): string[] {
  const parts = report
    .split(/\n+|\s{2,}/)
    .map((para) => para.trim())
    .filter(Boolean);
  return parts.length ? parts : [report.trim()].filter(Boolean);
}

function mapId(remoteId: string): DomainId {
  return REMOTE_TO_FRONT_DOMAIN[remoteId as RemoteDomainId] ?? "tech";
}

function mapReadings(domain: RemoteDomainReport): DomainReading[] {
  return domain.recommended.map((item) => ({
    title: item.title,
    source: item.author ? `${item.source_type} · ${item.author}` : item.source_type,
    why: item.why_now,
    url: item.url,
    sourceType: item.source_type,
    cardId: item.source_id,
  }));
}

function mapIndexNote(domain: RemoteDomainReport): string {
  const cited = domain.source_index.filter((item) => item.cited);
  const total = domain.source_index.length;
  if (!total) return "";
  const listed = cited
    .slice(0, 4)
    .map((item, index) => `[${index + 1}] ${item.source_type} · ${clip(item.title, 16)}`)
    .join("　");
  const rest = total - cited.length;
  const tail = rest > 0 ? `　其余 ${rest} 篇只进入综合判断，不强制阅读。` : "";
  return `原文索引：${listed || "本版篇目均只进入综合判断"}${tail}`;
}

function mapDomainStory(daily: RemoteDaily, domain: RemoteDomainReport): DomainStory {
  const briefing = reportParagraphs(domain.report);
  const story: DomainStory = {
    id: `${daily.date}-${domain.domain_id}`,
    domainId: mapId(domain.domain_id),
    title: domain.judgement,
    dek: domain.judgement,
    body: briefing[0] ?? "",
    bullets: briefing.slice(1),
    sourceCount: domain.basis.synthesized_count,
    readMinutes: Math.max(3, Math.min(10, Math.round(domain.report.length / 150))),
    evidence: domain.basis.text,
    judgment: domain.judgement,
    briefing,
    readings: mapReadings(domain),
    indexNote: mapIndexNote(domain),
    tier: domain.tier,
  };
  story.cardId = domain.recommended[0]?.source_id ?? story.id;
  return story;
}

function mapSkipped(daily: RemoteDaily): SkippedDomain[] {
  return daily.skipped_domains.map((item) => ({
    id: mapId(item.domain_id),
    name: item.name,
    reason: item.reason,
  }));
}

function mapTop5(daily: RemoteDaily, stories: Map<string, DomainStory>): DailyPaper["top5"] {
  const ordered: RemoteDomainReport[] = [];
  const firstId = daily.mainline.first_read?.domain_id;
  if (firstId) {
    const first = daily.domains.find((domain) => domain.domain_id === firstId);
    if (first) ordered.push(first);
  }
  for (const domain of daily.domains) {
    if (!ordered.includes(domain)) ordered.push(domain);
  }
  return ordered.slice(0, 5).map((domain, index) => {
    const story = stories.get(domain.domain_id)!;
    const heat =
      index === 0 ? "首选" : domain.tier === "blind" ? "补盲" : (domain.recommended[0]?.source_type ?? "搜索");
    return { storyId: story.id, title: clip(domain.judgement, 22), domainId: story.domainId, heat };
  });
}

export function mapDailyToPaper(daily: RemoteDaily, origin: EditionSource): DailyPaper {
  const blocks: DomainBlock[] = daily.domains.map((domain) => ({
    domainId: mapId(domain.domain_id),
    lead: mapDomainStory(daily, domain),
    items: [],
  }));
  const stories = new Map(daily.domains.map((domain, i) => [domain.domain_id, blocks[i].lead]));
  const firstId = daily.mainline.first_read?.domain_id;
  const heroStory = (firstId && stories.get(firstId)) || blocks[0]?.lead;

  const date = daily.date;
  const day = new Date(`${date}T00:00:00+08:00`);
  const month = Number(date.slice(5, 7));
  const curation = CURATION_LABEL[daily.data_source?.curation ?? ""] ?? "知乎策展";
  const tags = daily.profile.tags.slice(0, 2).map((tag) => tag.name);
  const firstReadName = daily.mainline.first_read?.name ?? blocks[0]?.lead.domainId ?? "";
  const warnings = [...(daily.warnings ?? [])];
  if (daily.stale_reason) warnings.unshift(daily.stale_reason);

  const generatedAt = daily.generated_at ? new Date(daily.generated_at * 1000) : new Date();
  const timeText = `${String(generatedAt.getHours()).padStart(2, "0")}:${String(generatedAt.getMinutes()).padStart(2, "0")}`;

  return {
    id: `remote-${daily.daily_id || date}`,
    date,
    displayDate: date.slice(5).replace("-", "."),
    monthLabel: `${MONTH_NAMES[month - 1] ?? ""}月.${date.slice(0, 4)}`,
    weekday: WEEKDAYS[day.getDay()] ?? "",
    issueNo: day.getDate() + 1,
    hero: {
      kicker: `今日主线 · 综合 ${daily.mainline.total_synthesized} 篇 · ${curation}`,
      title: daily.mainline.judgement,
      subtitle: daily.mainline.basis_text,
      asideTitle: "今日判断",
      asidePoints: [
        firstReadName ? `${firstReadName}版先读` : "推荐页先读",
        ...tags,
        `综合 ${daily.mainline.total_synthesized} 篇`,
      ].slice(0, 4),
      storyId: heroStory?.id ?? "",
    },
    top5: mapTop5(daily, stories),
    domains: blocks,
    quote: daily.profile.summary ?? "好日报，不只是信息，而是理解这个时代的另一种方式。",
    cover: {
      kicker: origin === "fixture" ? "离线样例" : "正日报",
      headline: daily.mainline.judgement,
      stats: `编排完成 ${timeText}　　领域 ${String(blocks.length).padStart(2, "0")}　综合 ${daily.mainline.total_synthesized}`,
    },
    skipped: mapSkipped(daily),
    stale: daily.stale || origin === "stale",
    warnings,
    origin,
  };
}

export function mapProfileToView(profile: RemoteProfile): ProfileView {
  const prefs = profile.user_preferences;
  return {
    summary: profile.summary ?? profile.confidence_reason,
    confidence: profile.confidence,
    confidenceReason: profile.confidence_reason,
    coldStart: profile.cold_start,
    tags: [...profile.tags]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6)
      .map((tag) => ({
        name: tag.name,
        weight: tag.weight,
        source: tag.source,
        confidenceTier: tag.confidence_tier,
        evidence: (tag.evidence ?? [])
          .filter((item) => item.label)
          .slice(0, 2)
          .map((item) => ({ label: item.label, url: item.url })),
      })),
    directions: prefs?.directions ?? [],
    keywords: prefs?.keywords ?? [],
    goal: prefs?.goal ?? "",
    blocked: prefs?.blocked ?? [],
    platformItems: profile.platform_recommendation?.items ?? [],
    platformNote: profile.platform_recommendation?.note ?? "",
    coverage: COVERAGE_LABELS.map(([key, label]) => ({
      label,
      value: profile.signal_coverage?.[key] ?? 0,
    })),
  };
}

export function mapDossierToView(dossier: RemoteTopicDossier): DossierView {
  return {
    topic: dossier.topic,
    title: dossier.name || dossier.topic,
    judgement: dossier.judgement,
    basisText: dossier.basis?.text ?? "",
    report: reportParagraphs(dossier.report ?? ""),
    readings: mapReadings(dossier),
    sourceCount: dossier.basis?.synthesized_count ?? 0,
    generatedBy: dossier.generated_by,
    warnings: dossier.warnings ?? [],
  };
}

export function tierLabel(tier: string | undefined): string {
  return TIER_LABEL[tier ?? ""] ?? "标准";
}
