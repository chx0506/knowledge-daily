import { INTEREST_CARDS } from "@/data/mock/interest-cards";
import { findMapPerson, MAP_PEOPLE, portraitForMe, type MapPerson } from "@/data/mock/map-people";
import { escapeHtml, html } from "@/shared/html";
import type { RuntimeState } from "@/app/store";

const PINS = MAP_PEOPLE;

const STAMPS = [
  { id: "photo", label: "摄影", src: "/map/stamps/stamp-photo.png" },
  { id: "outdoor", label: "户外", src: "/map/stamps/stamp-outdoor.png" },
  { id: "coffee", label: "咖啡", src: "/map/stamps/stamp-coffee.png" },
  { id: "reading", label: "阅读", src: "/map/stamps/stamp-reading.png" },
  { id: "game", label: "游戏", src: "/map/stamps/stamp-game.png" },
  { id: "more", label: "收集更多兴趣", src: "/map/stamps/stamp-more.png" },
] as const;

function routePath(): string {
  const pts = PINS.map((pin) => `${pin.x},${pin.y}`);
  return `M${pts[0]} C ${pts[1]} ${pts[2]} ${pts[3]} S ${pts[4]} ${pts[5]} S ${pts[6]} ${pts[7]}`;
}

function renderTags(items: string[]): string {
  return items.map((item) => `<em>${escapeHtml(item)}</em>`).join("");
}

function renderDossier(person: MapPerson): string {
  const mine = person.kind === "me";
  return html`
    <header>
      <figure>
        <img src="${person.avatar}" alt="${escapeHtml(person.name)}" />
      </figure>
      <div>
        <small>${mine ? "我的画像" : "人物画像"}</small>
        <h2>${escapeHtml(person.name)}</h2>
        <p>${escapeHtml(person.role)} · ${escapeHtml(person.city)}</p>
        <span>@${escapeHtml(person.handle)}</span>
      </div>
      <button type="button" data-dossier-close aria-label="关闭画像">×</button>
    </header>
    <dl>
      <div>
        <dt>兴趣</dt>
        <dd>${renderTags(person.interests)}</dd>
      </div>
      <div>
        <dt>领域</dt>
        <dd>${renderTags(person.domains)}</dd>
      </div>
      <div>
        <dt>关注话题</dt>
        <dd>${renderTags(person.topics)}</dd>
      </div>
      <div>
        <dt>关注博主</dt>
        <dd class="map-dossier-blogs">
          ${person.bloggers
            .map(
              (blogger) =>
                `<span><i>${escapeHtml(blogger.name.slice(0, 1))}</i>${escapeHtml(blogger.name)}</span>`,
            )
            .join("")}
        </dd>
      </div>
    </dl>
  `;
}

function renderPin(pin: MapPerson): string {
  const mine = pin.kind === "me";
  return html`
    <button
      class="map-pin${mine ? " is-me" : ""}"
      type="button"
      style="left:${pin.x}%;top:${pin.y}%"
      data-pin="${pin.id}"
    >
      <span class="map-pin-face"><img src="${pin.avatar}" alt="" /></span>
      <i class="map-pin-dot"></i>
      <em>${escapeHtml(pin.name)}<small>${escapeHtml(pin.note)}</small></em>
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
        <div class="map-viewport" data-map-viewport>
          <div class="map-stage" data-map-stage>
            <img class="map-world" src="/map/world.svg" alt="" draggable="false" />
            <svg class="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="${routePath()}" />
            </svg>
            <div class="map-pins">${PINS.map(renderPin).join("")}</div>
          </div>
        </div>
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
        <aside class="map-dossier" data-dossier></aside>
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
                class="postage${more ? " is-more" : ""}"
                type="button"
                ${more ? `data-go="discover"` : `data-stamp="${stamp.id}"`}
              >
                <img src="${stamp.src}" alt="${stamp.label}" draggable="false" />
              </button>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function mountMapCamera(
  viewport: HTMLElement,
  stage: HTMLElement,
  onTap: (target: HTMLElement) => void,
) {
  const TAP_SLOP = 14;
  let scale = 0.42;
  let x = 0;
  let y = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastGap = 0;
  let dragging = false;
  let captured = false;
  let moved = 0;
  let vx = 0;
  let vy = 0;
  let lastT = 0;
  let lastX = 0;
  let lastY = 0;
  let lastTap = 0;
  let inertia = 0;
  let downTarget: HTMLElement | null = null;

  const size = () => ({
    vw: viewport.clientWidth,
    vh: viewport.clientHeight,
    sw: stage.offsetWidth,
    sh: stage.offsetHeight,
  });

  const clamp = () => {
    const { vw, vh, sw, sh } = size();
    const maxX = Math.max(0, (sw * scale - vw) / 2 + 48);
    const maxY = Math.max(0, (sh * scale - vh) / 2 + 36);
    x = Math.min(maxX, Math.max(-maxX, x));
    y = Math.min(maxY, Math.max(-maxY, y));
  };

  const paint = () => {
    clamp();
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    stage.style.setProperty("--pin-scale", `${1 / scale}`);
  };

  const fitScale = () => {
    const { vw, vh, sw, sh } = size();
    if (!vw || !vh || !sw || !sh) return 0.42;
    return Math.min(vw / sw, vh / sh) * 0.98;
  };

  const minZoom = () => fitScale() * 0.92;
  const maxZoom = () => fitScale() * 6.2;

  const centerStart = () => {
    x = 0;
    y = 0;
    scale = fitScale() * 1.12;
    paint();
  };

  const zoomAt = (clientX: number, clientY: number, next: number) => {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left - viewport.clientWidth / 2;
    const py = clientY - rect.top - viewport.clientHeight / 2;
    const old = scale;
    scale = Math.min(maxZoom(), Math.max(minZoom(), next));
    const k = scale / old;
    x = px - (px - x) * k;
    y = py - (py - y) * k;
    paint();
  };

  const gapOf = () => {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };

  const midOf = () => {
    const pts = [...pointers.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };

  const stopInertia = () => {
    if (inertia) cancelAnimationFrame(inertia);
    inertia = 0;
  };

  const glide = () => {
    vx *= 0.92;
    vy *= 0.92;
    if (Math.hypot(vx, vy) < 0.18) {
      inertia = 0;
      return;
    }
    x += vx;
    y += vy;
    paint();
    inertia = requestAnimationFrame(glide);
  };

  const capture = (event: PointerEvent) => {
    if (captured) return;
    captured = true;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-grabbing");
  };

  viewport.addEventListener("pointerdown", (event) => {
    stopInertia();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    downTarget = event.target instanceof HTMLElement ? event.target : null;
    dragging = pointers.size === 1;
    captured = false;
    moved = 0;
    vx = 0;
    vy = 0;
    lastT = event.timeStamp;
    lastX = event.clientX;
    lastY = event.clientY;
    if (pointers.size === 2) {
      lastGap = gapOf();
      dragging = false;
      capture(event);
    }
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const gap = gapOf();
      if (lastGap > 0) {
        const mid = midOf();
        zoomAt(mid.x, mid.y, scale * (gap / lastGap));
      }
      lastGap = gap;
      return;
    }

    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    moved += Math.hypot(dx, dy);
    if (moved > TAP_SLOP) capture(event);
    if (!captured) return;
    x += dx;
    y += dy;
    const dt = Math.max(1, event.timeStamp - lastT);
    vx = dx / dt * 16;
    vy = dy / dt * 16;
    lastT = event.timeStamp;
    lastX = event.clientX;
    lastY = event.clientY;
    paint();
  });

  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const remain = [...pointers.values()][0];
      lastX = remain.x;
      lastY = remain.y;
      dragging = true;
      lastGap = 0;
      return;
    }
    dragging = false;
    lastGap = 0;
    viewport.classList.remove("is-grabbing");
    if (moved <= TAP_SLOP) {
      const pin = downTarget?.closest<HTMLElement>("[data-pin]");
      if (pin) {
        onTap(pin);
      } else {
        const now = event.timeStamp;
        if (now - lastTap < 280) zoomAt(event.clientX, event.clientY, scale > 1.4 ? fitScale() : Math.min(maxZoom(), scale * 1.85));
        lastTap = now;
        onTap(viewport);
      }
    } else if (Math.hypot(vx, vy) > 0.6) {
      inertia = requestAnimationFrame(glide);
    }
    downTarget = null;
  };

  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const next = scale * (event.deltaY > 0 ? 0.9 : 1.11);
      zoomAt(event.clientX, event.clientY, next);
    },
    { passive: false },
  );

  viewport.addEventListener("lostpointercapture", () => {
    dragging = false;
    captured = false;
    viewport.classList.remove("is-grabbing");
  });

  centerStart();
}

export function mountMap(root: HTMLElement, state: RuntimeState) {
  const viewport = root.querySelector<HTMLElement>("[data-map-viewport]");
  const stage = root.querySelector<HTMLElement>("[data-map-stage]");
  const dossier = root.querySelector<HTMLElement>("[data-dossier]");
  let openId = "";

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

  if (viewport && stage) {
    mountMapCamera(viewport, stage, (target) => {
      const pin = target.closest<HTMLElement>("[data-pin]");
      const id = pin?.dataset.pin;
      if (id) {
        if (openId === id) closeDossier();
        else openDossier(id);
        return;
      }
      closeDossier();
    });
  }

  dossier?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("[data-dossier-close]")) closeDossier();
  });

  root.querySelectorAll<HTMLElement>("[data-stamp]").forEach((stamp) => {
    stamp.addEventListener("click", () => {
      stamp.classList.toggle("is-on");
    });
  });
}
