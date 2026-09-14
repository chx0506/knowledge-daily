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

function daysOfMonth(year: number, month: number): Array<{ date: string; outside: boolean }> {
  return weeksOfMonth(year, month).flat();
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
      <div class="cal-strip" id="cal-strip">
        ${daysOfMonth(year, month)
          .map((cell) => {
            const day = Number(cell.date.slice(8));
            const selectedClass = cell.date === selected ? " selected" : "";
            const hasClass = paperDates.has(cell.date) ? " has" : "";
            const todayClass = cell.date === TODAY ? " today" : "";
            const outsideClass = cell.outside ? " outside" : "";
            return `<button class="cal-day${selectedClass}${hasClass}${todayClass}${outsideClass}" type="button" data-action="select-date" data-date="${cell.date}"><small>${WEEKDAYS[mondayIndex(cell.date)]}</small><span>${day}</span></button>`;
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

function mountStripSwipe(strip: HTMLElement, actions: Actions) {
  const SLOP = 8;
  let pointer = 0;
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let armed = false;
  let dragged = false;

  const dayWidth = () => strip.querySelector<HTMLElement>(".cal-day")?.offsetWidth || strip.clientWidth / 7 || 1;

  const snapToDay = () => {
    const width = dayWidth();
    const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const index = Math.round(strip.scrollLeft / width);
    const left = Math.min(max, Math.max(0, index * width));
    strip.scrollTo({ left, behavior: "smooth" });
  };

  strip.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pointer = event.pointerId;
    startX = event.clientX;
    startScroll = strip.scrollLeft;
    armed = true;
    dragging = false;
    dragged = false;
  });

  strip.addEventListener("pointermove", (event) => {
    if (!armed || event.pointerId !== pointer) return;
    const dx = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < SLOP) return;
      dragging = true;
      dragged = true;
      strip.setPointerCapture(event.pointerId);
      strip.classList.add("is-dragging");
    }
    event.preventDefault();
    strip.scrollLeft = startScroll - dx;
  });

  const endPointer = (event: PointerEvent) => {
    if (!armed || event.pointerId !== pointer) return;
    armed = false;
    if (dragging) {
      strip.classList.remove("is-dragging");
      snapToDay();
    }
    dragging = false;
    if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  };

  strip.addEventListener("pointerup", endPointer);
  strip.addEventListener("pointercancel", endPointer);

  strip.addEventListener(
    "click",
    (event) => {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const day = (event.target as HTMLElement).closest<HTMLElement>(".cal-day");
      const date = day?.dataset.date;
      if (!date) return;
      event.stopPropagation();
      actions.selectDate(date);
    },
  );
}

export function mountCalendar(root: HTMLElement, state: RuntimeState, actions: Actions): void {
  const strip = root.querySelector<HTMLElement>("#cal-strip");
  const selected = root.querySelector<HTMLElement>(".cal-day.selected");
  if (strip && selected) {
    const left = selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
    strip.scrollLeft = Math.max(0, left);
  }
  if (strip) mountStripSwipe(strip, actions);
  mountFrontNewspaper(root, state, actions);
}
