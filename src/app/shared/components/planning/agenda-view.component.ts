import { Component, computed, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanningToolbarComponent } from './planning-toolbar.component';
import { MonthCalendarComponent } from './month-calendar.component';
import {
  EMPTY_FILTER_STATE, MONTHS, PlanningFilter, PlanningFilterState, PlanningItem, WEEKDAYS_SHORT,
  addDays, applyPlanningFilters, isLate, itemColor, sameDay, startOfDay, startOfWeek, toDate,
} from './planning.models';

export type AgendaView = 'day' | 'week' | 'month';
const HOUR_H = 48;

interface Placed { item: PlanningItem; top: number; height: number; left: number; width: number; }

/**
 * Agenda générique jour / semaine / mois. Les éléments sont placés de `start` à `end`
 * (durée par défaut `defaultDuration` minutes) ; un élément dont le début est à minuit
 * sans fin est traité « toute la journée ». Les chevauchements se partagent la largeur.
 */
@Component({
  selector: 'app-agenda-view',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatTooltipModule, PlanningToolbarComponent, MonthCalendarComponent],
  template: `
    <div class="pl-stack">
      <app-planning-toolbar [searchable]="searchable()" [filters]="filters()" [lateToggle]="lateToggle()" [lateCount]="lateCount()" [(state)]="filterState">
        <div toolbarEnd class="ag-nav">
          <button type="button" class="pl-icon-btn" (click)="shift(-1)" aria-label="Précédent"><mat-icon>chevron_left</mat-icon></button>
          <strong class="ag-title">{{ title() }}</strong>
          <button type="button" class="pl-icon-btn" (click)="shift(1)" aria-label="Suivant"><mat-icon>chevron_right</mat-icon></button>
          <button type="button" class="pl-text-btn" (click)="cursor.set(today)"><mat-icon>today</mat-icon> Aujourd'hui</button>
          @if (views().length > 1) {
            <div class="pl-segmented">
              @for (v of views(); track v) { <button type="button" [class.active]="view() === v" (click)="view.set(v)">{{ labels[v] }}</button> }
            </div>
          }
        </div>
      </app-planning-toolbar>

      @if (view() === 'month') {
        <app-month-calendar [items]="visible()" [month]="cursor()" (monthChange)="cursor.set($event)" [showNavigation]="false" [showDayPanel]="true" (itemClick)="itemClick.emit($event)" />
      } @else {
        <div class="ag-frame">
          <div class="ag-head" [style.--cols]="columns().length">
            <div class="ag-gutter"></div>
            @for (c of columns(); track c.date.getTime()) {
              <div class="ag-colhead" [class.today]="c.today"><span>{{ weekdays[(c.date.getDay() + 6) % 7] }}</span><b>{{ c.date.getDate() }}</b></div>
            }
          </div>
          @if (hasAllDay()) {
            <div class="ag-allday" [style.--cols]="columns().length">
              <div class="ag-gutter">Journée</div>
              @for (c of columns(); track c.date.getTime()) {
                <div class="ag-allday-cell">
                  @for (it of c.allDay; track it.id) {
                    <button type="button" class="ag-chip" [style.--tone]="color(it)" (click)="itemClick.emit(it)">{{ it.title }}</button>
                  }
                </div>
              }
            </div>
          }
          <div class="ag-scroll">
            <div class="ag-grid" [style.--cols]="columns().length" [style.height.px]="hours().length * hourHeight">
              <div class="ag-hours">
                @for (h of hours(); track h) { <span [style.top.px]="$index * hourHeight">{{ h }}:00</span> }
              </div>
              @for (c of columns(); track c.date.getTime()) {
                <div class="ag-col" [class.today]="c.today">
                  @for (h of hours(); track h) { <div class="ag-slot" [style.top.px]="$index * hourHeight"></div> }
                  @for (p of c.placed; track p.item.id) {
                    <button type="button" class="ag-event" [class.done]="p.item.done" [style.--tone]="color(p.item)"
                      [style.top.px]="p.top" [style.height.px]="p.height" [style.left.%]="p.left" [style.width.%]="p.width"
                      (click)="itemClick.emit(p.item)" [matTooltip]="p.item.title">
                      <b>{{ p.item.title }}</b>
                      <small>{{ p.item.start | date: 'HH:mm' }}@if (p.item.end) { – {{ p.item.end | date: 'HH:mm' }} }@if (p.item.assignee) { · {{ p.item.assignee }} }</small>
                    </button>
                  }
                  @if (c.today && nowTop() !== null) { <div class="ag-now" [style.top.px]="nowTop()"></div> }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./agenda-view.component.scss'],
})
export class AgendaViewComponent {
  items = input<PlanningItem[]>([]);
  view = model<AgendaView>('week');
  views = input<AgendaView[]>(['day', 'week', 'month']);
  cursor = model<Date>(new Date());
  startHour = input(7);
  endHour = input(20);
  defaultDuration = input(60);
  /** Semaine de travail (lun.–ven.) au lieu de 7 jours. */
  workWeek = input(false);
  searchable = input(false);
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  filterState = model<PlanningFilterState>(EMPTY_FILTER_STATE);
  itemClick = output<PlanningItem>();

  readonly today = new Date();
  readonly weekdays = WEEKDAYS_SHORT;
  readonly labels: Record<AgendaView, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };
  readonly hourHeight = HOUR_H;
  readonly color = itemColor;

  visible = computed(() => applyPlanningFilters(this.items(), this.filters(), this.filterState()));
  lateCount = computed(() => this.items().filter((i) => isLate(i)).length);

  title = computed(() => {
    const c = this.cursor();
    if (this.view() === 'month') return `${MONTHS[c.getMonth()]} ${c.getFullYear()}`;
    if (this.view() === 'day') return c.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const s = startOfWeek(c); const e = addDays(s, this.workWeek() ? 4 : 6);
    return `${s.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()].toLowerCase()} ${e.getFullYear()}`;
  });

  private isAllDay(it: PlanningItem): boolean {
    const s = toDate(it.start) ?? toDate(it.due);
    return !!s && !it.end && s.getHours() === 0 && s.getMinutes() === 0;
  }

  /** Plage horaire : bornes demandées, élargies si un élément déborde. */
  hours = computed(() => {
    let start = this.startHour(), end = this.endHour();
    for (const it of this.visible()) {
      const s = toDate(it.start); if (!s || this.isAllDay(it)) continue;
      const e = toDate(it.end) ?? new Date(s.getTime() + this.defaultDuration() * 60_000);
      start = Math.min(start, s.getHours()); end = Math.max(end, Math.min(24, e.getHours() + (e.getMinutes() ? 1 : 0)));
    }
    return Array.from({ length: end - start }, (_, i) => start + i);
  });

  columns = computed(() => {
    const days = this.view() === 'day' ? [startOfDay(this.cursor())]
      : Array.from({ length: this.workWeek() ? 5 : 7 }, (_, i) => addDays(startOfWeek(this.cursor()), i));
    const first = this.hours()[0];
    return days.map((date) => {
      const own = this.visible().filter((it) => { const s = toDate(it.start) ?? toDate(it.due); return !!s && sameDay(s, date); });
      return {
        date, today: sameDay(date, this.today),
        allDay: own.filter((i) => this.isAllDay(i)),
        placed: this.layout(own.filter((i) => !this.isAllDay(i) && toDate(i.start)), first),
      };
    });
  });
  hasAllDay = computed(() => this.columns().some((c) => c.allDay.length));

  nowTop = computed(() => {
    const h = this.hours(); const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes() - h[0] * 60;
    return mins < 0 || mins > h.length * 60 ? null : (mins / 60) * HOUR_H;
  });

  private layout(items: PlanningItem[], firstHour: number): Placed[] {
    const evs = items.map((item) => {
      const s = toDate(item.start)!;
      const e = toDate(item.end) ?? new Date(s.getTime() + this.defaultDuration() * 60_000);
      const startMin = s.getHours() * 60 + s.getMinutes();
      return { item, startMin, endMin: Math.max(startMin + 30, e.getHours() * 60 + e.getMinutes() || 24 * 60), lane: 0, lanes: 1 };
    }).sort((a, b) => a.startMin - b.startMin);
    // Regroupe les éléments qui se chevauchent puis répartit chaque groupe sur des couloirs.
    for (let i = 0; i < evs.length;) {
      let j = i, end = evs[i].endMin;
      while (j + 1 < evs.length && evs[j + 1].startMin < end) { j++; end = Math.max(end, evs[j].endMin); }
      const lanes: number[] = [];
      for (let k = i; k <= j; k++) {
        const l = lanes.findIndex((le) => le <= evs[k].startMin);
        evs[k].lane = l < 0 ? lanes.length : l;
        lanes[evs[k].lane] = evs[k].endMin;
      }
      for (let k = i; k <= j; k++) evs[k].lanes = lanes.length;
      i = j + 1;
    }
    return evs.map((e) => ({
      item: e.item,
      top: ((e.startMin - firstHour * 60) / 60) * HOUR_H + 1,
      height: Math.max(((e.endMin - e.startMin) / 60) * HOUR_H - 2, 22),
      left: (e.lane / e.lanes) * 100, width: 100 / e.lanes,
    }));
  }

  shift(n: number) {
    const c = this.cursor();
    if (this.view() === 'month') this.cursor.set(new Date(c.getFullYear(), c.getMonth() + n, 1));
    else this.cursor.set(addDays(c, n * (this.view() === 'day' ? 1 : 7)));
  }
}
