import type {
  AuthView,
  DailyPaper,
  DomainId,
  DossierView,
  InterestVerdict,
  PipelineProgress,
  ProfileView,
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
  /** 后端画像视图（/api/profile 映射），未加载时为 null。 */
  profileView: ProfileView | null;
  /** 主动策展结果（/api/topic/:topic），发现页消费。 */
  dossier: { state: "idle" | "loading" | "error"; topic: string; view: DossierView | null };
  /** 知乎登录状态（/api/auth/me + /api/health）。 */
  auth: AuthView;
  /** 后端可选的学习方向预设标签（cold_start_options）。 */
  directionOptions: string[];
  /** 已提交给 /api/feedback 的阅读反馈：source_id → feedback。 */
  readingFeedback: Record<string, string>;
  /** 「只看我的方向」开关：开 → daily/regenerate 带 blind=0（localStorage kd.signalOnly 持久化）。 */
  signalOnly: boolean;
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
