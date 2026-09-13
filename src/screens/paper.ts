import { domainMeta, orderedBlocks } from "@/domain/catalog";
import type { DailyPaper, DomainBlock } from "@/domain/types";
import { padIssue, pageLabel } from "@/shared/format";
import { html } from "@/shared/html";
import { renderNameplate } from "@/shared/brand";

function coverLead(title: string, compact: boolean): { mark: string; rest: string } {
  if (title.startsWith("AI ") || title.startsWith("AI")) {
    const rest = title.replace(/^AI\s*/, "");
    if (compact) return { mark: "AI", rest };
    return {
      mark: "AI",
      rest: rest === "正在重塑软件的边界" ? "正在重塑<br>软件的边界" : rest,
    };
  }
  return { mark: "", rest: title };
}

function sectionNo(no: string): string {
  return no.padStart(3, "0");
}

function renderCoverPlate(block: DomainBlock, from: string, compact: boolean): string {
  const meta = domainMeta(block.domainId);
  const { mark, rest } = coverLead(block.lead.title, compact);
  return html`
    <button class="plate plate-cover" type="button" data-action="open-domain" data-domain-id="${block.domainId}" data-story-id="${block.lead.id}" data-from="${from}">
      <div class="plate-cover-main">
        <div class="plate-cover-title">
          ${mark
            ? `<div class="plate-ai-row"><b>${mark}</b><span class="plate-star" aria-hidden="true"></span></div>`
            : ""}
          <h2>${rest}</h2>
        </div>
        <div class="plate-cover-aside">
          <span class="plate-tag">${meta.name}</span>
          ${!compact && meta.sideLines?.length
            ? `<aside>${meta.sideLines.map((line) => `<span>${line}</span>`).join("")}</aside>`
            : ""}
        </div>
      </div>
      <div class="plate-cover-foot">
        <p>${compact ? `${block.lead.dek.split("。")[0]}。` : block.lead.dek}</p>
        <span class="plate-page">→${pageLabel(meta.no)}</span>
      </div>
    </button>
  `;
}

function renderPairPlate(block: DomainBlock, from: string): string {
  const meta = domainMeta(block.domainId);
  return html`
    <button class="plate plate-pair" type="button" data-action="open-domain" data-domain-id="${block.domainId}" data-story-id="${block.lead.id}" data-from="${from}">
      <div class="plate-num"><b>${sectionNo(meta.no)}</b><span>${meta.name}</span></div>
      <h3>${block.lead.title}</h3>
      <p>${block.lead.dek}</p>
      <div class="plate-page">${pageLabel(meta.no)} →</div>
    </button>
  `;
}

export function renderPaper(
  paper: DailyPaper,
  options: { from: "home" | "calendar" } = { from: "home" },
): string {
  const from = options.from;
  const compact = from === "home";
  const blocks = orderedBlocks(paper);
  const cover = blocks[0];
  const rest = blocks.slice(1);

  return html`
    <article class="paper${compact ? " onescreen" : ""}" data-paper-date="${paper.date}">
      <header class="masthead">
        ${renderNameplate("paper")}
        <div class="mast-date">
          <span>${paper.date.replaceAll("-", ".")} ${paper.weekday}</span>
          <b>${padIssue(paper.issueNo)}</b>
        </div>
      </header>

      <section class="plate-board">
        ${cover ? renderCoverPlate(cover, from, compact) : ""}
        <div class="plate-grid">
          ${rest.map((block) => renderPairPlate(block, from)).join("")}
          ${compact && rest.length % 2 === 1 ? `<span class="plate-navy-sliver" aria-hidden="true"></span>` : ""}
        </div>
      </section>

      <section class="top5 compact">
        <div class="top5-head">
          <h3>今日要闻 <span>TOP 5</span></h3>
          <span>综合推荐 <i>›</i></span>
        </div>
        <div class="top5-list">
          ${paper.top5
            .map((item, index) => {
              const meta = domainMeta(item.domainId);
              return html`
                <div class="top5-row" data-action="open-domain" data-domain-id="${item.domainId}" data-story-id="${item.storyId}" data-from="${from}">
                  <b class="top5-rank">${index + 1}</b>
                  <span class="top5-title">${item.title}</span>
                  <em>${meta.name}</em>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    </article>
  `;
}
