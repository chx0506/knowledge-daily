import { INTEREST_CARDS } from "@/data/mock/interest-cards";
import {
  distanceKm,
  findMapNetwork,
  findMapPerson,
  greatCircle,
  peopleInNetwork,
  portraitForMe,
  type MapPerson,
} from "@/data/mock/map-people";
import { escapeHtml, html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";
import { LngLatBounds, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const DEFAULT_STAMP = "photo";

const STAMPS = [
  { id: "photo", label: "摄影", src: "/map/stamps/stamp-photo.png" },
  { id: "outdoor", label: "户外", src: "/map/stamps/stamp-outdoor.png" },
  { id: "coffee", label: "咖啡", src: "/map/stamps/stamp-coffee.png" },
  { id: "reading", label: "阅读", src: "/map/stamps/stamp-reading.png" },
  { id: "game", label: "游戏", src: "/map/stamps/stamp-game.png" },
  { id: "more", label: "收集更多兴趣", src: "/map/stamps/stamp-more.png" },
] as const;

const AMAP_TILES = [1, 2, 3, 4].map(
  (n) =>
    `https://webrd0${n}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`,
);

const STREET_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    world: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "Esri, TomTom, FAO, NOAA, USGS",
      maxzoom: 19,
    },
    streets: {
      type: "raster",
      tiles: AMAP_TILES,
      tileSize: 256,
      attribution: "© 高德地图",
      minzoom: 3,
      maxzoom: 18,
    },
  },
  layers: [
    { id: "world", type: "raster", source: "world" },
    { id: "streets", type: "raster", source: "streets" },
  ],
};

let liveMap: MapLibreMap | null = null;
let liveMarkers: Marker[] = [];

function iconSvg(name: string): string {
  const icons: Record<string, string> = {
    camera:
      '<rect x="3" y="6" width="14" height="11" rx="2"/><circle cx="10" cy="11.5" r="3"/><path d="M7 6 8.2 3.8h3.6L13 6"/>',
    mountain: '<path d="M2 16 7.5 6l3.2 5.6L13 8.2 18 16Z"/><path d="M9 16 12 11l3 5"/>',
    coffee:
      '<path d="M5 7h9v6.5A3.5 3.5 0 0 1 10.5 17H9A3.5 3.5 0 0 1 5 13.5Z"/><path d="M14 8.5h2.2A2.3 2.3 0 0 1 16 13h-2"/><path d="M7 19h6"/>',
    music: '<path d="M8 15.5a2.5 2.5 0 1 1-1-.2V6.5l9-2v8.7a2.5 2.5 0 1 1-1-.2V6.2L8 8Z"/>',
    book: '<path d="M4 5.5h5.2A3 3 0 0 1 12 7v10.2A3.4 3.4 0 0 0 9.2 16H4Z"/><path d="M16 5.5h-5.2A3 3 0 0 0 8 7v10.2A3.4 3.4 0 0 1 10.8 16H16Z"/>',
    plane:
      '<path d="M3 11.2 17.5 4.2l-2.8 12.2-3.4-3.6-2.6 4.8-.9-3.4L3 11.2Z"/>',
    chart: '<path d="M3 16V8"/><path d="M8 16V5"/><path d="M13 16v-6"/><path d="M18 16V7"/>',
    scale: '<path d="M10 3v14"/><path d="M6 17h8"/><path d="M10 6 4.5 12h5.2Z"/><path d="M10 6 15.5 12H10.3Z"/>',
    wallet: '<rect x="3" y="6" width="14" height="10" rx="2"/><path d="M3 9h14"/><circle cx="14" cy="13" r="1"/>',
    bike: '<circle cx="5.5" cy="14" r="3"/><circle cx="14.5" cy="14" r="3"/><path d="M5.5 14 9 7.5h3.5M9 14l3.2-6.5 3.3 6.5"/>',
    game: '<rect x="2.5" y="6" width="15" height="9" rx="3"/><path d="M7 9v4M5 11h4"/><circle cx="13" cy="10" r=".8"/><circle cx="15" cy="12" r=".8"/>',
    pen: '<path d="M12.5 3.8 16.2 7.5 8 15.7 4 16.8l1.1-4Z"/><path d="M11.2 5.1 14.9 8.8"/>',
    flask: '<path d="M8 3h4M9 3v5.2L5.2 16.5A2.4 2.4 0 0 0 7.3 20h5.4a2.4 2.4 0 0 0 2.1-3.5L11 8.2V3"/>',
    city: '<path d="M3 17V9l4-2 3 2v8M10 17V6l4-2 3 2v11M3 17h14"/>',
    sleep: '<path d="M4 14.5A5 5 0 0 0 14.8 12 4.2 4.2 0 0 1 11 17.5H6.2A2.2 2.2 0 0 1 4 15.3Z"/>',
    spark: '<path d="M10 3.5 11.4 8 16 9.2 11.4 10.5 10 15 8.6 10.5 4 9.2 8.6 8Z"/>',
  };
  const d = icons[name] ?? icons.spark;
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${d}</svg>`;
}

function interestIcon(label: string): string {
  if (/摄|相|取景/.test(label)) return iconSvg("camera");
  if (/户|山|野|外/.test(label)) return iconSvg("mountain");
  if (/咖|茶/.test(label)) return iconSvg("coffee");
  if (/音|乐/.test(label)) return iconSvg("music");
  if (/读|书|刊|论文/.test(label)) return iconSvg("book");
  if (/旅|飞/.test(label)) return iconSvg("plane");
  if (/财|报|股|宏观|利率/.test(label)) return iconSvg("chart");
  if (/政策|对照/.test(label)) return iconSvg("scale");
  if (/账|理财|家庭/.test(label)) return iconSvg("wallet");
  if (/骑|车|通勤/.test(label)) return iconSvg("bike");
  if (/游|版本|规则|玩家/.test(label)) return iconSvg("game");
  if (/写|译|访|记/.test(label)) return iconSvg("pen");
  if (/科|实验/.test(label)) return iconSvg("flask");
  if (/城|店|招牌|街/.test(label)) return iconSvg("city");
  if (/睡|作息/.test(label)) return iconSvg("sleep");
  return iconSvg("spark");
}

function formatDistance(person: MapPerson): string {
  if (person.kind === "me") return "就在这里";
  const me = findMapPerson("me");
  if (!me) return person.place;
  const km = distanceKm(me, person);
  if (km <= 0) return "就在这里";
  return `距离你 ${km.toLocaleString("en-US")} 公里`;
}

function genderMark(gender: MapPerson["gender"]): string {
  if (gender === "female") return '<i class="is-female">♀</i>';
  if (gender === "male") return '<i class="is-male">♂</i>';
  return "";
}

function seal(label: string, en: string): string {
  const title = label.length > 2 ? `${label.slice(0, 2)}<br>${label.slice(2)}` : label;
  return `<div class="map-postcard-seal"><b>${title}</b><small>${en}</small></div>`;
}

function renderDossier(person: MapPerson): string {
  return html`
    <button class="map-dossier-scrim" type="button" data-dossier-close aria-label="关闭画像"></button>
    <div class="map-postcard-wrap">
    <button class="map-postcard-x" type="button" data-dossier-close aria-label="关闭">×</button>
    <article class="map-postcard">
      <div class="map-postcard-airmail" aria-hidden="true"></div>
      <div class="map-postcard-head">
        <div class="map-postcard-marks" aria-hidden="true">
          <svg viewBox="0 0 86 118" fill="none">
            <defs>
              <filter id="postcard-ink" x="-18%" y="-18%" width="136%" height="136%">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n"/>
                <feDisplacementMap in="SourceGraphic" in2="n" scale="0.7" xChannelSelector="R" yChannelSelector="G"/>
              </filter>
            </defs>
            <g filter="url(#postcard-ink)" stroke="currentColor" fill="none">
              <g transform="translate(42 36) rotate(-16)">
                <ellipse rx="36" ry="23" stroke-width="1.65"/>
                <text fill="currentColor" stroke="none" text-anchor="middle" font-family="'Arial Narrow', 'Helvetica Neue', sans-serif" font-weight="800">
                  <tspan x="0" y="-9" font-size="7.6" letter-spacing="1.5">GOOD</tspan>
                  <tspan x="0" y="-1.4" font-size="7.2" letter-spacing="0.45">PEOPLE</tspan>
                  <tspan x="0" y="5.8" font-size="6.1" letter-spacing="0.12">BRIGHTER</tspan>
                  <tspan x="0" y="13" font-size="7.4" letter-spacing="0.85">WORLD</tspan>
                </text>
              </g>
              <g stroke-width="1.25" stroke-linecap="round">
                <path d="M10 58c14-2 28 3 68 0"/>
                <path d="M14 63c13-2 26 4 62 1"/>
                <path d="M20 68c12-1 24 4 54 0"/>
              </g>
              <g transform="translate(34 92) rotate(-7)">
                <circle r="20" stroke-width="2.05"/>
                <circle r="15.6" stroke-width="1"/>
                <g fill="currentColor" stroke="none">
                  <path d="M0-10.2c1.15 0 1.7 2.8 1.7 6.8v6.2c0 2.1-.7 4.4-1.7 5.6-1-1.2-1.7-3.5-1.7-5.6V-3.4C-1.7-7.4-1.15-10.2 0-10.2Z"/>
                  <path d="M-12.8-.2-2-2.2v4.6L-13.6 3.6Z"/>
                  <path d="M12.8-.2 2-2.2v4.6L13.6 3.6Z"/>
                  <path d="M-4.2 6.6 0 5.4 4.2 6.6 0 9.5Z"/>
                </g>
              </g>
            </g>
          </svg>
        </div>
        <figure class="map-postcard-stamp">
          <span>
            <img src="${person.stamp}" alt="${escapeHtml(person.name)}" />
          </span>
        </figure>
        <div class="map-postcard-meta">
          <b>${escapeHtml(person.serial)}</b>
          <small>${escapeHtml(person.tagline)}</small>
          <i></i>
          <em>Collect<br />People<br />Not Just<br />Places.</em>
        </div>
      </div>
      <h2>${escapeHtml(person.name)}${genderMark(person.gender)}</h2>
      <p class="map-postcard-bio">${escapeHtml(person.bio)}</p>
      <div class="map-postcard-where">
        <span>
          <svg viewBox="0 0 16 16"><path d="M8 1.6A4.7 4.7 0 0 0 3.3 6.3C3.3 9.8 8 14.4 8 14.4s4.7-4.6 4.7-8.1A4.7 4.7 0 0 0 8 1.6Z" fill="currentColor"/><circle cx="8" cy="6.2" r="1.6" fill="#fffdf8"/></svg>
          ${escapeHtml(person.city)} · ${escapeHtml(person.country)}
        </span>
        <span>
          <svg viewBox="0 0 16 16"><path d="M1.5 8.4 13.2 3.4 11 13.2 8.2 10.3 6.1 14l-.7-2.7Z" fill="currentColor"/></svg>
          ${escapeHtml(formatDistance(person))}
        </span>
      </div>
      <div class="map-postcard-row">
        ${seal("兴趣", "INTERESTS")}
        <div class="map-postcard-chips is-icon">
          ${person.interests
            .map((item) => `<em>${interestIcon(item)}<b>${escapeHtml(item)}</b></em>`)
            .join("")}
        </div>
      </div>
      <div class="map-postcard-row">
        ${seal("领域", "FIELDS")}
        <div class="map-postcard-chips is-field">
          ${person.domains.map((item) => `<em>${escapeHtml(item)}</em>`).join("")}
        </div>
      </div>
      <div class="map-postcard-row">
        ${seal("关注话题", "TOPICS")}
        <div class="map-postcard-chips is-topic">
          ${person.topics.map((item) => `<em>#${escapeHtml(item)}</em>`).join("")}
        </div>
      </div>
      <div class="map-postcard-row is-follows">
        ${seal("关注博主", "FOLLOWS")}
        <div class="map-postcard-follows">
          ${person.bloggers
            .map(
              (blogger) =>
                `<span><img src="${blogger.avatar}" alt=""><small>${escapeHtml(blogger.name)}</small></span>`,
            )
            .join("")}
        </div>
      </div>
      <footer class="map-postcard-foot">
        <blockquote>有趣的人，<br />总会在某个地方相遇。</blockquote>
        <button type="button">查看主页 →</button>
      </footer>
      <div class="map-postcard-ridge" aria-hidden="true">
        <img src="/map/postcard/ridge.png" alt="" />
      </div>
    </article>
    </div>
  `;
}

function renderPin(pin: MapPerson): string {
  const mine = pin.kind === "me";
  return html`
    <button class="map-pin${mine ? " is-me" : ""}" type="button" data-pin="${pin.id}">
      <span class="map-pin-face"><img src="${pin.avatar}" alt="" /></span>
      <i class="map-pin-dot"></i>
      <em>${escapeHtml(pin.name)}<small>${escapeHtml(pin.city)} · ${escapeHtml(pin.place)}</small></em>
    </button>
  `;
}

export function renderMap(state: RuntimeState): string {
  const collected = Object.values(state.seenInterestCards).filter((item) => item === "like").length;
  const stampCount = Math.max(collected, STAMPS.filter((item) => item.id !== "more").length);
  const total = INTEREST_CARDS.length + 16;

  return html`
    <div class="map-page">
      <section class="map-field">
        <div class="map-viewport" data-map-viewport></div>
        <svg class="map-routes" data-map-routes aria-hidden="true"></svg>
        <div class="map-scale" data-map-scale role="button" tabindex="0">国家</div>
        <div class="map-network-tag" data-network-tag>摄影关系网</div>
        <img class="map-postmark" src="/map/postmark-explore.png" alt="" draggable="false" aria-hidden="true" />
        <div class="map-compass" aria-hidden="true">
          <i></i>
          <b>N</b>
          <span>W</span>
          <span>E</span>
          <small>S</small>
        </div>
        <div class="map-legend">
          <span><i class="is-me"></i>我的位置</span>
          <span><i></i>有趣的人</span>
        </div>
      </section>

      <section class="map-album">
        <header class="map-album-bar">
          <h1>我的兴趣邮集</h1>
          <i></i>
          <p>收集让生活更有趣的事</p>
          <b>${stampCount}/${total}</b>
          <em>▶</em>
        </header>
        <div class="map-stamps">
          ${STAMPS.map((stamp) => {
            const more = stamp.id === "more";
            return html`
              <button
                class="postage${more ? " is-more" : stamp.id === DEFAULT_STAMP ? " is-on" : ""}"
                type="button"
                ${more ? `data-go="discover"` : `data-stamp="${stamp.id}"`}
              >
                <img src="${stamp.src}" alt="${stamp.label}" draggable="false" />
              </button>
            `;
          }).join("")}
        </div>
      </section>
      <aside class="map-dossier" data-dossier></aside>
    </div>
  `;
}

function zoomCaption(zoom: number): string {
  if (zoom < 3.5) return "世界";
  if (zoom < 5) return "国家";
  if (zoom < 7) return "省份";
  if (zoom < 10) return "城市";
  if (zoom < 13) return "区县";
  if (zoom < 16) return "街道";
  return "建筑";
}

const ZOOM_STOPS = [2.4, 4.2, 6.2, 9.6, 12.4, 15.4, 17.2];

function destroyLiveMap() {
  liveMarkers.forEach((marker) => marker.remove());
  liveMarkers = [];
  liveMap?.remove();
  liveMap = null;
}

function networkPairs(networkId: string) {
  const people = peopleInNetwork(findMapNetwork(networkId));
  const me = people.find((person) => person.kind === "me");
  if (!me) return [];
  return people
    .filter((person) => person.id !== me.id)
    .map((person): [MapPerson, MapPerson] => [me, person]);
}

function drawNetworkRoutes(map: MapLibreMap, svg: SVGSVGElement, networkId: string) {
  const width = map.getContainer().clientWidth;
  const height = map.getContainer().clientHeight;
  if (!width || !height) return;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const paths = networkPairs(networkId).map(([from, to]) => {
    const d = greatCircle(from, to)
      .map(([lng, lat]) => {
        const point = map.project([lng, lat]);
        return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      })
      .join(" L ");
    return `M ${d}`;
  });
  svg.innerHTML = paths
    .flatMap((d) => [`<path class="is-halo" d="${d}" />`, `<path class="is-line" d="${d}" />`])
    .join("");
}

export function mountMap(root: HTMLElement, state: RuntimeState) {
  const viewport = root.querySelector<HTMLElement>("[data-map-viewport]");
  const routes = root.querySelector<SVGSVGElement>("[data-map-routes]");
  const dossier = root.querySelector<HTMLElement>("[data-dossier]");
  const scaleEl = root.querySelector<HTMLElement>("[data-map-scale]");
  const tagEl = root.querySelector<HTMLElement>("[data-network-tag]");
  let openId = "";
  let activeStamp = DEFAULT_STAMP;

  destroyLiveMap();
  if (!viewport) return;

  const closeDossier = () => {
    openId = "";
    root.querySelectorAll(".map-pin.is-picked").forEach((item) => item.classList.remove("is-picked"));
    if (!dossier) return;
    dossier.classList.remove("is-open");
    dossier.innerHTML = "";
  };

  const openDossier = (id: string) => {
    const person = id === "me" ? portraitForMe(state.selectedTopics) : findMapPerson(id);
    if (!person || !dossier) return;
    openId = id;
    root.querySelectorAll(".map-pin.is-picked").forEach((item) => item.classList.remove("is-picked"));
    root.querySelector(`[data-pin="${id}"]`)?.classList.add("is-picked");
    dossier.innerHTML = renderDossier(person);
    dossier.classList.add("is-open");
  };

  const paintPins = (map: MapLibreMap, stampId: string) => {
    liveMarkers.forEach((marker) => marker.remove());
    liveMarkers = [];
    peopleInNetwork(findMapNetwork(stampId)).forEach((person) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderPin(person).trim();
      const el = wrap.firstElementChild as HTMLElement;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        if (openId === person.id) closeDossier();
        else openDossier(person.id);
      });
      liveMarkers.push(
        new Marker({ element: el, anchor: "bottom" }).setLngLat([person.lng, person.lat]).addTo(map),
      );
    });
  };

  const fitNetwork = (map: MapLibreMap, stampId: string) => {
    const people = peopleInNetwork(findMapNetwork(stampId));
    if (!people.length) return;
    if (people.length === 1) {
      map.flyTo({ center: [people[0].lng, people[0].lat], zoom: 12, duration: 800 });
      return;
    }
    const bounds = new LngLatBounds();
    people.forEach((person) => bounds.extend([person.lng, person.lat]));
    map.resize();
    map.fitBounds(bounds, {
      padding: { top: 72, left: 36, right: 36, bottom: 28 },
      maxZoom: 12,
      duration: 900,
      essential: true,
    });
  };

  const applyNetwork = (map: MapLibreMap, stampId: string) => {
    activeStamp = stampId;
    const network = findMapNetwork(stampId);
    if (tagEl) tagEl.textContent = `${network.label}关系网`;
    paintPins(map, stampId);
    fitNetwork(map, stampId);
    if (routes) drawNetworkRoutes(map, routes, stampId);
    closeDossier();
  };

  const map = new MapLibreMap({
    container: viewport,
    style: STREET_STYLE,
    center: [120.139, 30.2487],
    zoom: 4.2,
    minZoom: 2,
    maxZoom: 18,
    fadeDuration: 0,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: { compact: true },
  });
  liveMap = map;

  const restoreOverlay = (fly: boolean) => {
    if (!map.getStyle()) return;
    paintPins(map, activeStamp);
    if (routes) drawNetworkRoutes(map, routes, activeStamp);
    if (fly) fitNetwork(map, activeStamp);
    map.resize();
    syncScale();
  };

  const syncScale = () => {
    if (scaleEl) scaleEl.textContent = zoomCaption(map.getZoom());
  };

  map.on("style.load", () => restoreOverlay(true));
  map.on("move", () => {
    if (routes) drawNetworkRoutes(map, routes, activeStamp);
  });

  map.on("zoom", syncScale);
  map.on("click", (event) => {
    const target = event.originalEvent.target;
    if (target instanceof Element && target.closest("[data-pin]")) return;
    closeDossier();
  });

  const stepZoom = () => {
    const current = map.getZoom();
    const next = ZOOM_STOPS.find((stop) => stop > current + 0.35) ?? ZOOM_STOPS[0];
    const people = peopleInNetwork(findMapNetwork(activeStamp));
    const focus = people.find((person) => person.kind === "me") ?? people[0];
    map.easeTo({
      zoom: next,
      duration: 650,
      essential: true,
      ...(next >= 9.5 && focus ? { center: [focus.lng, focus.lat] } : {}),
    });
  };
  scaleEl?.addEventListener("click", (event) => {
    event.stopPropagation();
    stepZoom();
  });

  requestAnimationFrame(() => map.resize());
  window.setTimeout(() => map.resize(), 280);

  dossier?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-dossier-close]")) closeDossier();
  });

  root.querySelectorAll<HTMLElement>("[data-stamp]").forEach((stamp) => {
    stamp.addEventListener("click", () => {
      const id = stamp.dataset.stamp;
      if (!id) return;
      root.querySelectorAll<HTMLElement>("[data-stamp]").forEach((item) => {
        item.classList.toggle("is-on", item === stamp);
      });
      applyNetwork(map, id);
    });
  });
}
