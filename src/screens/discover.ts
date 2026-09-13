import { INTEREST_CARDS } from "@/data/mock/interest-cards";
import type { InterestCard, InterestVerdict } from "@/domain/types";
import { escapeHtml, html } from "@/shared/html";
import type { Actions } from "@/app/actions";
import type { RuntimeState } from "@/app/store";

const VISIBLE = 3;
const SWIPE_PX = 78;

function remainingCards(seen: Record<string, InterestVerdict>): InterestCard[] {
  return INTEREST_CARDS.filter((card) => !seen[card.id]);
}

function renderCard(card: InterestCard, depth: number): string {
  const front = depth === 0 ? " front" : "";
  return html`
    <article
      class="interest-card tone-${card.tone}${front}"
      data-card-id="${card.id}"
      data-depth="${depth}"
      style="--depth:${depth}"
    >
      <div class="interest-stamp like">感兴趣</div>
      <div class="interest-stamp pass">不感兴趣</div>
      <figure class="interest-visual">
        <img src="${card.image}" alt="" />
        <figcaption>
          <small>他人兴趣卡</small>
          <b>${escapeHtml(card.author)}</b>
          <span>${escapeHtml(card.role)} · ${escapeHtml(card.city)}</span>
        </figcaption>
      </figure>
      <div class="interest-body">
        <h2>${escapeHtml(card.title)}</h2>
        <p>${escapeHtml(card.summary)}</p>
        <div class="interest-tags">
          ${card.topics.map((topic) => `<em>${escapeHtml(topic)}</em>`).join("")}
        </div>
        <ol>
          ${card.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>
        <footer>
          <span>收录 ${card.collected} 篇</span>
          <span>${card.viewpoints} 个对照观点</span>
        </footer>
      </div>
    </article>
  `;
}

export function renderDiscover(state: RuntimeState): string {
  const deck = remainingCards(state.seenInterestCards);
  const liked = Object.entries(state.seenInterestCards)
    .filter(([, verdict]) => verdict === "like")
    .map(([id]) => INTEREST_CARDS.find((card) => card.id === id))
    .filter((card): card is InterestCard => Boolean(card));
  const current = deck[0];

  if (!current) {
    return html`
      <div class="discover">
        <header class="discover-head">
          <div class="page-kicker">DISCOVER / 他人兴趣卡</div>
          <h1>今天的卡看完了。</h1>
        </header>
        <section class="discover-empty">
          <p>你收下了 ${liked.length} 张别人编好的兴趣卡。被收下的主题会写进你的日报偏好。</p>
          ${liked.length
            ? `<ul>${liked.map((card) => `<li><b>${escapeHtml(card.author)}</b>${escapeHtml(card.title)}</li>`).join("")}</ul>`
            : "<p class=\"empty-note\">这一轮里你还没有收下任何一张。</p>"}
          <button class="reset-deck" type="button" data-action="reset-discover">再看一轮</button>
        </section>
      </div>
    `;
  }

  return html`
    <div class="discover">
      <header class="discover-head">
        <div>
          <div class="page-kicker">DISCOVER / 他人兴趣卡</div>
          <h1>收下别人的兴趣。</h1>
        </div>
        <div class="discover-count">
          <b>${INTEREST_CARDS.length - deck.length + 1}</b>
          <span>/ ${INTEREST_CARDS.length}</span>
        </div>
      </header>
      <p class="discover-lead">这些卡是其他用户自己编的兴趣样本。右滑收下，左滑跳过。</p>
      <div class="interest-deck" aria-label="兴趣卡">
        ${deck.slice(0, VISIBLE).map((card, index) => renderCard(card, index)).join("")}
      </div>
      <div class="discover-dock">
        <button class="swipe-btn pass" type="button" data-swipe="pass" data-card-id="${current.id}">
          <strong>✕</strong>
          <span>不感兴趣</span>
        </button>
        <button class="swipe-btn like" type="button" data-swipe="like" data-card-id="${current.id}">
          <strong>收</strong>
          <span>感兴趣</span>
        </button>
      </div>
    </div>
  `;
}

export function mountDiscover(root: HTMLElement, _state: RuntimeState, actions: Actions): void {
  const deck = root.querySelector<HTMLElement>(".interest-deck");
  if (!deck) return;

  let active: HTMLElement | null = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;

  const topCard = () => deck.querySelector<HTMLElement>(".interest-card.front");

  const setOffset = (x: number, y: number) => {
    if (!active) return;
    active.style.transform = `translate(${x}px, ${y}px) rotate(${x / 16}deg)`;
    active.style.transition = "none";
    active.style.setProperty("--like", String(Math.min(1, Math.max(0, x / 88))));
    active.style.setProperty("--pass", String(Math.min(1, Math.max(0, -x / 88))));
  };

  const settle = (verdict: InterestVerdict | null) => {
    if (!active) return;
    const card = active;
    const cardId = card.dataset.cardId;
    active = null;
    dragging = false;

    if (!verdict || !cardId) {
      card.style.transition = "transform 280ms ease, box-shadow 280ms ease";
      card.style.transform = "";
      card.style.setProperty("--like", "0");
      card.style.setProperty("--pass", "0");
      return;
    }

    const dir = verdict === "like" ? 1 : -1;
    card.classList.add("leaving");
    card.style.transition = "transform 320ms ease, opacity 320ms ease";
    card.style.transform = `translate(${dir * 430}px, -28px) rotate(${dir * 18}deg)`;
    card.style.opacity = "0";
    window.setTimeout(() => actions.judgeInterest(cardId, verdict), 300);
  };

  const begin = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const card = topCard();
    if (!card || card.classList.contains("leaving")) return;
    active = card;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    card.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    if (!dragging || !active) return;
    event.preventDefault();
    setOffset(event.clientX - startX, event.clientY - startY);
  };

  const end = (event: PointerEvent) => {
    if (!dragging || !active) return;
    const dx = event.clientX - startX;
    if (dx > SWIPE_PX) settle("like");
    else if (dx < -SWIPE_PX) settle("pass");
    else settle(null);
  };

  deck.addEventListener("pointerdown", begin);
  deck.addEventListener("pointermove", move, { passive: false });
  deck.addEventListener("pointerup", end);
  deck.addEventListener("pointercancel", end);

  root.querySelectorAll<HTMLButtonElement>("[data-swipe]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const card = topCard();
      const verdict = button.dataset.swipe as InterestVerdict | undefined;
      if (!card || !verdict || card.classList.contains("leaving")) return;
      active = card;
      settle(verdict);
    });
  });
}
