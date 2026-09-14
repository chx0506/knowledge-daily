/**
 * 桌面小组件预览：三种皮肤，只展示小组件本身。
 * 有今日一报时跟 paper 走；空报时用样报，避免只剩空壳设计。
 */
import type { RuntimeState, Store } from "@/app/store";
import { domainMeta } from "@/domain/catalog";
import type { DailyPaper } from "@/domain/types";

type Face = "paper" | "poster" | "dark";

const FACE_LABELS: Array<{ id: Face; label: string }> = [
  { id: "paper", label: "纸面" },
  { id: "poster", label: "大字报" },
  { id: "dark", label: "暗夜" },
];

const SAMPLE = {
  displayDate: "09.14",
  weekday: "星期一",
  issueNo: 15,
  kicker: "今日判断 · 科技 · 综合 19 篇",
  title: "AI 正在改产品工作，而不只是多一个工具",
  titleLines: ["AI 正在改", "产品工作，", "而不只是", "多一个工具"],
  items: [
    { domain: "科技", title: "产品经理还该不该写 PRD" },
    { domain: "文化", title: "重读比追新更重要" },
    { domain: "生活", title: "晚上最后一次打开评审窗口" },
  ],
};

let activeFace: Face = "paper";
let lastHtml = "";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function plain(text: string): string {
  return text.replace(/<br\s*\/?>/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function widgetModel(paper: DailyPaper) {
  const title = plain(paper.hero.title);
  const empty = !title || /综合\s*0\s*篇/.test(paper.hero.kicker);
  if (empty) return SAMPLE;
  const items = paper.top5.slice(0, 3).map((item) => ({
    domain: domainMeta(item.domainId).name,
    title: plain(item.title),
  }));
  return {
    displayDate: paper.displayDate,
    weekday: paper.weekday,
    issueNo: paper.issueNo,
    kicker: paper.hero.kicker,
    title,
    titleLines: paper.hero.titleLines?.map(plain) ?? [title],
    items: items.length ? items : SAMPLE.items,
  };
}

function itemRows(items: Array<{ domain: string; title: string }>): string {
  return items
    .slice(0, 2)
    .map(
      (item) =>
        `<div class="wshow-item"><b>${escapeHtml(item.domain)}</b><span>${escapeHtml(item.title)}</span></div>`,
    )
    .join("");
}

function renderPaper(copy: ReturnType<typeof widgetModel>, no: string): string {
  return `
    <div class="wshow-widget wshow-face-paper" role="img" aria-label="纸面小组件：${escapeHtml(copy.title)}">
      <div class="wshow-head">
        <span class="wshow-brand">知乎趣报</span>
        <span class="wshow-date">${escapeHtml(copy.displayDate)} ${escapeHtml(copy.weekday)}</span>
      </div>
      <div class="wshow-kicker">${escapeHtml(copy.kicker)}</div>
      <div class="wshow-title">${escapeHtml(copy.title)}</div>
      <div class="wshow-list">${itemRows(copy.items)}</div>
      <div class="wshow-foot">
        <span class="wshow-stamp">NO.${no}</span>
        <span class="wshow-cue">点开看今日一报</span>
      </div>
    </div>
  `;
}

function renderPoster(copy: ReturnType<typeof widgetModel>, no: string): string {
  const lines = copy.titleLines.slice(0, 4).map((line) => `<span>${escapeHtml(line)}</span>`).join("");
  return `
    <div class="wshow-widget wshow-face-poster" role="img" aria-label="大字报小组件：${escapeHtml(copy.title)}">
      <div class="wshow-rays" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="wshow-poster-head">知乎趣报 · 今日判断</div>
      <div class="wshow-poster-title">${lines || escapeHtml(copy.title)}</div>
      <div class="wshow-poster-item">${escapeHtml(copy.items[0]?.title ?? "")}</div>
      <div class="wshow-poster-foot">
        <span>${escapeHtml(copy.displayDate)} ${escapeHtml(copy.weekday)}</span>
        <span>NO.${no}</span>
      </div>
    </div>
  `;
}

function renderDark(copy: ReturnType<typeof widgetModel>, no: string): string {
  const rows = copy.items
    .slice(0, 2)
    .map(
      (item) =>
        `<div class="wshow-night-row"><b>${escapeHtml(item.domain)}</b><span>${escapeHtml(item.title)}</span></div>`,
    )
    .join("");
  return `
    <div class="wshow-widget wshow-face-dark" role="img" aria-label="夜刊小组件：${escapeHtml(copy.title)}">
      <b class="wshow-night-seal">号外</b>
      <div class="wshow-dark-mast">
        <span>知乎趣报 · 夜刊</span>
        <span>NO.${no}</span>
      </div>
      <div class="wshow-dark-title">${escapeHtml(copy.title)}</div>
      <i class="wshow-night-rule" aria-hidden="true"></i>
      <div class="wshow-night-list">${rows}</div>
    </div>
  `;
}

function render(el: HTMLElement, state: RuntimeState): void {
  const copy = widgetModel(state.paper);
  const no = String(copy.issueNo).padStart(4, "0");
  const face =
    activeFace === "poster"
      ? renderPoster(copy, no)
      : activeFace === "dark"
        ? renderDark(copy, no)
        : renderPaper(copy, no);
  const caption =
    activeFace === "dark" ? "夜刊皮肤" : activeFace === "poster" ? "大字报皮肤" : "纸面皮肤";
  const tabs = FACE_LABELS.map(
    ({ id, label }) =>
      `<button type="button" class="wshow-tab${id === activeFace ? " is-on" : ""}" data-face="${id}">${label}</button>`,
  ).join("");
  const html = `
    <div class="overline">WIDGET / 桌面小组件</div>
    <div class="wshow-switch" role="tablist" aria-label="切换小组件皮肤">${tabs}</div>
    <div class="wshow-stage">
      ${face}
      <div class="wshow-label">${caption}</div>
    </div>
    <p class="wshow-note">每天睁眼，先看判断。三种皮肤同一份今日内容。</p>
  `;
  if (html === lastHtml) return;
  lastHtml = html;
  el.innerHTML = html;
}

export function mountWidgetShowcase(el: HTMLElement, store: Store): void {
  el.addEventListener("click", (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-face]");
    if (!tab) return;
    activeFace = tab.dataset.face as Face;
    lastHtml = "";
    render(el, store.get());
  });
  render(el, store.get());
  store.subscribe((state) => render(el, state));
}
