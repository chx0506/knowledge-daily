import { html } from "@/shared/html";
import { KANSHAN_SRC } from "@/shared/brand";
import type { RuntimeState } from "@/app/store";

export function renderCover(state: RuntimeState): string {
  const { cover, displayDate } = state.paper;
  return html`
    <div class="result" data-go="home">
      <div class="topline">
        <span>${cover.kicker}</span>
        <b>${displayDate}</b>
      </div>
      <h1>${cover.headline}</h1>
      <figure class="kanshan-seal kanshan-seal-cover">
        <img src="${KANSHAN_SRC}" alt="" />
      </figure>
      <div class="bottomline">
        <b>知乎趣报已经送到</b><br />
        <span class="stats">${cover.stats}</span><br /><br />
        打开首页阅读完整板块　→
      </div>
    </div>
  `;
}
