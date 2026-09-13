import { TOPIC_OPTIONS } from "@/data/mock/fixtures";
import { html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";

export function renderOnboard(state: RuntimeState): string {
  const selected = state.selectedTopics;
  return html`
    <div class="onboard">
      <div class="skip" data-action="skip-onboard">跳过</div>
      <h1>选择你感兴趣的领域</h1>
      <p>我们将为你生成专属的日报内容<br />（最多选择 10 个）</p>
      <div class="choices">
        ${TOPIC_OPTIONS.map((topic) => {
          const on = selected.includes(topic) ? " sel" : "";
          return `<button class="choice${on}" type="button" data-action="toggle-topic" data-topic="${topic}">＋${topic}</button>`;
        }).join("")}
      </div>
      <div class="selected">已选择 ${selected.length} / 10</div>
      <button class="generate" type="button" data-action="generate">生成我的第一份报纸　→</button>
    </div>
  `;
}
