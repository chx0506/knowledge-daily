import { screens, tabs } from "./screens";
import type { Actions } from "./actions";
import type { RuntimeState } from "./store";
import type { DomainId, RouteName } from "@/domain/types";

export function createShell(root: {
  screen: HTMLElement;
  app: HTMLElement;
  tabs: HTMLElement;
}) {
  let currentRoute = "";

  function renderTabs(state: RuntimeState, actions: Actions) {
    const buttons = tabs.map((tab) => {
      const active = tab.route === state.route ? " active" : "";
      return `<button class="tab${active}" type="button" data-go="${tab.route}"><span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span></button>`;
    });
    const onMap = state.route === "map";
    const pose = onMap ? "/nav/nav-kanshan-tilt.png" : "/nav/nav-kanshan.png";
    buttons.splice(
      2,
      0,
      `<button class="tab-mascot${onMap ? " is-on" : ""}" type="button" data-go="map" aria-label="看山地图"><img src="${pose}" alt="" width="80" height="64" draggable="false" /></button>`,
    );
    root.tabs.innerHTML = buttons.join("");

    root.tabs.onclick = (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-go]");
      if (!target) return;
      actions.go(target.dataset.go as RouteName);
    };
  }

  function bindApp(actions: Actions) {
    root.app.onclick = (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-go],[data-action]");
      if (!target) return;

      const action = target.dataset.action;
      if (action === "toggle-topic" && target.dataset.topic) {
        actions.toggleTopic(target.dataset.topic);
        return;
      }
      if (action === "set-brief" && (target.dataset.brief === "short" || target.dataset.brief === "full")) {
        actions.setBriefLength(target.dataset.brief);
        return;
      }
      if (action === "toggle-pref" && (target.dataset.pref === "morningPush" || target.dataset.pref === "weekendSkip")) {
        actions.togglePref(target.dataset.pref);
        return;
      }
      if (action === "skip-onboard") {
        actions.skipOnboard();
        return;
      }
      if (action === "skip-signin") {
        actions.skipSignin();
        return;
      }
      if (action === "generate") {
        void actions.generate();
        return;
      }
      if (action === "open-source") {
        const url = target.dataset.url;
        if (url) window.open(url, "_blank", "noopener");
        return;
      }
      if (action === "select-home-tab" && target.dataset.domainId) {
        actions.selectHomeTab(target.dataset.domainId as DomainId);
        return;
      }
      if (action === "open-domain") {
        actions.openDomain(
          (target.dataset.domainId as DomainId) ?? "tech",
          target.dataset.storyId ?? null,
          (target.dataset.from as RouteName) ?? "home",
        );
        return;
      }
      if (action === "back-domain") {
        actions.backFromDomain();
        return;
      }
      if (action === "select-date" && target.dataset.date) {
        actions.selectDate(target.dataset.date);
        return;
      }
      if (action === "go-today") {
        actions.goToday();
        return;
      }
      if (action === "judge-interest" && target.dataset.cardId && target.dataset.verdict) {
        actions.judgeInterest(target.dataset.cardId, target.dataset.verdict as "like" | "pass");
        return;
      }
      if (action === "reset-discover") {
        actions.resetDiscover();
        return;
      }
      if (action === "send-feedback" && target.dataset.cardId && target.dataset.feedback) {
        actions.sendReadingFeedback(
          target.dataset.cardId,
          target.dataset.topic ?? "",
          target.dataset.feedback as Parameters<typeof actions.sendReadingFeedback>[2],
        );
        return;
      }
      if (action === "toggle-direction" && target.dataset.topic) {
        actions.toggleDirection(target.dataset.topic);
        return;
      }
      if (action === "login") {
        actions.login();
        return;
      }
      if (target.dataset.go) {
        actions.go(target.dataset.go as RouteName);
      }
    };
  }

  return {
    bindApp,
    render(state: RuntimeState, actions: Actions) {
      const screen = screens[state.route];
      const routeChanged = currentRoute !== state.route;
      currentRoute = state.route;

      root.screen.classList.toggle("dark", screen.theme === "dark");
      root.screen.classList.toggle("cover", screen.theme === "cover");
      root.tabs.hidden = Boolean(screen.hideTabs);
      root.app.classList.toggle("full", Boolean(screen.hideTabs));
      root.app.innerHTML = screen.render(state);
      if (routeChanged) root.app.scrollTop = 0;
      screen.onMount?.(root.app, state, actions);
      renderTabs(state, actions);
    },
  };
}
