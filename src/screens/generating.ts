import { html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";

export function renderGenerating(state: RuntimeState): string {
  const steps = state.pipeline?.steps ?? [];
  return html`
    <div class="loading">
      <div class="overline faint">LIU KANSHAN / 看山派送中</div>
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
      <div class="bubble">
        <span class="bubble-tail" aria-hidden="true"></span>
        <h1>看山正在把<br />知乎趣报送来…</h1>
        <div class="steps">
          ${steps
            .filter((step) => step.status !== "wait")
            .map((step, index) => {
              const no = String(index + 1).padStart(2, "0");
              const body =
                step.status === "active"
                  ? '<span class="typing" aria-label="进行中"><i></i><i></i><i></i></span>'
                  : '<span class="msg-check" aria-label="完成">✓</span>';
              return html`
                <div class="msg ${step.status}">
                  <i>${no}</i>
                  <b>${step.label}</b>
                  ${body}
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
      <p class="quote">“在信息的噪声中，<br />我们为你保留真正重要的内容。”</p>
    </div>
  `;
}
