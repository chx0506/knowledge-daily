import { allStories, findDomainBlock, findStory, domainMeta } from "@/domain/catalog";
import type { DailyPaper, DomainId, DomainStory, RouteName } from "@/domain/types";
import { padIssue } from "@/shared/format";
import { html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";

function renderBriefing(article: DomainStory): string {
  const readings = article.readings ?? [];
  return html`
    <section class="brief-evidence">
      <h3>有数据表示</h3>
      <p>${article.evidence}</p>
    </section>
    <p class="brief-judgment">${article.judgment}</p>
    <section class="bodycopy">
      <h3>短调研</h3>
      ${(article.briefing ?? []).map((para) => `<p>${para}</p>`).join("")}
    </section>
    ${readings.length
      ? html`
          <section class="brief-readings">
            <h3>值得看的 ${readings.length} 篇</h3>
            ${readings
              .map(
                (item, index) => html`
                  <article class="brief-reading">
                    <b>${index + 1}. ${item.title}</b>
                    <span>${item.source}</span>
                    <p>${item.why}</p>
                    <button type="button" data-action="open-source" data-url="${item.url}">打开原文 →</button>
                  </article>
                `,
              )
              .join("")}
            ${article.indexNote ? `<p class="brief-index">${article.indexNote}</p>` : ""}
          </section>
        `
      : ""}
  `;
}

function renderLegacyBody(article: DomainStory): string {
  return html`
    <p class="dek">${article.dek}</p>
    <section class="bodycopy">
      <h3>事件概述</h3>
      <p>${article.body}</p>
      <h3>为什么重要</h3>
      <ul>
        ${article.bullets.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </section>
  `;
}

export function renderDomainArticle(
  state: RuntimeState,
  options: {
    embedded?: boolean;
    domainId?: DomainId;
    storyId?: string | null;
    paper?: DailyPaper;
    from?: RouteName;
  } = {},
): string {
  const domainId = options.domainId ?? state.domainId;
  const requestedStoryId = options.storyId === undefined ? state.storyId : options.storyId;
  const edition = options.paper ?? state.paper;
  const fallback = domainId
    ? (() => {
        const block = findDomainBlock(edition, domainId);
        return { paper: edition, story: block.lead };
      })()
    : findStory(state.archive, edition.hero.storyId);
  const local = requestedStoryId
    ? (() => {
        const story = allStories(edition).find((item) => item.id === requestedStoryId);
        return story ? { paper: edition, story } : null;
      })()
    : null;
  const found = local ?? (options.paper ? null : requestedStoryId ? findStory(state.archive, requestedStoryId) : null) ?? fallback;
  if (!found) {
    return options.embedded
      ? `<div class="domain-page domain-embedded"><p class="dek">这一领域今天还没有日报。</p></div>`
      : `<div class="domain-page"><button class="back" type="button" data-action="back-domain">‹</button></div>`;
  }

  const { paper, story } = found;
  const activeDomain = domainId ?? story.domainId;
  const meta = domainMeta(activeDomain);
  const block = findDomainBlock(paper, activeDomain);
  const article = story.domainId === activeDomain ? story : block.lead;
  const isBrief = Boolean(article.evidence && article.judgment && article.briefing?.length);
  const more = isBrief ? [] : [block.lead, ...block.items].filter((item) => item.id !== article.id);
  const from = options.embedded ? (options.from ?? "home") : "domain";

  return html`
    <div class="domain-page${options.embedded ? " domain-embedded" : ""}${isBrief ? " is-brief" : ""}">
      ${options.embedded ? "" : `<div class="domain-nav"><button class="back" type="button" data-action="back-domain">‹</button></div>`}
      <header class="domain-head">
        <div>
          <div class="domain-index">${meta.no}</div>
          <div class="domain-label">${meta.name}<span>${meta.nameEn}</span></div>
        </div>
        <div class="domain-issue">${padIssue(paper.issueNo)}<br />${paper.date.replaceAll("-", ".")}</div>
      </header>
      <h1>${article.title}</h1>
      <div class="metrics">
        <div><b>${article.sourceCount}</b><span>综合篇数<br />SOURCES</span></div>
        <div><b>${article.readMinutes}</b><span>分钟读完<br />MIN READ</span></div>
        <div><b>${article.readings?.length ?? article.bullets.length}</b><span>值得先读<br />TO READ</span></div>
      </div>
      ${isBrief ? renderBriefing(article) : renderLegacyBody(article)}
      ${more.length
        ? html`
            <section class="more-stories">
              <h3>同一领域 · 今日其余报道</h3>
              ${more
                .map(
                  (item) => html`
                    <button class="more-row" type="button" data-action="open-domain" data-domain-id="${item.domainId}" data-story-id="${item.id}" data-from="${from}">
                      <b>${item.title}</b>
                      <span>${item.dek}</span>
                    </button>
                  `,
                )
                .join("")}
            </section>
          `
        : ""}
    </div>
  `;
}

export function renderDomain(state: RuntimeState): string {
  return renderDomainArticle(state);
}
