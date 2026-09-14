import { TODAY } from "@/data/mock/papers";
import { html } from "@/shared/html";
import { KANSHAN_SRC } from "@/shared/brand";
import type { Actions } from "@/app/actions";
import type { RuntimeState } from "@/app/store";
import { mountFrontNewspaper, renderFrontNewspaper } from "./home";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function datesInMonth(year: number, month: number): string[] {
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const monthText = String(month).padStart(2, "0");
    return `${year}-${monthText}-${day}`;
  });
}

function mondayIndex(date: string): number {
  const day = new Date(`${date}T00:00:00+08:00`).getDay();
  return day === 0 ? 6 : day - 1;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function weeksOfMonth(year: number, month: number): Array<Array<{ date: string; outside: boolean }>> {
  const dates = datesInMonth(year, month);
  const pad = mondayIndex(dates[0]);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const prevDates = datesInMonth(prev.year, prev.month);
  const nextDates = datesInMonth(next.year, next.month);
  const cells: Array<{ date: string; outside: boolean }> = [
    ...prevDates.slice(prevDates.length - pad).map((date) => ({ date, outside: true })),
    ...dates.map((date) => ({ date, outside: false })),
  ];
  let extra = 0;
  while (cells.length % 7 !== 0) {
    cells.push({ date: nextDates[extra], outside: true });
    extra += 1;
  }
  const weeks: Array<Array<{ date: string; outside: boolean }>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function renderCalendar(state: RuntimeState): string {
  const selected = state.selectedDate;
  const [year, month] = selected.split("-").map(Number);
  const paperDates = new Set(state.archive.map((item) => item.date));
  const selectedPaper = state.archive.find((item) => item.date === selected);
  const monthLabel = selectedPaper?.monthLabel ?? "九月.2026";

  return html`
    <div class="calendar-page">
      <header class="cal-top">
        <div class="cal-month">
          <b>${monthLabel}</b>
        </div>
        <div class="cal-tools">
          <button class="text-btn" type="button" data-action="go-today">回今天</button>
        </div>
      </header>
      <div class="cal-weekdays">
        ${WEEKDAYS.map((day) => `<span class="cal-wd">${day}</span>`).join("")}
      </div>
      <div class="cal-strip" id="cal-strip">
        ${weeksOfMonth(year, month)
          .map((week) => {
            const buttons = week
              .map((cell) => {
                const day = Number(cell.date.slice(8));
                const selectedClass = cell.date === selected ? " selected" : "";
                const hasClass = paperDates.has(cell.date) ? " has" : "";
                const todayClass = cell.date === TODAY ? " today" : "";
                const outsideClass = cell.outside ? " outside" : "";
                return `<span class="cal-cell"><button class="cal-day${selectedClass}${hasClass}${todayClass}${outsideClass}" type="button" data-action="select-date" data-date="${cell.date}">${day}</button></span>`;
              })
              .join("");
            return `<div class="cal-week">${buttons}</div>`;
          })
          .join("")}
      </div>

      <div class="cal-feed${selectedPaper ? " home-feed" : ""}">
        ${selectedPaper
          ? renderFrontNewspaper(state, selectedPaper, "calendar")
          : html`
              <section class="cal-empty" data-day="${selected}">
                <figure class="kanshan-empty">
                  <img src="${KANSHAN_SRC}" alt="" />
                </figure>
                <div class="cal-day-title">这一天看山还没送到</div>
                <div class="cal-time">${year}-${String(month).padStart(2, "0")}-${String(selected.slice(8)).padStart(2, "0")}</div>
              </section>
            `}
      </div>
    </div>
  `;
}

function mountStripSwipe(strip: HTMLElement) {
  const SLOP = 8;
  let pointer = 0;
  let startX = 0;
  let startScroll = 0;
  let moved = 0;
  let dragging = false;

  const weekWidth = () => strip.clientWidth || 1;

  const snap = () => {
    const width = weekWidth();
    const max = Math.max(0, strip.scrollWidth - width);
    const index = Math.round(strip.scrollLeft / width);
    const left = Math.min(max, Math.max(0, index * width));
    strip.scrollTo({ left, behavior: "smooth" });
  };

  strip.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer = event.pointerId;
    startX = event.clientX;
    startScroll = strip.scrollLeft;
    moved = 0;
    dragging = true;
    strip.setPointerCapture(event.pointerId);
    strip.classList.add("is-dragging");
  });

  strip.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointer) return;
    const dx = event.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved < SLOP) return;
    event.preventDefault();
    strip.scrollLeft = startScroll - dx;
  });

  const endPointer = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointer) return;
    dragging = false;
    strip.classList.remove("is-dragging");
    if (moved >= SLOP) snap();
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  };

  strip.addEventListener("pointerup", endPointer);
  strip.addEventListener("pointercancel", endPointer);

  strip.addEventListener(
    "click",
    (event) => {
      if (moved < SLOP) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}

export function mountCalendar(root: HTMLElement, state: RuntimeState, actions: Actions): void {
  const selected = root.querySelector<HTMLElement>(".cal-day.selected");
  const strip = root.querySelector<HTMLElement>("#cal-strip");
  const week = selected?.closest<HTMLElement>(".cal-week");
  if (week && strip) strip.scrollLeft = week.offsetLeft;
  if (strip) mountStripSwipe(strip);
  mountFrontNewspaper(root, state, actions);
}
