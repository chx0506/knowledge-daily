import type {
  DailyPaper,
  DomainId,
  InterestVerdict,
  PipelineProgress,
  RouteName,
  UserProfile,
} from "@/domain/types";

export interface RuntimeState {
  route: RouteName;
  homeTab: DomainId;
  domainId: DomainId | null;
  storyId: string | null;
  selectedDate: string;
  returnTo: RouteName;
  archive: DailyPaper[];
  paper: DailyPaper;
  selectedTopics: string[];
  profile: UserProfile;
  pipeline: PipelineProgress | null;
  seenInterestCards: Record<string, InterestVerdict>;
}

type Listener = (state: RuntimeState) => void;
type Patch = Partial<RuntimeState> | ((state: RuntimeState) => Partial<RuntimeState>);

export function createStore(initial: RuntimeState) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    get() {
      return state;
    },
    set(patch: Patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
