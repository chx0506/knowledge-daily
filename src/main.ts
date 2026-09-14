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
import { isSignalOnly } from "@/data/remote/client";
import "@/styles/tokens.css";
import "@/styles/shell.css";
import "@/styles/newspaper.css";
import "@/styles/screens.css";

async function bootstrap() {
  const edition = await remoteEditionRepo.loadToday();
  const archive = archiveRepo.upsert(edition.paper);
  const profile = preferenceRepo.load();
  const firstVisit = !localStorage.getItem(PREFERENCE_KEY);

  const store = createStore({
    route: firstVisit ? "onboard" : "home",
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
    auth: { state: "unknown", oauthReady: false },
    directionOptions: [],
    readingFeedback: {},
    signalOnly: isSignalOnly(),
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

  void actions.checkAuth();
}

void bootstrap();
