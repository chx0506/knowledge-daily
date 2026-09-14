/**
 * 远端版仓库：后端 /api/daily、/api/profile → 前端 DailyPaper / ProfileView。
 * 降级纪律（演示保证 UI 不崩）：
 *  1. ?fixture=1 / localStorage["kd.fixture"]="1" → 直接用真实采样 fixture；
 *  2. 后端不可达 / 超时 / 5xx / 429 → 回退同一份 fixture，并打 fixture 提示条；
 *  3. 后端返回 stale:true（配额耗尽给了上一期缓存）→ 正常展示 + stale 提示条。
 */
import { api, isFixtureForced, isSignalOnly } from "@/data/remote/client";
import { DAILY_FIXTURE } from "@/data/remote/fixtures/daily.fixture";
import { PROFILE_FIXTURE } from "@/data/remote/fixtures/profile.fixture";
import { mapDailyToPaper, mapDossierToView, mapProfileToView } from "@/data/remote/map";
import type { RemoteDaily, RemoteTopicDossier } from "@/data/remote/types";
import type { DailyPaper, DossierView, ProfileView } from "@/domain/types";

export interface RemoteEdition {
  paper: DailyPaper;
  profileView: ProfileView;
}

const OFFLINE_NOTE = "后端暂不可达，正在展示最近一次真实生成的离线样例。";
const FIXTURE_NOTE = "fixture 模式：展示真实采样数据（?fixture=0 退出）。";

/** 每期向后台要的领域数（后台 10 领域目录，要 8 个，留 2 个 skipped 展示降级）。 */
const DAILY_DOMAIN_COUNT = 8;

function fixtureEdition(): RemoteEdition {
  const paper = mapDailyToPaper(DAILY_FIXTURE, "fixture");
  paper.warnings = [isFixtureForced() ? FIXTURE_NOTE : OFFLINE_NOTE, ...(paper.warnings ?? [])];
  return { paper, profileView: mapProfileToView(PROFILE_FIXTURE) };
}

function liveEdition(daily: RemoteDaily): RemoteEdition {
  const paper = mapDailyToPaper(daily, daily.stale ? "stale" : "live");
  return { paper, profileView: mapProfileToView(daily.profile) };
}

export const remoteEditionRepo = {
  /** 今日一报 + 画像。永远 resolve，失败时落到 fixture。 */
  async loadToday(options: { timeoutMs?: number } = {}): Promise<RemoteEdition> {
    if (isFixtureForced()) return fixtureEdition();
    try {
      // 「只看我的方向」开 → blind=0（signal_only）；关 → 不带参数（后台缺省补盲开）。
      const daily = await api.daily(
        { domains: DAILY_DOMAIN_COUNT, ...(isSignalOnly() ? { blind: false } : {}) },
        options.timeoutMs ?? 90000,
      );
      return liveEdition(daily);
    } catch (err) {
      console.warn("[knowledge-daily] /api/daily 不可用，回退 fixture：", err);
      return fixtureEdition();
    }
  },

  /** 强制重生成（POST /api/daily/regenerate），失败时保持现状并回报错误。 */
  async regenerate(): Promise<RemoteEdition> {
    if (isFixtureForced()) return fixtureEdition();
    const daily = await api.regenerateDaily({
      domains: DAILY_DOMAIN_COUNT,
      ...(isSignalOnly() ? { blind: false } : {}),
    });
    return liveEdition(daily);
  },

  async loadProfile(): Promise<ProfileView> {
    if (isFixtureForced()) return mapProfileToView(PROFILE_FIXTURE);
    try {
      return mapProfileToView(await api.profile());
    } catch (err) {
      console.warn("[knowledge-daily] /api/profile 不可用，回退 fixture：", err);
      return mapProfileToView(PROFILE_FIXTURE);
    }
  },

  /** 学习方向读写：先读出旧值合并，避免覆盖 keywords/goal/blocked。 */
  async saveDirections(directions: string[]): Promise<void> {
    if (isFixtureForced()) return;
    try {
      const current = await api.getPreferences().catch(() => null);
      await api.savePreferences({
        directions,
        keywords: current?.preferences.keywords ?? [],
        goal: current?.preferences.goal ?? "",
        blocked: current?.preferences.blocked ?? [],
      });
    } catch (err) {
      console.warn("[knowledge-daily] 学习方向保存失败（不影响本地偏好）：", err);
    }
  },

  async loadDirectionOptions(): Promise<string[]> {
    if (isFixtureForced()) return PROFILE_FIXTURE.cold_start_options ?? [];
    try {
      const res = await api.getPreferences();
      return res.options ?? [];
    } catch {
      return PROFILE_FIXTURE.cold_start_options ?? [];
    }
  },

  /** 主动策展（/api/topic/:topic）。fixture 模式用真实日报样例合成一份专题。 */
  async curateTopic(topic: string): Promise<DossierView> {
    if (isFixtureForced()) {
      const base = DAILY_FIXTURE.domains[0];
      const synthesized: RemoteTopicDossier = {
        ...base,
        type: "topic_dossier",
        topic,
        name: topic,
        generated_at: Math.floor(Date.now() / 1000),
        warnings: [FIXTURE_NOTE],
      };
      return mapDossierToView(synthesized);
    }
    return mapDossierToView(await api.topic(topic));
  },
};
