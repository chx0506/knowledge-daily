import { html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";

/**
 * 知乎账号登录门禁（首屏）。
 *
 * 定位：OAuth 就绪且未登录时，应用的第一屏就是这里——把「用知乎账号登录」
 * 放到最开始，而不是埋在「我的」里。点击后跳转知乎授权页。
 *
 * 不打门禁的两种情况（由 main.ts 判定，不在此屏内处理）：
 *   - 后端未配置 OAuth（oauthReady=false）：按 PRD，以赛事 Access Secret 取数，
 *     登录入口不开放，产品照常演示；
 *   - 强制 fixture 离线模式（?fixture=1）：演示保证「关后端也能走完全流程」。
 *
 * 样式复用 .onboard / .generate，不新增 CSS。
 */
export function renderSignin(state: RuntimeState): string {
  const { auth } = state;
  const offline = auth.state === "unknown";

  if (offline) {
    return html`
      <div class="onboard signin">
        <h1>暂时连不上后端</h1>
        <p>登录需要后端在线。请稍后重试，或先跳过直接浏览。</p>
        <button class="generate" type="button" data-action="skip-signin">先浏览报纸　→</button>
      </div>
    `;
  }

  return html`
    <div class="onboard signin">
      <h1>每天一份，<br />看山送到的报纸。</h1>
      <p>
        用知乎账号登录，这一期就按<strong>你自己的</strong>关注、收藏和创作来编，
        而不是公共样本。
      </p>
      <p>
        登录后可以随时在「我的」里退出。我们不会代替你发布任何内容。
      </p>
      <button class="generate" type="button" data-action="login">用知乎账号登录　→</button>
    </div>
  `;
}
