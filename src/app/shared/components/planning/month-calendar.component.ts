import { Component, computed, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanningToolbarComponent } from './planning-toolbar.component';
import {
  EMPTY_FILTER_STATE, MONTHS, PlanningFilter, PlanningFilterState, PlanningItem, WEEKDAYS_SHORT,
  addDays, anchorDate, applyPlanningFilters, isLate, itemColor, sameDay, startOfDay, startOfWeek,
} from './planning.models';

/**
 * Calendrier mensuel générique : chaque élément est placé à sa date de début (sinon échéance).
 * Options : navigation, nombre max d'éléments par case, panneau du jour sélectionné, barre d'outils.
 */
@Component({
  selector: 'app-month-calendar',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatTooltipModule, PlanningToolbarComponent],
  template: `
    <div class="pl-stack">
      @if (showNavigation() || searchable() || filters().length || lateToggle()) {
        <app-planning-toolbar [searchable]="searchable()" [filters]="filters()" [lateToggle]="lateToggle()" [lateCount]="lateCount()" [(state)]="filterState">
          @if (showNavigation()) {
            <div toolbarEnd class="mc-nav">
              <button type="button" class="pl-icon-btn" (click)="shift(-1)" aria-label="Mois précédent"><mat-icon>chevron_left</mat-icon></button>
              <strong class="mc-title">{{ title() }}</strong>
              <button type="button" class="pl-icon-btn" (click)="shift(1)" aria-label="Mois suivant"><mat-icon>chevron_right</mat-icon></button>
              <button type="button" class="pl-text-btn" (click)="goToday()"><mat-icon>today</mat-icon> Aujourd'hui</button>
            </div>
          }
        </app-planning-toolbar>
      }
      <div class="mc-layout" [class.with-panel]="showDayPanel()">
        <div class="mc-grid">
          @for (w of weekdays; track w) { <div class="mc-wd">{{ w }}</div> }
          @for (c of cells(); track c.date.getTime()) {
            <div class="mc-cell" [class.out]="!c.inMonth" [class.today]="c.today" [class.selected]="selected() && sameDay(c.date, selected()!)" (click)="pick(c.date)">
              <span class="mc-num">{{ c.date.getDate() }}</span>
              @for (it of c.items.slice(0, maxPerDay()); track it.id) {
                <button type="button" class="mc-chip" [class.done]="it.done" [style.--tone]="color(it)" (click)="$event.stopPropagation(); itemClick.emit(it)" [matTooltip]="it.title">
                  <span class="mc-dot"></span>{{ it.title }}
                </button>
              }
              @if (c.items.length > maxPerDay()) { <span class="mc-more">+{{ c.items.length - maxPerDay() }} autre(s)</span> }
            </div>
          }
        </div>
        @if (showDayPanel()) {
          <aside class="mc-panel">
            <strong>{{ (selected() ?? today) | date: 'EEEE d MMMM' }}</strong>
            @for (it of dayItems(); track it.id) {
              <button type="button" class="mc-row" [style.--tone]="color(it)" (click)="itemClick.emit(it)">
                <span class="mc-dot"></span>
                <span class="mc-row-text"><b>{{ it.title }}</b><small>{{ it.ref }} @if (it.assignee) { · {{ it.assignee }} }</small></span>
              </button>
            } @empty { <span class="mc-none">Rien de prévu</span> }
          </aside>
        }
      </div>
    </div>
  `,
  styles: [`
    @import 'app/shared/components/planning/planning-shared';
    :host { display: block; min-width: 0; }
    .mc-nav { display: flex; align-items: center; gap: 4px; }
    .mc-title { min-width: 140px; text-align: center; font-family: 'Outfit', sans-serif; font-size: 15px; color: var(--text-primary); }
    .mc-layout { display: grid; grid-template-columns: 1fr; gap: 16px; &.with-panel { grid-template-columns: minmax(0, 1fr) 260px; } @media (max-width: 900px) { &.with-panel { grid-template-columns: 1fr; } } }
    .mc-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border: 1px solid var(--border-color); border-radius: var(--r-m); overflow: hidden; background: var(--card-bg); }
    .mc-wd { padding: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border-color); }
    .mc-cell {
      min-height: 96px; padding: 6px; display: flex; flex-direction: column; gap: 3px; cursor: pointer; min-width: 0;
      border-right: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);
      &:nth-child(7n) { border-right: none; }
      &:hover { background: var(--hover-bg); }
      &.out { background: color-mix(in srgb, var(--text-muted) 5%, transparent); .mc-num { color: var(--text-muted); } }
      &.selected { background: var(--primary-color-light); }
      &.today .mc-num { background: var(--primary-color); color: #fff; }
    }
    .mc-num { align-self: flex-start; min-width: 22px; height: 22px; padding: 0 4px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .mc-chip {
      display: flex; align-items: center; gap: 5px; width: 100%; padding: 2px 6px; border: none; border-radius: 6px; cursor: pointer; text-align: left;
      font: inherit; font-size: 11px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      background: color-mix(in srgb, var(--tone) 14%, transparent);
      &.done { opacity: .6; text-decoration: line-through; }
      .mc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tone); flex-shrink: 0; }
    }
    .mc-more { font-size: 10.5px; color: var(--text-muted); padding-left: 6px; }
    .mc-panel { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: var(--r-m); background: var(--hover-bg); align-self: start;
      > strong { font-family: 'Outfit', sans-serif; font-size: 14px; text-transform: capitalize; color: var(--text-primary); margin-bottom: 4px; } }
    .mc-row { display: flex; gap: 10px; align-items: center; padding: 8px; border: none; border-radius: 8px; cursor: pointer; text-align: left; font: inherit; background: var(--card-bg);
      .mc-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tone); flex-shrink: 0; }
      .mc-row-text { display: flex; flex-direction: column; min-width: 0; b { font-size: 12.5px; font-weight: 600; color: var(--text-primary); } small { font-size: 11px; color: var(--text-muted); } } }
    .mc-none { font-size: 12px; color: var(--text-muted); }
  `],
})
export class MonthCalendarComponent {
  items = input<PlanningItem[]>([]);
  month = model<Date>(new Date());
  selected = model<Date | null>(null);
  maxPerDay = input(3);
  showNavigation = input(true);
  showDayPanel = input(false);
  searchable = input(false);
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  filterState = model<PlanningFilterState>(EMPTY_FILTER_STATE);
  itemClick = output<PlanningItem>();
  dayClick = output<Date>();

  readonly today = new Date();
  readonly weekdays = WEEKDAYS_SHORT;
  readonly sameDay = sameDay;
  readonly color = itemColor;

  visible = computed(() => applyPlanningFilters(this.items(), this.filters(), this.filterState()));
  lateCount = computed(() => this.items().filter((i) => isLate(i)).length);
  title = computed(() => `${MONTHS[this.month().getMonth()]} ${this.month().getFullYear()}`);

  cells = computed(() => {
    const m = this.month();
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const start = startOfWeek(first);
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const weeks = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7);
    const items = this.visible();
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date, inMonth: date.getMonth() === m.getMonth(), today: sameDay(date, this.today),
        items: items.filter((it) => { const a = anchorDate(it); return !!a && sameDay(a, date); }),
      };
    });
  });

  dayItems = computed(() => {
    const d = this.selected() ?? this.today;
    return this.visible().filter((it) => { const a = anchorDate(it); return !!a && sameDay(a, d); });
  });

  shift(n: number) { const m = this.month(); this.month.set(new Date(m.getFullYear(), m.getMonth() + n, 1)); }
  goToday() { this.month.set(new Date()); this.selected.set(startOfDay(new Date())); }
  pick(d: Date) { this.selected.set(d); this.dayClick.emit(d); }
}
