import { html } from "./html";

export const BRAND_NAME = "知乎趣报";
export const BRAND_SUB = "看山送到的今日一报";
export const KANSHAN_SRC = "/ip/kanshan-postman.png";
export const KANSHAN_AVATAR_SRC = "/ip/kanshan-reader.png";

export function renderNameplate(kind: "mast" | "paper" = "mast"): string {
  return html`
    <div class="nameplate nameplate-${kind}">
      <img class="nameplate-kanshan" src="${KANSHAN_SRC}" alt="" />
      <div>
        <div class="${kind === "paper" ? "brand" : "front-brand"}">${BRAND_NAME}</div>
        <div class="${kind === "paper" ? "brand-sub" : "front-brand-sub"}">${BRAND_SUB}</div>
      </div>
    </div>
  `;
}
