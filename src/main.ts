/**
 * 数据接通说明：
 * - 今日一报 / 画像：remote-edition-repo（/api/daily、/api/profile，schema 4.0）
 *   后端不可达、超时、429 或 ?fixture=1 时，自动回退到 src/data/remote/fixtures 里的真实采样。
 * - 本地 mock（mock-pipeline / providers / interest-cards）保留作降级与发现页牌堆，不再驱动首页。
 * - 加页面：见 app/screens.ts
 */
import { createActions } from "@/app/actions";
import { createShell } from "@/app/shell";
import { createStore } from "@/app/store";
import { mountWidgetShowcase } from "@/app/widget-showcase";
import { archiveRepo } from "@/data/repositories/archive-repo";
import { PREFERENCE_KEY, preferenceRepo } from "@/data/repositories/preference-repo";
import { remoteEditionRepo } from "@/data/repositories/remote-edition-repo";
import { isFixtureForced, api } from "@/data/remote/client";
import type { AuthView, RouteName } from "@/domain/types";
import "@/styles/tokens.css";
import "@/styles/shell.css";
import "@/styles/newspaper.css";
import "@/styles/screens.css";

/**
 * 探测登录态。与取报纸并行执行，不额外增加首屏等待。
 *
 * 与 actions.checkAuth() 同源同语义；这里单独放一份是为了能在
 * 「首次渲染之前」拿到结果——否则会先画出首页再被弹到登录页（闪现）。
 */
async function probeAuth(): Promise<AuthView> {
  if (isFixtureForced()) return { state: "out", oauthReady: true };
  try {
    const [me, health] = await Promise.all([api.authMe(), api.health()]);
    const oauthReady = health.capabilities?.oauth_login !== false;
    return me.logged_in
      ? { state: "in", name: me.user?.fullname ?? "知乎用户", oauthReady }
      : { state: "out", oauthReady };
  } catch {
    return { state: "unknown", oauthReady: false };
  }
}

async function bootstrap() {
  // 取报纸与探登录态并行 —— 登录门禁需要后者，但不能因此推迟首屏。
  const [edition, auth] = await Promise.all([
    remoteEditionRepo.loadToday(),
    probeAuth(),
  ]);
  const archive = archiveRepo.upsert(edition.paper);
  const profile = preferenceRepo.load();
  const firstVisit = !localStorage.getItem(PREFERENCE_KEY);

  // ---- 知乎账号登录门禁（放在最开始的登录界面）----
  // OAuth 就绪且未登录 → 首屏直接是登录页，授权后由后端回调回到本站。
  // 两种不打门禁的情况（正常进入产品，符合 PRD 的降级约定）：
  //   1) 后端未配置 OAuth：以赛事 Access Secret 取数，登录入口不开放；
  //   2) 强制 fixture 离线模式：演示保证「关后端也能走完全流程」。
  const gated = auth.oauthReady && auth.state === "out" && !isFixtureForced();
  const initialRoute: RouteName = gated ? "signin" : firstVisit ? "onboard" : "home";

  const store = createStore({
    route: initialRoute,
    homeTab: "recommend",
    domainId: null,
    storyId: null,
    selectedDate: edition.paper.date,
    returnTo: "home",
    archive,
    paper: edition.paper,
    selectedTopics: profile.topics,
    profile,
    pipeline: null,
    seenInterestCards: {},
    profileView: edition.profileView,
    dossier: { state: "idle", topic: "", view: null },
    auth,
    directionOptions: [],
    readingFeedback: {},
  });

  const actions = createActions(store, {
    preferences: preferenceRepo,
    archive: archiveRepo,
    remote: remoteEditionRepo,
  });

  const shell = createShell({
    screen: document.querySelector("#screen")!,
    app: document.querySelector("#app")!,
    tabs: document.querySelector("#tabs")!,
  });

  shell.bindApp(actions);
  store.subscribe((state) => shell.render(state, actions));
  shell.render(store.get(), actions);

  const widgetSlot = document.querySelector<HTMLElement>("#widget-showcase");
  if (widgetSlot) {
    mountWidgetShowcase(widgetSlot, store);
  }
}

void bootstrap();
