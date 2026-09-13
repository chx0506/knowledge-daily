import { DEFAULT_TOPICS, defaultProfile } from "@/data/mock/fixtures";
import type { UserProfile } from "@/domain/types";

export const PREFERENCE_KEY = "kd.preferences";
const KEY = PREFERENCE_KEY;

export interface PreferenceRepo {
  load(): UserProfile;
  save(profile: UserProfile): void;
}

export const preferenceRepo: PreferenceRepo = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaultProfile, topics: [...DEFAULT_TOPICS] };
      return { ...defaultProfile, ...JSON.parse(raw) } as UserProfile;
    } catch {
      return { ...defaultProfile, topics: [...DEFAULT_TOPICS] };
    }
  },
  save(profile: UserProfile) {
    localStorage.setItem(KEY, JSON.stringify(profile));
  },
};
