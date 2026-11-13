import { Component, computed, input, model, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PlanningToolbarComponent } from './planning-toolbar.component';
import { NoteGridComponent } from './note-grid.component';
import {
  EMPTY_FILTER_STATE, PlanningFilter, PlanningFilterState, PlanningGroup, PlanningItem,
  applyPlanningFilters, initials, isLate, itemColor,
} from './planning.models';

/**
 * Vue groupée générique (par technicien, véhicule, client, équipe…) : en-tête de groupe avec
 * progression moyenne, terminés et retards, puis les éléments en notes ou en liste compacte.
 * Groupes déclarés via `groups`, sinon déduits de `item.group`.
 */
@Component({
  selector: 'app-grouped-board',
  standalone: true,
  imports: [DatePipe, MatIconModule, PlanningToolbarComponent, NoteGridComponent],
  template: `
    <div class="pl-stack">
      @if (searchable() || filters().length || lateToggle()) {
        <app-planning-toolbar [searchable]="searchable()" [filters]="filters()" [lateToggle]="lateToggle()" [lateCount]="lateCount()" [(state)]="filterState" />
      }
      @for (g of view(); track g.key) {
        <section class="gb-group">
          <header class="gb-head" (click)="toggle(g.key)">
            <span class="gb-avatar" [style.--tone]="g.color || 'var(--primary-color)'">
              @if (g.icon) { <mat-icon>{{ g.icon }}</mat-icon> } @else { {{ initials(g.label) }} }
            </span>
            <div class="gb-title">
              <strong>{{ g.label }}</strong>
              <span>{{ g.subtitle ?? (g.items.length + ' élément(s)') }}</span>
            </div>
            <div class="gb-stats">
              <span class="pl-pill" style="--tone: var(--success-color)">{{ g.done }} terminé(s)</span>
              @if (g.late) { <span class="pl-pill" style="--tone: var(--error-color)">{{ g.late }} en retard</span> }
              @if (showProgress()) {
                <div class="gb-progress"><div class="pl-progress"><div [style.width.%]="g.progress"></div></div><b>{{ g.progress }} %</b></div>
              }
            </div>
            @if (collapsible()) { <mat-icon class="gb-chevron">{{ collapsed().has(g.key) ? 'expand_more' : 'expand_less' }}</mat-icon> }
          </header>
          @if (!collapsed().has(g.key)) {
            @if (layout() === 'notes') {
              <app-note-grid [items]="g.items" [dense]="true" [minWidth]="200" [descriptionLines]="2" (itemClick)="itemClick.emit($event)" />
            } @else {
              <ul class="gb-list">
                @for (it of g.items; track it.id) {
                  <li (click)="itemClick.emit(it)" [style.--tone]="color(it)">
                    <span class="gb-dot"></span>
                    @if (it.ref) { <span class="gb-ref">{{ it.ref }}</span> }
                    <span class="gb-item-title" [class.done]="it.done">{{ it.title }}</span>
                    @if (it.due) { <span class="pl-due" [class.late]="late(it)"><mat-icon>event</mat-icon>{{ it.due | date: 'dd/MM' }}</span> }
                  </li>
                }
              </ul>
            }
          }
        </section>
      } @empty {
        <div class="pl-empty">Aucun élément</div>
      }
    </div>
  `,
  styles: [`
    @import 'app/shared/components/planning/planning-shared';
    :host { display: block; min-width: 0; }
    .gb-group { display: flex; flex-direction: column; gap: 10px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); &:last-of-type { border-bottom: none; } }
    .gb-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; cursor: pointer; padding: 4px 0; }
    .gb-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      font-size: 12px; font-weight: 700; color: var(--tone); background: color-mix(in srgb, var(--tone) 15%, transparent);
      mat-icon { font-size: 19px; width: 19px; height: 19px; } }
    .gb-title { display: flex; flex-direction: column; min-width: 140px; flex: 1;
      strong { font-family: 'Outfit', sans-serif; font-size: 15px; color: var(--text-primary); } span { font-size: 12px; color: var(--text-muted); } }
    .gb-stats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .gb-progress { display: flex; align-items: center; gap: 8px; .pl-progress { width: 90px; height: 5px; } b { font-size: 12px; color: var(--text-secondary); } }
    .gb-chevron { color: var(--text-muted); }
    .gb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;
      li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px;
        &:hover { background: var(--hover-bg); } }
      .gb-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tone); flex-shrink: 0; }
      .gb-ref { font-size: 11px; font-weight: 700; color: var(--text-muted); }
      .gb-item-title { flex: 1; color: var(--text-primary); &.done { text-decoration: line-through; color: var(--text-muted); } } }
  `],
})
export class GroupedBoardComponent {
  items = input<PlanningItem[]>([]);
  groups = input<PlanningGroup[] | null>(null);
  layout = input<'notes' | 'list'>('notes');
  showProgress = input(true);
  collapsible = input(true);
  /** Libellé du groupe des éléments sans `group`. */
  ungroupedLabel = input('Non assigné');
  searchable = input(false);
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  filterState = model<PlanningFilterState>(EMPTY_FILTER_STATE);
  itemClick = output<PlanningItem>();

  readonly initials = initials;
  readonly color = itemColor;
  late = (i: PlanningItem) => isLate(i);
  collapsed = signal<Set<string>>(new Set());
  lateCount = computed(() => this.items().filter((i) => isLate(i)).length);

  view = computed(() => {
    const items = applyPlanningFilters(this.items(), this.filters(), this.filterState());
    const declared = this.groups();
    const keys = declared?.length ? declared : [...new Set(items.map((i) => i.group ?? ''))].map((k) => ({ key: k, label: k || this.ungroupedLabel() }) as PlanningGroup);
    return keys.map((g) => {
      const own = items.filter((i) => (i.group ?? '') === g.key);
      const progress = own.length ? Math.round(own.reduce((s, i) => s + (i.done ? 100 : i.progress ?? 0), 0) / own.length) : 0;
      return { ...g, items: own, done: own.filter((i) => i.done).length, late: own.filter((i) => isLate(i)).length, progress };
    }).filter((g) => g.items.length);
  });

  toggle(key: string) {
    if (!this.collapsible()) return;
    const s = new Set(this.collapsed());
    s.has(key) ? s.delete(key) : s.add(key);
    this.collapsed.set(s);
  }
}
