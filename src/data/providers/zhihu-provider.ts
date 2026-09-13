import type { InterestProfile } from "@/domain/types";
import type { ContentProvider } from "./types";

/** 后续接知乎开放平台时，只替换这个文件的实现。 */
export const zhihuProvider: ContentProvider = {
  id: "zhihu",
  async recall(_profile: InterestProfile) {
    throw new Error("zhihu provider is not wired yet");
  },
};
