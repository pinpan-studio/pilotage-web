import { Component, computed, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FilterDropdownComponent, FilterOption } from '../filter-dropdown/filter-dropdown.component';
import { EMPTY_FILTER_STATE, PlanningFilter, PlanningFilterState } from './planning.models';

/**
 * Barre d'outils commune aux vues de planification. Chaque bloc est optionnel :
 * recherche (`searchable`), filtres déclaratifs (`filters`), bascule « en retard » (`lateToggle`).
 * Les contrôles propres à une vue (zoom, navigation…) sont projetés via `[toolbarEnd]`.
 */
@Component({
  selector: 'app-planning-toolbar',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, FilterDropdownComponent],
  template: `
    <div class="pl-toolbar">
      @if (searchable()) {
        <label class="pl-search">
          <mat-icon>search</mat-icon>
          <input [placeholder]="searchPlaceholder()" [value]="state().search" (input)="patch({ search: $any($event.target).value })" />
          @if (state().search) {
            <button type="button" class="pl-clear" (click)="patch({ search: '' })" aria-label="Effacer"><mat-icon>close</mat-icon></button>
          }
        </label>
      }
      @for (f of filters(); track f.key) {
        <app-filter-dropdown [options]="optionsFor(f)" [value]="state().values[f.key] ?? 'all'" (valueChange)="setFilter(f.key, $event)" [labelPrefix]="f.label" />
      }
      @if (lateToggle()) {
        <button type="button" class="pl-chip" [class.active]="state().lateOnly" (click)="patch({ lateOnly: !state().lateOnly })">
          <mat-icon>schedule</mat-icon> En retard
          @if (lateCount()) { <em>{{ lateCount() }}</em> }
        </button>
      }
      @if (activeCount()) {
        <button type="button" class="pl-reset" (click)="state.set(empty)" matTooltip="Réinitialiser les filtres"><mat-icon>filter_alt_off</mat-icon></button>
      }
      <span class="pl-spacer"></span>
      <ng-content select="[toolbarEnd]"></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pl-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .pl-spacer { flex: 1; }
    .pl-search {
      display: flex; align-items: center; gap: 6px; min-width: 220px; flex: 0 1 300px; height: 36px; padding: 0 6px 0 12px;
      border-radius: var(--r-full); background: var(--mat-sys-surface-container, var(--hover-bg)); color: var(--text-muted);
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font: inherit; font-size: 13px; color: var(--text-primary); }
      &:focus-within { box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 30%, transparent); }
    }
    .pl-clear { display: inline-flex; border: none; background: transparent; color: var(--text-muted); cursor: pointer; padding: 2px; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .pl-chip {
      display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border: none; cursor: pointer;
      border-radius: var(--r-full); background: var(--mat-sys-surface-container, var(--hover-bg)); color: var(--text-secondary);
      font: inherit; font-size: 12.5px; font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      em { font-style: normal; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: var(--r-full); background: var(--error-color); color: #fff; }
      &:hover { color: var(--text-primary); }
      &.active { background: var(--error-color-light); color: var(--error-color-text); }
    }
    .pl-reset { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: none; border-radius: 50%; cursor: pointer; background: transparent; color: var(--text-muted);
      mat-icon { font-size: 18px; width: 18px; height: 18px; } &:hover { background: var(--hover-bg); color: var(--error-color); } }
    :host ::ng-deep .pq-fs-trigger { border-color: transparent !important; box-shadow: none !important; background: var(--mat-sys-surface-container, var(--hover-bg)) !important; }
  `],
})
export class PlanningToolbarComponent {
  searchable = input(false);
  searchPlaceholder = input('Rechercher…');
  filters = input<PlanningFilter[]>([]);
  lateToggle = input(false);
  lateCount = input(0);
  state = model<PlanningFilterState>(EMPTY_FILTER_STATE);

  readonly empty = EMPTY_FILTER_STATE;
  activeCount = computed(() => {
    const s = this.state();
    return (s.search ? 1 : 0) + (s.lateOnly ? 1 : 0) + Object.values(s.values).filter((v) => v && v !== 'all').length;
  });

  optionsFor(f: PlanningFilter): FilterOption[] { return [{ value: 'all', label: f.allLabel ?? 'Tous' }, ...f.options]; }
  patch(p: Partial<PlanningFilterState>) { this.state.set({ ...this.state(), ...p }); }
  setFilter(key: string, value: string) { this.patch({ values: { ...this.state().values, [key]: value } }); }
}
