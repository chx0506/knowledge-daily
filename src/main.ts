/**
 * 扩展入口：
 * - 接知乎数据：实现 ContentProvider，registerProvider()
 * - 换策展算法：实现 CurationPipeline，替换下面的 pipeline
 * - 加页面：见 app/screens.ts
 */
import { createActions } from "@/app/actions";
import { createShell } from "@/app/shell";
import { createStore } from "@/app/store";
import { mockPipeline } from "@/data/pipeline/mock-pipeline";
import { archiveRepo } from "@/data/repositories/archive-repo";
import { editionRepo } from "@/data/repositories/edition-repo";
import { PREFERENCE_KEY, preferenceRepo } from "@/data/repositories/preference-repo";
import "@/styles/tokens.css";
import "@/styles/shell.css";
import "@/styles/newspaper.css";
import "@/styles/screens.css";

async function bootstrap() {
  const [paper, archive] = await Promise.all([editionRepo.getToday(), editionRepo.getArchive()]);
  const profile = preferenceRepo.load();
  const firstVisit = !localStorage.getItem(PREFERENCE_KEY);

  const store = createStore({
    route: firstVisit ? "onboard" : "home",
    homeTab: "recommend",
    domainId: null,
    storyId: null,
    selectedDate: paper.date,
    returnTo: "home",
    archive,
    paper,
    selectedTopics: profile.topics,
    profile,
    pipeline: null,
    seenInterestCards: {},
  });

  const actions = createActions(store, {
    pipeline: mockPipeline,
    preferences: preferenceRepo,
    archive: archiveRepo,
  });

  const shell = createShell({
    screen: document.querySelector("#screen")!,
    app: document.querySelector("#app")!,
    tabs: document.querySelector("#tabs")!,
  });

  shell.bindApp(actions);
  store.subscribe((state) => shell.render(state, actions));
  shell.render(store.get(), actions);
}

void bootstrap();
