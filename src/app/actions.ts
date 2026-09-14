import { AUTH_LOGIN_URL, api, isFixtureForced } from "@/data/remote/client";
import { findInterestCard } from "@/data/mock/interest-cards";
import { HOME_TABS, findDomainBlock } from "@/domain/catalog";
import { stamp, startTyping, stopTyping } from "@/shared/typewriter-sound";
import type { RemoteEdition } from "@/data/repositories/remote-edition-repo";
import type { ArchiveRepo } from "@/data/repositories/archive-repo";
import type { PreferenceRepo } from "@/data/repositories/preference-repo";
import type { RemoteFeedback } from "@/data/remote/types";
import type {
  BriefLength,
  DailyPaper,
  DomainId,
  DossierView,
  InterestVerdict,
  PipelineStep,
  ProfileView,
  RouteName,
  UserProfile,
} from "@/domain/types";
import type { RuntimeState, Store } from "./store";

function editionOf(state: RuntimeState): DailyPaper {
  if (state.route === "calendar") {
    return state.archive.find((item) => item.date === state.selectedDate) ?? state.paper;
  }
  return state.paper;
}

function storyForTab(paper: DailyPaper, domainId: DomainId) {
  return domainId === "recommend" ? paper.hero.storyId : findDomainBlock(paper, domainId).lead.id;
}

const TOPIC_LIMIT = 10;

/** 远端依赖：由 remote-edition-repo 实现，mock/fixture 行为收敛在仓库层。 */
export interface RemoteDeps {
  regenerate(): Promise<RemoteEdition>;
  loadProfile(): Promise<ProfileView>;
  loadDirectionOptions(): Promise<string[]>;
  saveDirections(directions: string[]): Promise<void>;
  curateTopic(topic: string): Promise<DossierView>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** 出报 loading 的步骤文案，对齐后端真实流程（信号 → 召回 → 直答 → 校验）。 */
const REMOTE_STEP_DEFS = [
  { id: "profile", label: "读取你的知乎信号", ms: 420 },
  { id: "recall", label: "召回知乎内容", ms: 720 },
  { id: "curate", label: "直答生成领域调研", ms: 940 },
  { id: "verify", label: "校验引用与排版", ms: 420 },
];

export function createActions(
  store: Store,
  deps: { preferences: PreferenceRepo; archive: ArchiveRepo; remote: RemoteDeps },
) {
  return {
    go(route: RouteName) {
      store.set({ route, returnTo: route === "domain" ? store.get().returnTo : route });
      if (route === "mine") void this.refreshProfileExtras();
    },

    selectHomeTab(domainId: DomainId) {
      const state = store.get();
      if (!HOME_TABS.includes(domainId) || state.homeTab === domainId) return;
      store.set({
        homeTab: domainId,
        domainId: domainId === "recommend" ? null : domainId,
        storyId: storyForTab(editionOf(state), domainId),
      });
    },

    openHomeStory(domainId: DomainId, storyId: string | null) {
      if (!HOME_TABS.includes(domainId)) {
        store.set({
          route: "domain",
          domainId,
          storyId,
          returnTo: "home",
        });
        return;
      }
      store.set({
        route: "home",
        homeTab: domainId,
        domainId: domainId === "recommend" ? null : domainId,
        storyId,
      });
    },

    openDomain(domainId: DomainId, storyId: string | null, from: RouteName = "home") {
      if (from === "home" || from === "calendar") {
        store.set({
          route: from,
          homeTab: domainId === "recommend" ? "recommend" : domainId,
          domainId: domainId === "recommend" ? null : domainId,
          storyId,
        });
        return;
      }
      store.set({
        route: "domain",
        domainId,
        storyId,
        returnTo: from,
      });
    },

    backFromDomain() {
      const { returnTo } = store.get();
      store.set({ route: returnTo === "domain" ? "home" : returnTo });
    },

    selectDate(date: string) {
      const state = store.get();
      const paper = state.archive.find((item) => item.date === date);
      store.set({
        selectedDate: date,
        route: "calendar",
        storyId: paper ? storyForTab(paper, state.homeTab) : state.storyId,
        domainId: state.homeTab === "recommend" ? null : state.homeTab,
      });
    },

    goToday() {
      this.selectDate(store.get().paper.date);
    },

    skipOnboard() {
      const { profile } = store.get();
      deps.preferences.save(profile);
      store.set({ route: "home" });
    },

    /** 登录页在「后端暂不可达」分支下的兜底出口：先让人看到报纸。 */
    skipSignin() {
      store.set({ route: "home" });
    },

    judgeInterest(cardId: string, verdict: InterestVerdict) {
      const { seenInterestCards, selectedTopics, profile } = store.get();
      if (seenInterestCards[cardId]) return;

      const seen = { ...seenInterestCards, [cardId]: verdict };

      // 兴趣卡的喜欢/不感兴趣 → /api/feedback（失败静默，不挡本地流程）
      const card = findInterestCard(cardId);
      if (!isFixtureForced()) {
        void api
          .feedback(cardId, card?.topics[0] ?? "", verdict === "like" ? "interested" : "irrelevant")
          .catch((err) => console.warn("[knowledge-daily] 兴趣卡反馈未送达：", err));
      }

      if (verdict !== "like") {
        store.set({ seenInterestCards: seen });
        return;
      }

      const nextTopics = [...selectedTopics];
      for (const topic of card?.topics ?? []) {
        if (!nextTopics.includes(topic) && nextTopics.length < TOPIC_LIMIT) {
          nextTopics.push(topic);
        }
      }
      const nextProfile = { ...profile, topics: nextTopics };
      deps.preferences.save(nextProfile);
      store.set({ seenInterestCards: seen, selectedTopics: nextTopics, profile: nextProfile });
    },

    resetDiscover() {
      store.set({ seenInterestCards: {} });
    },

    toggleTopic(topic: string) {
      const { selectedTopics, profile } = store.get();
      const exists = selectedTopics.includes(topic);
      if (!exists && selectedTopics.length >= TOPIC_LIMIT) return;

      const nextTopics = exists
        ? selectedTopics.filter((item) => item !== topic)
        : [...selectedTopics, topic];
      const nextProfile = { ...profile, topics: nextTopics };
      deps.preferences.save(nextProfile);
      store.set({ selectedTopics: nextTopics, profile: nextProfile });
    },

    setBriefLength(briefLength: BriefLength) {
      this.patchProfile({ briefLength });
    },

    togglePref(key: "morningPush" | "weekendSkip") {
      const { profile } = store.get();
      this.patchProfile({ [key]: !profile[key] });
    },

    patchProfile(patch: Partial<UserProfile>) {
      const { profile } = store.get();
      const nextProfile = { ...profile, ...patch };
      deps.preferences.save(nextProfile);
      store.set({ profile: nextProfile });
    },

    /* ---------- 后端画像 / 学习方向 ---------- */

    /** 进入「我的」时拉一次 /api/profile + preferences 选项（已加载过则跳过）。 */
    async refreshProfileExtras(force = false) {
      const state = store.get();
      if (!force && state.profileView && state.directionOptions.length) return;
      const [profileView, directionOptions] = await Promise.all([
        deps.remote.loadProfile(),
        deps.remote.loadDirectionOptions(),
      ]);
      store.set({ profileView, directionOptions });
    },

    /** 学习方向 chips：乐观更新 + POST /api/profile/preferences。 */
    toggleDirection(direction: string) {
      const { profileView } = store.get();
      if (!profileView) return;
      const exists = profileView.directions.includes(direction);
      const directions = exists
        ? profileView.directions.filter((item) => item !== direction)
        : [...profileView.directions, direction].slice(0, TOPIC_LIMIT);
      store.set({ profileView: { ...profileView, directions } });
      void deps.remote.saveDirections(directions);
    },

    /* ---------- 阅读反馈（/api/feedback） ---------- */

    sendReadingFeedback(cardId: string, topic: string, feedback: RemoteFeedback) {
      const { readingFeedback } = store.get();
      if (readingFeedback[cardId]) return;
      store.set({ readingFeedback: { ...readingFeedback, [cardId]: feedback } });
      if (isFixtureForced()) return;
      void api
        .feedback(cardId, topic, feedback)
        .catch((err) => console.warn("[knowledge-daily] 阅读反馈未送达：", err));
    },

    /* ---------- 主动策展（/api/topic/:topic） ---------- */

    async curateTopic(rawTopic: string) {
      const topic = rawTopic.trim();
      if (!topic || store.get().dossier.state === "loading") return;
      store.set({ dossier: { state: "loading", topic, view: null } });
      try {
        const view = await deps.remote.curateTopic(topic);
        store.set({ dossier: { state: "idle", topic, view } });
      } catch (err) {
        console.warn("[knowledge-daily] 专题策展失败：", err);
        store.set({ dossier: { state: "error", topic, view: null } });
      }
    },

    /* ---------- 知乎登录（/api/auth/*） ---------- */

    async checkAuth() {
      if (isFixtureForced()) {
        store.set({ auth: { state: "out", oauthReady: true } });
        return;
      }
      try {
        const [me, health] = await Promise.all([api.authMe(), api.health()]);
        const oauthReady = health.capabilities?.oauth_login !== false;
        store.set({
          auth: me.logged_in
            ? { state: "in", name: me.user?.fullname ?? "知乎用户", oauthReady }
            : { state: "out", oauthReady },
        });
      } catch {
        store.set({ auth: { state: "unknown", oauthReady: false } });
      }
    },

    login() {
      const { auth } = store.get();
      if (!auth.oauthReady) return;
      window.location.href = AUTH_LOGIN_URL;
    },

    /* ---------- 出报（/api/daily/regenerate） ---------- */

    async generate() {
      const { selectedTopics } = store.get();
      // 学习方向是高置信度信号，出报前同步给后端（失败不阻塞）。
      void deps.remote.saveDirections(selectedTopics);

      const steps: PipelineStep[] = REMOTE_STEP_DEFS.map((step, index) => ({
        id: step.id,
        label: step.label,
        status: index === 0 ? "active" : "wait",
        detail: index === 0 ? "进行中…" : "等待中…",
      }));
      const emit = () => store.set({ pipeline: { steps: steps.map((step) => ({ ...step })) } });
      store.set({ route: "loading", pipeline: { steps } });
      emit();

      const request: Promise<RemoteEdition | Error> = deps.remote
        .regenerate()
        .catch((err: unknown) => (err instanceof Error ? err : new Error(String(err))));
      const animate = (async () => {
        for (let i = 0; i < REMOTE_STEP_DEFS.length; i += 1) {
          steps[i].status = "active";
          steps[i].detail = "进行中…";
          emit();
          startTyping();
          await wait(REMOTE_STEP_DEFS[i].ms);
          stopTyping();
          stamp();
          steps[i].status = "done";
          steps[i].detail = "完成";
          emit();
        }
      })();

      const [edition] = await Promise.all([request, animate]);
      if (edition instanceof Error) {
        console.warn("[knowledge-daily] 重新生成失败：", edition);
        const { paper } = store.get();
        store.set({
          route: "home",
          pipeline: null,
          paper: {
            ...paper,
            warnings: ["重新生成失败（可能额度耗尽或后端不可达），仍展示当前一期。", ...(paper.warnings ?? [])],
          },
        });
        return;
      }

      const archive = deps.archive.upsert(edition.paper);
      store.set({
        paper: edition.paper,
        archive,
        profileView: edition.profileView,
        selectedDate: edition.paper.date,
        route: "result",
        pipeline: null,
      });
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
