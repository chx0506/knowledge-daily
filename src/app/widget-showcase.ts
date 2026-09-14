/**
 * 桌面小组件预览（方案文档里的可选能力：桌面小组件或推送）。
 * 挂在演示页右栏红框位，数据与手机里的今日一报同源（state.paper），
 * fixture / 远程 / 降级时都跟着同一份数据走。
 * 三种皮肤可切换：纸面小组件 / 大字报（宣传画）/ 暗夜锁屏。
 */
import type { RuntimeState, Store } from "@/app/store";

type Face = "paper" | "poster" | "dark";

const FACE_LABELS: Array<{ id: Face; label: string }> = [
  { id: "paper", label: "纸面" },
  { id: "poster", label: "大字报" },
  { id: "dark", label: "暗夜" },
];

let activeFace: Face = "paper";
let lastHtml = "";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPaper(paper: RuntimeState["paper"], no: string): string {
  return `
    <div class="wshow-widget wshow-face-paper" role="img" aria-label="知乎趣报纸面小组件预览">
      <div class="wshow-head">
        <span class="wshow-brand">知乎趣报</span>
        <span class="wshow-date">${escapeHtml(paper.displayDate)} ${escapeHtml(paper.weekday)}</span>
      </div>
      <div class="wshow-kicker">${escapeHtml(paper.hero.kicker)}</div>
      <div class="wshow-title">${escapeHtml(paper.hero.title)}</div>
      <div class="wshow-foot">
        <span class="wshow-stamp">NO.${no}</span>
        <span class="wshow-cue">看山派送 · 点我看今日一报</span>
      </div>
    </div>
  `;
}

function renderPoster(paper: RuntimeState["paper"], no: string): string {
  return `
    <div class="wshow-widget wshow-face-poster" role="img" aria-label="知乎趣报大字报小组件预览">
      <div class="wshow-rays" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="wshow-poster-head">知乎趣报 · 今日判断</div>
      <div class="wshow-poster-title">${escapeHtml(paper.hero.title)}</div>
      <div class="wshow-poster-slogan">更大的问题值得被看见</div>
      <div class="wshow-poster-foot">
        <span>${escapeHtml(paper.displayDate)} ${escapeHtml(paper.weekday)}</span>
        <span>NO.${no}</span>
      </div>
    </div>
  `;
}

function renderDark(paper: RuntimeState["paper"], no: string): string {
  return `
    <div class="wshow-widget wshow-face-dark" role="img" aria-label="知乎趣报暗夜小组件预览">
      <div class="wshow-dark-head">
        <span class="wshow-dark-brand">知乎趣报</span>
        <span class="wshow-dark-now">现在</span>
      </div>
      <div class="wshow-dark-title">${escapeHtml(paper.hero.title)}</div>
      <div class="wshow-dark-foot">
        <span>${escapeHtml(paper.hero.kicker)}</span>
        <span class="wshow-dark-no">NO.${no}</span>
      </div>
    </div>
  `;
}

function render(el: HTMLElement, state: RuntimeState): void {
  const { paper } = state;
  const no = String(paper.issueNo).padStart(4, "0");
  const face =
    activeFace === "poster"
      ? renderPoster(paper, no)
      : activeFace === "dark"
        ? renderDark(paper, no)
        : renderPaper(paper, no);
  const tabs = FACE_LABELS.map(
    ({ id, label }) =>
      `<button type="button" class="wshow-tab${id === activeFace ? " is-on" : ""}" data-face="${id}">${label}</button>`,
  ).join("");
  const html = `
    <div class="overline">WIDGET / 桌面小组件</div>
    <div class="wshow-switch" role="tablist" aria-label="切换小组件皮肤">${tabs}</div>
    <div class="wshow-stage">
      ${face}
      <div class="wshow-label">知乎趣报</div>
    </div>
    <p class="wshow-note">每天睁眼，先看判断。小组件与今日一报同一份数据。</p>
  `;
  // 数据没变就不重排，避免 store 每次轻微更新都重放入场动画
  if (html === lastHtml) return;
  lastHtml = html;
  el.innerHTML = html;
}

export function mountWidgetShowcase(el: HTMLElement, store: Store): void {
  el.addEventListener("click", (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>("[data-face]");
    if (!tab) return;
    activeFace = tab.dataset.face as Face;
    render(el, store.get());
  });
  render(el, store.get());
  store.subscribe((state) => render(el, state));
}
