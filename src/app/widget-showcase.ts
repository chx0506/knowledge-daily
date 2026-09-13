/**
 * 桌面小组件预览（方案文档里的可选能力：桌面小组件或推送）。
 * 挂在演示页右栏红框位，数据与手机里的今日一报同源（state.paper），
 * fixture / 远程 / 降级时都跟着同一份数据走。
 */
import type { RuntimeState, Store } from "@/app/store";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render(el: HTMLElement, state: RuntimeState): void {
  const { paper } = state;
  const no = String(paper.issueNo).padStart(4, "0");
  el.innerHTML = `
    <div class="overline">WIDGET / 桌面小组件</div>
    <div class="wshow-stage">
      <div class="wshow-widget" role="img" aria-label="知乎趣报桌面小组件预览">
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
      <div class="wshow-label">知乎趣报</div>
    </div>
    <p class="wshow-note">每天睁眼，先看判断。小组件与今日一报同一份数据。</p>
  `;
}

export function mountWidgetShowcase(el: HTMLElement, store: Store): void {
  render(el, store.get());
  store.subscribe((state) => render(el, state));
}
