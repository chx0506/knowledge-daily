function stamp(src: string, label: string): string {
  return `<img class="tab-img" src="${src}" alt="${label}" width="48" height="48" draggable="false" />`;
}

export const tabIcons = {
  home: stamp("/nav/nav-home.png", "首页"),
  discover: stamp("/nav/nav-discover.png", "发现"),
  calendar: stamp("/nav/nav-calendar.png", "日历"),
  mine: stamp("/nav/nav-mine.png", "我的"),
} as const;
