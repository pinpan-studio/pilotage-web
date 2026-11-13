import { Component, computed, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanningToolbarComponent } from './planning-toolbar.component';
import {
  EMPTY_FILTER_STATE, PlanningFilter, PlanningFilterState, PlanningItem,
  applyPlanningFilters, initials, isLate, itemColor, toneVar,
} from './planning.models';

/**
 * Grille de notes (« pense-bête » flat) : une carte teintée par élément, couleur = `color` / `tone`.
 * Options : densité, nombre de lignes de description, barre d'outils.
 */
@Component({
  selector: 'app-note-grid',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatTooltipModule, PlanningToolbarComponent],
  template: `
    <div class="pl-stack">
      @if (searchable() || filters().length || lateToggle()) {
        <app-planning-toolbar [searchable]="searchable()" [filters]="filters()" [lateToggle]="lateToggle()" [lateCount]="lateCount()" [(state)]="filterState" />
      }
      <div class="ng-grid" [class.dense]="dense()" [style.--min.px]="minWidth()">
        @for (it of visible(); track it.id) {
          <div class="ng-note" [class.done]="it.done" [style.--tone]="color(it)" (click)="itemClick.emit(it)">
            <div class="ng-head">
              @if (it.ref) { <span class="ng-ref">{{ it.ref }}</span> }
              <span class="pl-spacer"></span>
              @if (it.badge) { <span class="pl-pill" [style.--tone]="toneVar(it.badge.tone)">{{ it.badge.label }}</span> }
            </div>
            <h4 class="ng-title">{{ it.title }}</h4>
            @if (it.description && descriptionLines() > 0) { <p class="ng-desc" [style.-webkit-line-clamp]="descriptionLines()">{{ it.description }}</p> }
            <div class="ng-foot">
              @if (it.due) { <span class="pl-due" [class.late]="late(it)"><mat-icon>event</mat-icon>{{ it.due | date: 'dd MMM' }}</span> }
              <span class="pl-spacer"></span>
              @if (it.done) { <mat-icon class="ng-done">check_circle</mat-icon> }
              @else if (it.progress != null) { <span class="ng-pct">{{ it.progress }} %</span> }
              @if (it.assignee) { <span class="pl-avatar" [matTooltip]="it.assignee">{{ initials(it.assignee) }}</span> }
            </div>
            @if (it.progress != null && !it.done) { <div class="pl-progress"><div [style.width.%]="it.progress"></div></div> }
          </div>
        } @empty {
          <div class="pl-empty ng-empty">{{ emptyLabel() }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    @import 'app/shared/components/planning/planning-shared';
    :host { display: block; min-width: 0; }
    .pl-spacer { flex: 1; }
    .ng-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--min, 220px), 1fr)); gap: 12px; }
    .ng-empty { grid-column: 1 / -1; }
    .ng-note {
      display: flex; flex-direction: column; gap: 8px; padding: 14px; cursor: pointer; min-height: 150px;
      border-radius: var(--r-m); background: color-mix(in srgb, var(--tone) 12%, var(--card-bg));
      transition: background .15s ease;
      &:hover { background: color-mix(in srgb, var(--tone) 18%, var(--card-bg)); }
      &.done { opacity: .7; .ng-title { text-decoration: line-through; color: var(--text-muted); } }
    }
    .dense .ng-note { min-height: 0; padding: 10px 12px; gap: 6px; }
    .ng-head { display: flex; align-items: center; gap: 6px; min-height: 18px; }
    .ng-ref { font-size: 11px; font-weight: 700; color: var(--tone); }
    .ng-title { margin: 0; font-family: 'Outfit', sans-serif; font-size: 14.5px; font-weight: 600; line-height: 1.35; color: var(--text-primary); }
    .ng-desc { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
    .ng-foot { margin-top: auto; display: flex; align-items: center; gap: 6px; }
    .ng-pct { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
    .ng-done { font-size: 18px; width: 18px; height: 18px; color: var(--success-color); }
    .pl-progress { background: color-mix(in srgb, var(--tone) 20%, transparent); }
  `],
})
export class NoteGridComponent {
  items = input<PlanningItem[]>([]);
  dense = input(false);
  /** Largeur minimale d'une carte (px). */
  minWidth = input(220);
  descriptionLines = input(3);
  emptyLabel = input('Aucun élément');
  searchable = input(false);
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  filterState = model<PlanningFilterState>(EMPTY_FILTER_STATE);
  itemClick = output<PlanningItem>();

  readonly initials = initials;
  readonly toneVar = toneVar;
  readonly color = itemColor;
  late = (i: PlanningItem) => isLate(i);
  visible = computed(() => applyPlanningFilters(this.items(), this.filters(), this.filterState()));
  lateCount = computed(() => this.items().filter((i) => isLate(i)).length);
}
