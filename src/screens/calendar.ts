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

function weeksOfMonth(year: number, month: number): Array<Array<string | null>> {
  const dates = datesInMonth(year, month);
  const pad = mondayIndex(dates[0]);
  const cells: Array<string | null> = [...Array(pad).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
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
              .map((date) => {
                if (!date) return `<span class="cal-cell"><span class="cal-day empty"></span></span>`;
                const day = Number(date.slice(8));
                const selectedClass = date === selected ? " selected" : "";
                const hasClass = paperDates.has(date) ? " has" : "";
                const todayClass = date === TODAY ? " today" : "";
                return `<span class="cal-cell"><button class="cal-day${selectedClass}${hasClass}${todayClass}" type="button" data-action="select-date" data-date="${date}">${day}</button></span>`;
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

export function mountCalendar(root: HTMLElement, state: RuntimeState, actions: Actions): void {
  const selected = root.querySelector<HTMLElement>(".cal-day.selected");
  const strip = root.querySelector<HTMLElement>("#cal-strip");
  const week = selected?.closest<HTMLElement>(".cal-week");
  if (week && strip) strip.scrollLeft = week.offsetLeft;
  mountFrontNewspaper(root, state, actions);
}
