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

function renderAuthBlock(state: RuntimeState): string {
  const { auth } = state;
  if (auth.state === "in") {
    return html`
      <section class="mine-block">
        <h2>知乎账号</h2>
        <p>已登录：${escapeHtml(auth.name ?? "知乎用户")}。日报会按你自己的关注、收藏与创作来编。</p>
      </section>
    `;
  }
  if (auth.oauthReady) {
    return html`
      <section class="mine-block">
        <h2>知乎账号</h2>
        <p>登录后，日报按你自己的知乎信号来编，而不是公共样本。</p>
        <button class="mine-generate" type="button" data-action="login">登录知乎 →</button>
      </section>
    `;
  }
  return html`
    <section class="mine-block">
      <h2>知乎账号</h2>
      <p>后端未配置 OAuth 凭证，当前以赛事 Access Secret 身份取数，登录入口暂不开放。</p>
    </section>
  `;
}

function renderProfileViewBlock(state: RuntimeState): string {
  const view = state.profileView;
  if (!view) return "";
  return html`
    <section class="mine-block">
      <h2>你的知乎画像</h2>
      <p>${escapeHtml(view.summary)}（置信度 ${escapeHtml(view.confidence)}）</p>
      <div class="mine-tags">
        ${view.tags
          .map(
            (tag) => html`
              <div class="mine-tag">
                <b>${escapeHtml(tag.name)}</b>
                <span>${Math.round(tag.weight * 100)} 分 · ${escapeHtml(tag.confidenceTier)}</span>
                ${tag.evidence[0]?.url
                  ? `<button type="button" data-action="open-source" data-url="${tag.evidence[0].url}">${escapeHtml(tag.evidence[0].label)} ↗</button>`
                  : ""}
              </div>
            `,
          )
          .join("")}
      </div>
      <p class="mine-coverage">${view.coverage.map((item) => `${item.label} ${item.value}`).join(" · ")}</p>
      ${view.platformItems.length
        ? html`
            <h3 class="mine-sub">知乎官方推荐（未加工）</h3>
            <ul class="mine-platform">
              ${view.platformItems
                .map(
                  (item) =>
                    `<li><button type="button" data-action="open-source" data-url="${item.url}">${escapeHtml(item.title)} ↗</button></li>`,
                )
                .join("")}
            </ul>
          `
        : ""}
    </section>
  `;
}

function renderDirectionsBlock(state: RuntimeState): string {
  const view = state.profileView;
  if (!view) return "";
  const options = [...new Set([...state.directionOptions, ...view.directions])];
  if (!options.length) return "";
  return html`
    <section class="mine-block">
      <h2>学习方向</h2>
      <p>写进知乎画像的高置信度信号，下次出报优先采用。</p>
      <div class="mine-topics" role="group" aria-label="学习方向">
        ${options
          .map((direction) => {
            const on = view.directions.includes(direction);
            return `<button class="mine-topic${on ? " is-on" : ""}" type="button" data-action="toggle-direction" data-topic="${escapeHtml(direction)}" aria-pressed="${on}">${escapeHtml(direction)}</button>`;
          })
          .join("")}
      </div>
    </section>
  `;
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

      ${renderAuthBlock(state)}

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

      ${renderDirectionsBlock(state)}

      ${renderProfileViewBlock(state)}

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
        <div class="mine-pref">
          <div class="mine-pref-copy">
            <b>只看我的方向</b>
            <span>${state.signalOnly ? "只出与你兴趣相关的板块" : "开启后只出与你兴趣相关的板块，关掉会顺带做关联拓展"}</span>
          </div>
          <button class="mine-switch${state.signalOnly ? " is-on" : ""}" type="button" data-action="toggle-signal-only" aria-pressed="${state.signalOnly}" aria-label="只看我的方向">
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
