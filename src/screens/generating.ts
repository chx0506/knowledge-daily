import { html } from "@/shared/html";
import { KANSHAN_SRC } from "@/shared/brand";
import type { RuntimeState } from "@/app/store";

export function renderGenerating(state: RuntimeState): string {
  const steps = state.pipeline?.steps ?? [];
  return html`
    <div class="loading">
      <div class="overline faint">LIU KANSHAN / 看山派送中</div>
      <figure class="kanshan-seal">
        <img src="${KANSHAN_SRC}" alt="" />
      </figure>
      <h1>看山正在把<br />知乎趣报送来…</h1>
      <div class="steps">
        ${steps
          .map((step, index) => {
            const no = String(index + 1).padStart(2, "0");
            const done = step.status === "done" ? " done" : "";
            const spinner = step.status === "active" ? '<span class="spinner"></span>' : "";
            return html`
              <div class="step${done}">
                <i>${no}</i>
                <b>${step.label}</b>
                <span class="step-detail">${step.detail}</span>
                ${spinner}
              </div>
            `;
          })
          .join("")}
      </div>
      <p class="quote">“在信息的噪声中，<br />我们为你保留真正重要的内容。”</p>
    </div>
  `;
}
