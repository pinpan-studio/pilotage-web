import { Component, TemplateRef, computed, effect, input, model, output, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PlanningToolbarComponent } from './planning-toolbar.component';
import {
  EMPTY_FILTER_STATE, PlanningColumn, PlanningFilter, PlanningFilterState, PlanningItem,
  applyPlanningFilters, initials, isLate, itemColor, toneVar,
} from './planning.models';

export interface KanbanMove { item: PlanningItem; from: string; to: string; index: number; }

/**
 * Kanban générique : colonnes déclarées (`columns`), éléments rangés par `item.status`.
 * Options : lecture seule, barre d'outils (recherche / filtres / retard), limite par colonne,
 * gabarit de carte personnalisé (`cardTemplate`, contexte `$implicit` = PlanningItem).
 */
@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, DragDropModule, MatIconModule, MatTooltipModule, PlanningToolbarComponent],
  template: `
    <div class="pl-stack">
      @if (searchable() || filters().length || lateToggle()) {
        <app-planning-toolbar [searchable]="searchable()" [filters]="filters()" [lateToggle]="lateToggle()" [lateCount]="lateCount()" [(state)]="filterState" />
      }
      <div class="kb-board" cdkDropListGroup>
        @for (col of board(); track col.column.key) {
          <div class="kb-col">
            <div class="kb-col-head">
              <span class="kb-dot" [style.background]="col.column.color || 'var(--text-muted)'"></span>
              <span class="kb-col-name">{{ col.column.label }}</span>
              <em class="pl-count" [class.over]="wipLimit() && col.total > wipLimit()!">{{ col.total }}@if (wipLimit()) {/{{ wipLimit() }}}</em>
            </div>
            <div class="kb-col-body" cdkDropList [id]="'kb-' + col.column.key" [cdkDropListData]="col.column.key"
              [cdkDropListDisabled]="readonly()" (cdkDropListDropped)="drop($event)">
              @for (it of col.items; track it.id) {
                <div class="kb-card" [class.readonly]="readonly()" [class.done]="it.done" cdkDrag [cdkDragData]="it" (click)="itemClick.emit(it)"
                  [style.--tone]="color(it)">
                  @if (cardTemplate(); as tpl) {
                    <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: it }" />
                  } @else {
                    <div class="kb-card-top">
                      @if (it.ref) { <span class="kb-ref">{{ it.ref }}</span> }
                      @if (it.assignee) { <span class="pl-avatar" [matTooltip]="it.assignee">{{ initials(it.assignee) }}</span> }
                    </div>
                    <span class="kb-title">{{ it.title }}</span>
                    @if (it.badge || it.due || it.tags?.length) {
                      <div class="kb-meta">
                        @if (it.badge) { <span class="pl-pill" [style.--tone]="toneVar(it.badge.tone)">{{ it.badge.label }}</span> }
                        @for (t of it.tags ?? []; track t) { <span class="pl-pill" style="--tone: var(--text-muted)">{{ t }}</span> }
                        @if (it.due) { <span class="pl-due" [class.late]="late(it)"><mat-icon>event</mat-icon>{{ it.due | date: 'dd/MM' }}</span> }
                      </div>
                    }
                    @if (it.progress) { <div class="pl-progress"><div [style.width.%]="it.progress"></div></div> }
                  }
                  <div class="kb-placeholder" *cdkDragPlaceholder></div>
                </div>
              } @empty {
                <div class="pl-empty">{{ emptyLabel() }}</div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./kanban-board.component.scss'],
})
export class KanbanBoardComponent {
  columns = input.required<PlanningColumn[]>();
  items = input<PlanningItem[]>([]);
  readonly = input(false);
  /** Limite indicative par colonne (le compteur passe en rouge au-delà). */
  wipLimit = input<number | null>(null);
  emptyLabel = input('Déposez une carte ici');
  cardTemplate = input<TemplateRef<{ $implicit: PlanningItem }> | null>(null);
  searchable = input(false);
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  filterState = model<PlanningFilterState>(EMPTY_FILTER_STATE);

  itemClick = output<PlanningItem>();
  itemMoved = output<KanbanMove>();

  /** Copie locale réordonnable (l'ordre des éléments dans `items` fait foi au départ). */
  private local = signal<PlanningItem[]>([]);
  constructor() { effect(() => this.local.set(this.items().map((i) => ({ ...i })))); }

  readonly initials = initials;
  readonly toneVar = toneVar;
  color = itemColor;
  late = (i: PlanningItem) => isLate(i);

  lateCount = computed(() => this.local().filter((i) => isLate(i)).length);
  board = computed(() => {
    const visible = new Set(applyPlanningFilters(this.local(), this.filters(), this.filterState()).map((i) => i.id));
    return this.columns().map((column) => {
      const all = this.local().filter((i) => i.status === column.key);
      return { column, total: all.length, items: all.filter((i) => visible.has(i.id)) };
    });
  });

  drop(e: CdkDragDrop<string, string, PlanningItem>): void {
    const item = e.item.data;
    const from = e.previousContainer.data;
    const to = e.container.data;
    if (from === to && e.previousIndex === e.currentIndex) return;
    const list = this.local().filter((i) => i.id !== item.id);
    const moved = { ...item, status: to };
    // Position d'insertion : avant l'élément visible situé à `currentIndex` dans la colonne cible.
    const target = this.board().find((c) => c.column.key === to)!.items.filter((i) => i.id !== item.id)[e.currentIndex];
    const at = target ? list.findIndex((i) => i.id === target.id) : list.length;
    list.splice(at, 0, moved);
    this.local.set(list);
    this.itemMoved.emit({ item: moved, from, to, index: e.currentIndex });
  }
}
