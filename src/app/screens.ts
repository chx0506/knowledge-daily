/**
 * 加新页面：
 * 1. 在 domain/types.ts 的 RouteName 加一个名字
 * 2. 在 src/screens/ 新建 renderXxx
 * 3. 在下面 screens 表注册 theme / hideTabs
 * 4. 需要底栏入口时补 tabs
 */
import { mountCalendar, renderCalendar } from "@/screens/calendar";
import { renderCover } from "@/screens/cover";
import { mountDiscover, renderDiscover } from "@/screens/discover";
import { renderDomain } from "@/screens/domain";
import { renderGenerating } from "@/screens/generating";
import { mountHome, renderHome } from "@/screens/home";
import { renderOnboard } from "@/screens/onboard";
import { renderProfile } from "@/screens/profile";
import { tabIcons } from "@/shared/tab-icons";
import type { RouteName, ScreenTheme } from "@/domain/types";
import type { Actions } from "./actions";
import type { RuntimeState } from "./store";

export interface Screen {
  theme: ScreenTheme;
  hideTabs?: boolean;
  render: (state: RuntimeState) => string;
  onMount?: (root: HTMLElement, state: RuntimeState, actions: Actions) => void;
}

export const screens: Record<RouteName, Screen> = {
  home: { theme: "paper", render: renderHome, onMount: mountHome },
  domain: { theme: "paper", hideTabs: true, render: renderDomain },
  calendar: { theme: "paper", render: renderCalendar, onMount: mountCalendar },
  discover: { theme: "paper", render: renderDiscover, onMount: mountDiscover },
  mine: { theme: "paper", render: renderProfile },
  onboard: { theme: "dark", hideTabs: true, render: renderOnboard },
  loading: { theme: "dark", hideTabs: true, render: renderGenerating },
  result: { theme: "cover", hideTabs: true, render: renderCover },
  menu: { theme: "paper", render: renderCalendar, onMount: mountCalendar },
  detail: { theme: "paper", hideTabs: true, render: renderDomain },
  history: { theme: "paper", render: renderCalendar, onMount: mountCalendar },
};

export const tabs: Array<{ route: RouteName; icon: string; label: string }> = [
  { route: "home", icon: tabIcons.home, label: "首页" },
  { route: "discover", icon: tabIcons.discover, label: "发现" },
  { route: "calendar", icon: tabIcons.calendar, label: "日历" },
  { route: "mine", icon: tabIcons.mine, label: "我的" },
];
