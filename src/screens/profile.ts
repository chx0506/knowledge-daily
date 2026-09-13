import { TOPIC_OPTIONS } from "@/data/mock/fixtures";
import { formatQuota, padIssue } from "@/shared/format";
import { escapeHtml, html } from "@/shared/html";
import { KANSHAN_AVATAR_SRC } from "@/shared/brand";
import type { RuntimeState } from "@/app/store";

const DESK_ROWS = [
  { go: "calendar", label: "历史报纸", hint: "按天回看已送到的报" },
  { go: "discover", label: "他人兴趣卡", hint: "再收一张，明天更好编" },
] as const;

function readingSummary(state: RuntimeState): string {
  const { briefLength, morningPush, weekendSkip } = state.profile;
  const length = briefLength === "full" ? "全版" : "短读";
  const morning = morningPush ? "晨报会响" : "晨报静音";
  const weekend = weekendSkip ? "周末休刊" : "七日都送";
  return `${length}，${morning}，${weekend}`;
}

export function renderProfile(state: RuntimeState): string {
  const { quotaUsed, quotaTotal, readerName, briefLength, morningPush, weekendSkip } = state.profile;
  const topics = state.selectedTopics;
  const remaining = Math.max(quotaTotal - quotaUsed, 0);

  return html`
    <div class="mine">
      <header class="mine-mast">
        <div class="page-kicker">MY EDITION</div>
        <div class="mine-issue">${padIssue(state.paper.issueNo)}</div>
      </header>

      <section class="mine-id">
        <div class="mine-avatar-wrap">
          <figure class="mine-avatar">
            <img src="${KANSHAN_AVATAR_SRC}" alt="刘看山" />
          </figure>
          <span class="mine-stamp">订</span>
        </div>
        <div class="mine-who">
          <h1>${escapeHtml(readerName)}</h1>
          <p>看山按你的领域编排今日一报，已存 ${state.archive.length} 份。</p>
        </div>
      </section>

      <div class="mine-metrics">
        <div>
          <b>${state.archive.length}</b>
          <span>已存报纸</span>
        </div>
        <div>
          <b>${topics.length}</b>
          <span>关注领域</span>
        </div>
        <div>
          <b>${formatQuota(quotaUsed, quotaTotal)}</b>
          <span>今日额度</span>
        </div>
      </div>

      <section class="mine-block">
        <h2>你的领域</h2>
        <p>点选栏目，看山明天按这个单子来编。最多 10 个。</p>
        <div class="mine-topics" role="group" aria-label="兴趣领域">
          ${TOPIC_OPTIONS.map((topic) => {
            const on = topics.includes(topic);
            return `<button class="mine-topic${on ? " is-on" : ""}" type="button" data-action="toggle-topic" data-topic="${topic}" aria-pressed="${on}">${topic}</button>`;
          }).join("")}
        </div>
        <div class="mine-count">已选 ${topics.length} / 10</div>
        <button class="mine-generate" type="button" data-action="generate">按新领域出报</button>
      </section>

      <section class="mine-block">
        <h2>阅读口味</h2>
        <p>${readingSummary(state)}</p>
        <div class="mine-pref">
          <div class="mine-pref-copy">
            <b>篇幅</b>
            <span>${briefLength === "full" ? "留下对照和原文" : "每篇压到三分钟"}</span>
          </div>
          <div class="mine-seg" role="group" aria-label="篇幅">
            <button class="${briefLength === "short" ? "is-on" : ""}" type="button" data-action="set-brief" data-brief="short">短读</button>
            <button class="${briefLength === "full" ? "is-on" : ""}" type="button" data-action="set-brief" data-brief="full">全版</button>
          </div>
        </div>
        <div class="mine-pref">
          <div class="mine-pref-copy">
            <b>晨报提醒</b>
            <span>${morningPush ? "出门前送到" : "到了再自己翻"}</span>
          </div>
          <button class="mine-switch${morningPush ? " is-on" : ""}" type="button" data-action="toggle-pref" data-pref="morningPush" aria-pressed="${morningPush}" aria-label="晨报提醒">
            <i></i>
          </button>
        </div>
        <div class="mine-pref">
          <div class="mine-pref-copy">
            <b>周末休刊</b>
            <span>${weekendSkip ? "周六日停下" : "七日都送一报"}</span>
          </div>
          <button class="mine-switch${weekendSkip ? " is-on" : ""}" type="button" data-action="toggle-pref" data-pref="weekendSkip" aria-pressed="${weekendSkip}" aria-label="周末休刊">
            <i></i>
          </button>
        </div>
      </section>

      <section class="mine-desk">
        ${DESK_ROWS.map(
          (row) => html`
            <button class="mine-row" type="button" data-go="${row.go}">
              <span>
                <b>${row.label}</b>
                <small>${row.hint}</small>
              </span>
              <em>›</em>
            </button>
          `,
        ).join("")}
      </section>

      <footer class="mine-colophon">
        <div class="mine-quota-line">
          <span>今日还剩 ${remaining} 个推荐位</span>
          <strong>${formatQuota(quotaUsed, quotaTotal)}</strong>
        </div>
        <p>额度用完后，日历里的旧报仍可翻。</p>
      </footer>
    </div>
  `;
}
