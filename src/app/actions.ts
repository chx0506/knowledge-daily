import { findInterestCard } from "@/data/mock/interest-cards";
import { HOME_TABS, findDomainBlock } from "@/domain/catalog";
import type { CurationPipeline } from "@/data/pipeline/types";
import type { ArchiveRepo } from "@/data/repositories/archive-repo";
import type { PreferenceRepo } from "@/data/repositories/preference-repo";
import type { BriefLength, DailyPaper, DomainId, InterestVerdict, RouteName, UserProfile } from "@/domain/types";
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

export function createActions(
  store: Store,
  deps: { pipeline: CurationPipeline; preferences: PreferenceRepo; archive: ArchiveRepo },
) {
  return {
    go(route: RouteName) {
      store.set({ route, returnTo: route === "domain" ? store.get().returnTo : route });
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

    judgeInterest(cardId: string, verdict: InterestVerdict) {
      const { seenInterestCards, selectedTopics, profile } = store.get();
      if (seenInterestCards[cardId]) return;

      const seen = { ...seenInterestCards, [cardId]: verdict };
      if (verdict !== "like") {
        store.set({ seenInterestCards: seen });
        return;
      }

      const card = findInterestCard(cardId);
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

    async generate() {
      const { selectedTopics } = store.get();
      store.set({
        route: "loading",
        pipeline: {
          steps: [
            { id: "recall", label: "收集全球资讯", status: "wait", detail: "等待中…" },
            { id: "theme", label: "识别主题与分类", status: "wait", detail: "等待中…" },
            { id: "dedupe", label: "合并相似内容", status: "wait", detail: "等待中…" },
            { id: "summary", label: "生成摘要", status: "wait", detail: "等待中…" },
            { id: "layout", label: "编辑排版", status: "wait", detail: "等待中…" },
          ],
        },
      });

      const paper = await deps.pipeline.run({ topics: selectedTopics, keywords: [] }, (pipeline) => {
        store.set({ pipeline });
      });

      const archive = deps.archive.upsert(paper);
      store.set({
        paper,
        archive,
        selectedDate: paper.date,
        route: "result",
        pipeline: null,
      });
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
