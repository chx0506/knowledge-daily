import { domainMeta, findDomainBlock, visibleHomeTabs } from "@/domain/catalog";
import type { DailyPaper, DomainId, RouteName } from "@/domain/types";
import { padIssue } from "@/shared/format";
import { escapeHtml, html } from "@/shared/html";
import { renderNameplate } from "@/shared/brand";
import type { Actions } from "@/app/actions";
import type { RuntimeState } from "@/app/store";
import { renderDomainArticle } from "./domain";

function wrapLines(lines: string[]): string {
  return lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("");
}

function wrapStamp(title: string): string {
  const chars = [...title.replace(/\s/g, "")];
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += 2) {
    lines.push(chars.slice(i, i + 2).join(""));
  }
  return wrapLines(lines);
}

function wrapHeadline(title: string, maxChars = 6): string {
  const phrases = title.split(/(?<=[，。、])/).filter(Boolean);
  const chunks: string[] = [];
  for (const phrase of phrases) {
    const tokens = phrase.match(/[A-Za-z0-9]+|[，。、]|[^\sA-Za-z0-9，。、]/g) ?? [];
    let buf = "";
    let width = 0;
    for (const tok of tokens) {
      if (tok === "，" || tok === "。" || tok === "、") {
        buf += tok;
        continue;
      }
      const unit = /[A-Za-z0-9]/.test(tok) ? Math.min(tok.length, 2) : 1;
      if (width + unit > maxChars && buf) {
        chunks.push(buf);
        buf = tok;
        width = unit;
      } else {
        buf += tok;
        width += unit;
      }
    }
    if (buf) chunks.push(buf);
  }
  const last = chunks.at(-1) ?? "";
  const prev = chunks.at(-2) ?? "";
  if (chunks.length >= 2 && last.replace(/[，。、]/g, "").length <= 2 && prev.length <= 6) {
    chunks.splice(-2, 2, prev + last);
  }
  return wrapLines(chunks);
}

function sheetPage(no: string): string {
  return `P${no.replace(/\D/g, "").padStart(3, "0")}`;
}

const BRIEF_STAMPS: Record<string, { mark: string; navy?: boolean; title: string }> = {
  收藏: { mark: "藏", title: "来自你的收藏" },
  搜索: { mark: "热", title: "正在被搜" },
  兴趣卡: { mark: "趣", navy: true, title: "兴趣卡收下的" },
  补盲: { mark: "补", navy: true, title: "补你没盯住的" },
  切片: { mark: "片", title: "生活里的一条" },
};

function briefStamp(heat: string, index: number) {
  const known = BRIEF_STAMPS[heat];
  if (known) return known;
  return {
    mark: heat.slice(0, 1),
    navy: index % 2 === 1,
    title: heat,
  };
}

function renderRecommend(paper: DailyPaper, from: RouteName): string {
  const tech = domainMeta("tech");
  const culture = domainMeta("culture");
  const heroTitle = paper.hero.titleLines?.length
    ? wrapLines(paper.hero.titleLines)
    : wrapHeadline(paper.hero.title, 6);
  return html`
    <article class="front sheet">
      <button class="sheet-hero" type="button" data-action="open-domain" data-domain-id="tech" data-story-id="${paper.hero.storyId}" data-from="${from}">
        <div class="sheet-hero-main">
          <small>${paper.hero.kicker}</small>
          <h2>${heroTitle}</h2>
          <div class="sheet-hero-dek">
            <p>${paper.hero.subtitle}</p>
            <em>READ A DEEPER WORLD</em>
          </div>
        </div>
        <aside class="sheet-hero-side">
          <div class="sheet-hero-side-head">
            <b>${wrapStamp(paper.hero.asideTitle)}</b>
            <span class="sheet-hero-badge">AI<br />今日精选</span>
          </div>
          <ul>
            ${paper.hero.asidePoints.map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <span class="sheet-page light">${sheetPage(tech.no)}</span>
        </aside>
      </button>

      <section class="sheet-pair">
        <button class="sheet-plate sheet-plate-mount" type="button" data-action="select-home-tab" data-domain-id="culture">
          <div class="sheet-plate-top">
            <small>文化版</small>
            <em>科技版交出去<br />这边负责减速</em>
          </div>
          <h3>${wrapLines(["把判断", "留下"])}</h3>
          <span class="sheet-page">${sheetPage(culture.no)}</span>
        </button>
        <button class="sheet-plate sheet-plate-icon" type="button" data-go="calendar">
          <div class="sheet-plate-top">
            <small>重读</small>
            <em>同一条主线<br />按天回看</em>
          </div>
          <img class="sheet-cycle" src="/home/sheet-cycle.svg" alt="" />
          <h3>${wrapLines(["比追新", "更重要"])}</h3>
          <span class="sheet-page">${sheetPage("7")}</span>
        </button>
      </section>

      <section class="sheet-briefs">
        <div class="sheet-briefs-head">
          <h3>今日先读 <span>QUICK READ</span></h3>
          <span>三分钟，读完今天的报 <i aria-hidden="true"><b></b><b></b><b></b><b></b></i></span>
        </div>
        ${paper.top5
          .map((item, index) => {
            const stamp = briefStamp(item.heat, index);
            return html`
              <div class="sheet-brief" data-action="open-domain" data-domain-id="${item.domainId}" data-story-id="${item.storyId}" data-from="${from}">
                <b>${String(index + 1).padStart(2, "0")}</b>
                <span>${item.title}</span>
                <small class="sheet-heat${stamp.navy ? " is-navy" : ""}" title="${stamp.title}">${stamp.mark}</small>
              </div>
            `;
          })
          .join("")}
      </section>

      <button class="sheet-foot" type="button" data-go="discover" aria-label="看山送到的今日一报">
        <img src="/home/sheet-foot-banner.png?v=qubao" alt="" />
      </button>
    </article>
  `;
}

function renderPane(state: RuntimeState, paper: DailyPaper, tab: DomainId, from: RouteName): string {
  if (tab === "recommend") return renderRecommend(paper, from);
  if (!paper.domains.some((block) => block.domainId === tab)) {
    const skipped = paper.skipped?.find((item) => item.id === tab);
    return html`
      <div class="domain-page domain-embedded domain-skipped">
        <p class="dek">「${domainMeta(tab).name}」今天没有送到。</p>
        <p class="domain-skipped-reason">${skipped?.reason ?? "今日未生成这一领域。"}</p>
        <p class="domain-skipped-hint">去「发现」页做一次主动策展，或在「我的」里调整学习方向。</p>
      </div>
    `;
  }
  const block = findDomainBlock(paper, tab);
  const storyId = state.homeTab === tab ? state.storyId : block.lead.id;
  return renderDomainArticle(state, { embedded: true, domainId: tab, storyId, paper, from });
}

/**
 * 告警条已按需求下线（原 `.paper-notice` 白框）。
 *
 * 原因：这个位置长期只会长内部步骤诊断（「recall.search(culture): rate limit exceeded」
 * 「curate.ai(culture) 已降级到规则版: 直答返回的 JSON 无法解析」），读者看到只会
 * 以为产品坏了；而在报纸版面上它又是一块突兀的白框，压住抬头与分版 tab。
 *
 * 处理方式不是「丢掉信息」，而是「换个地方」：状态一律转 console，
 * 排查时照旧可见，读者版面上不再出现。函数保留为显式 no-op，
 * 避免以后有人顺手把它接回来时忘了这段结论。
 */
function renderNotice(paper: DailyPaper): string {
  const warnings = paper.warnings ?? [];
  if (warnings.length) {
    console.warn("[knowledge-daily] 本期状态（不上版面）:", {
      origin: paper.origin,
      stale: paper.stale,
      warnings,
    });
  }
  return "";
}

export function renderFrontNewspaper(state: RuntimeState, paper: DailyPaper, from: RouteName): string {
  // 只渲染本次真正出报的版：未生成的领域不占 Tab（点了没内容比没有更糟）
  const tabs = visibleHomeTabs(paper);
  const homeTab = tabs.includes(state.homeTab) ? state.homeTab : "recommend";
  return html`
    <header class="front-mast">
      ${renderNameplate("mast")}
      <div class="front-mast-date">
        <b>${paper.displayDate}</b>
        <span>${paper.date.replaceAll("-", ".")} ${paper.weekday}</span>
        <span>${paper.lunar ?? ""}</span>
      </div>
      <div class="front-mast-aside">${padIssue(paper.issueNo)}<br />看山派送</div>
    </header>

    ${renderNotice(paper)}

    <nav class="home-tabs" data-home-tabs>
      ${tabs.map((id) => {
        const meta = domainMeta(id);
        return `<button class="home-tab${homeTab === id ? " is-active" : ""}" type="button" data-action="select-home-tab" data-domain-id="${id}">${meta.name}</button>`;
      }).join("")}
    </nav>

    <div class="home-swipe" data-home-swipe>
      ${tabs.map(
        (id) => html`
          <section class="home-pane${homeTab === id ? " is-active" : ""}" data-home-pane="${id}">
            ${renderPane(state, paper, id, from)}
          </section>
        `,
      ).join("")}
    </div>
  `;
}

export function renderHome(state: RuntimeState): string {
  return html`
    <div class="home-page home-feed">
      ${renderFrontNewspaper(state, state.paper, "home")}
    </div>
  `;
}

export function mountFrontNewspaper(root: HTMLElement, state: RuntimeState, actions: Actions) {
  const swipe = root.querySelector<HTMLElement>("[data-home-swipe]");
  const tabs = root.querySelector<HTMLElement>("[data-home-tabs]");
  if (!swipe) return;

  // 与 render 同源：横滑索引必须按「实际渲染出来的版」算，否则会和 Tab 错位
  const visible = visibleHomeTabs(state.paper);
  const index = Math.max(0, visible.indexOf(state.homeTab));
  const last = visible.length - 1;
  const widthOf = () => swipe.clientWidth;

  const align = (behavior: ScrollBehavior = "auto") => {
    const width = widthOf();
    if (width > 0) swipe.scrollTo({ left: index * width, behavior });
    tabs?.querySelector(".is-active")?.scrollIntoView({ inline: "center", block: "nearest" });
  };
  align();
  requestAnimationFrame(() => align());

  let settling = false;
  const go = (next: number) => {
    if (settling) return;
    const clamped = Math.max(0, Math.min(last, next));
    const id = visible[clamped];
    if (!id) return;
    const width = widthOf();
    if (width > 0) swipe.scrollTo({ left: clamped * width, behavior: "smooth" });
    if (clamped === index) return;
    settling = true;
    window.setTimeout(() => actions.selectHomeTab(id), 280);
  };

  tabs?.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>("[data-action='select-home-tab']");
    const id = btn?.dataset.domainId as DomainId | undefined;
    if (!id) return;
    event.preventDefault();
    actions.selectHomeTab(id);
  });

  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let pointerId = -1;
  let axis: "h" | "v" | null = null;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;

  swipe.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragging = true;
    pointerId = event.pointerId;
    startX = lastX = event.clientX;
    startY = event.clientY;
    startLeft = swipe.scrollLeft;
    lastT = event.timeStamp;
    velocity = 0;
    axis = null;
  });

  swipe.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (axis === "h") swipe.setPointerCapture(event.pointerId);
    }
    if (axis !== "h") return;
    event.preventDefault();
    const dt = Math.max(1, event.timeStamp - lastT);
    velocity = (event.clientX - lastX) / dt;
    lastX = event.clientX;
    lastT = event.timeStamp;
    const width = widthOf();
    const limited = Math.max(-width, Math.min(width, dx));
    swipe.scrollLeft = Math.min(last * width, Math.max(0, startLeft - limited));
  });

  const finish = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    if (axis !== "h") return;
    const dx = event.clientX - startX;
    const width = widthOf();
    const threshold = Math.max(48, width * 0.18);
    const flicked = Math.abs(velocity) > 0.35;
    if (dx < -threshold || (flicked && velocity < 0 && dx < -12)) go(index + 1);
    else if (dx > threshold || (flicked && velocity > 0 && dx > 12)) go(index - 1);
    else go(index);
  };

  swipe.addEventListener("pointerup", finish);
  swipe.addEventListener("pointercancel", finish);

  let wheelLock = 0;
  swipe.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = Date.now();
      if (now < wheelLock) return;
      if (event.deltaX > 8) {
        wheelLock = now + 420;
        go(index + 1);
      } else if (event.deltaX < -8) {
        wheelLock = now + 420;
        go(index - 1);
      }
    },
    { passive: false },
  );
}

export function mountHome(root: HTMLElement, state: RuntimeState, actions: Actions) {
  mountFrontNewspaper(root, state, actions);
}
