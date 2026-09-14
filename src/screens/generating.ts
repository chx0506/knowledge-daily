import { html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";

export function renderGenerating(state: RuntimeState): string {
  const steps = state.pipeline?.steps ?? [];
  // 对话框每次只显示一条：当前正在进行（或刚完成）的那一步
  const currentIndex = steps.reduce(
    (latest, step, index) => (step.status === "wait" ? latest : index),
    -1,
  );
  const current = currentIndex >= 0 ? steps[currentIndex] : null;
  return html`
    <div class="loading">
      <div class="overline faint">LIU KANSHAN / 看山派送中</div>
      <div class="bubble">
        <div class="steps">
          ${current
            ? (() => {
                const body =
                  current.status === "active"
                    ? '<span class="typing" aria-label="进行中"><i></i><i></i><i></i></span>'
                    : '<span class="msg-check" aria-label="完成">✓</span>';
                return html`
                  <div class="msg ${current.status}">
                    <b>${current.label}</b>
                    ${body}
                  </div>
                `;
              })()
            : ""}
        </div>
        <span class="bubble-tail" aria-hidden="true"></span>
      </div>
      <div class="courier">
        <video
          class="courier-video"
          src="/ip/kanshan-delivery.mp4"
          poster="/ip/kanshan-delivery-poster.png"
          autoplay
          muted
          loop
          playsinline
        ></video>
      </div>
      <p class="quote">“在信息的噪声中，<br />我们为你保留真正重要的内容。”</p>
    </div>
  `;
}
