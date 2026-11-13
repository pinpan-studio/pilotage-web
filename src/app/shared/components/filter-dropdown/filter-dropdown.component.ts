import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface FilterOption {
  value: any;
  label: string;
  icon?: string;
  color?: string;
  count?: number;
}

/**
 * Sélecteur de filtre riche avec popover CDK Overlay recherchable.
 *
 * Remplace l'ancien menu déroulant basique : au lieu d'un simple mat-menu,
 * on ouvre un popover CDK Overlay ancré au déclencheur, avec champ de recherche,
 * mise en surbrillance, indicateur de sélection active et nettoyage rapide.
 */
@Component({
  selector: 'app-filter-dropdown, pq-filter-select, app-filter-select',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, MatIconModule, MatTooltipModule],
  templateUrl: './filter-dropdown.component.html',
  styleUrls: ['./filter-dropdown.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class FilterDropdownComponent {
  /** Liste des options */
  options = input.required<FilterOption[]>();
  value = model<any>();
  labelPrefix = input<string>('');
  /** Libellé de repli */
  placeholder = input<string>('Tous');
  customTriggerLabel = input<string>('');
  standalone = input<boolean>(false);
  disabled = input<boolean>(false);

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  open = signal(false);
  search = signal('');

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  /** Détermine si la 1ère option est une sentinelle "Tous / Toutes" */
  readonly hasSentinel = computed<boolean>(() => {
    const opts = this.options();
    if (!opts || opts.length === 0) return false;
    const first = opts[0];
    if (first.value === '' || first.value === 'all' || first.value === 'ALL' || first.value === null || first.value === undefined) {
      return true;
    }
    return typeof first.label === 'string' && /^(tous|toutes|all)\b/i.test(first.label.trim());
  });

  /** Option sentinelle « Tous » si présente */
  readonly sentinel = computed<FilterOption | null>(() => {
    return this.hasSentinel() ? (this.options()[0] ?? null) : null;
  });

  /** Options réelles (excluant la sentinelle) */
  readonly actualOptions = computed<FilterOption[]>(() => {
    const opts = this.options() || [];
    return this.hasSentinel() ? opts.slice(1) : opts;
  });

  /** Options réelles filtrées par le texte de recherche */
  readonly filtered = computed<FilterOption[]>(() => {
    const q = this.search().trim().toLowerCase();
    const rest = this.actualOptions();
    if (!q) return rest;
    return rest.filter((o) => (o.label || '').toLowerCase().includes(q));
  });

  readonly isActive = computed(() => {
    const v = this.value();
    if (v === null || v === undefined || v === '') return false;
    const s = this.sentinel()?.value;
    if (s !== undefined && (v === s || (s === 'ALL' && v === 'ALL') || (s === 'all' && v === 'all'))) return false;
    return true;
  });

  readonly currentLabel = computed(() => {
    if (this.customTriggerLabel()) {
      return this.customTriggerLabel();
    }
    const v = this.value();
    const opts = this.options() || [];
    const hit = opts.find((o) => o.value === v);
    if (hit) return hit.label;
    if (this.placeholder()) return this.placeholder();
    return opts[0]?.label || '';
  });

  readonly currentCount = computed(() => {
    const v = this.value();
    const opts = this.options() || [];
    const hit = opts.find((o) => o.value === v);
    return hit?.count;
  });

  readonly totalCount = computed(() => {
    const s = this.sentinel();
    if (s && s.count !== undefined) return s.count;
    return this.actualOptions().length;
  });

  constructor() {
    // Focus automatique du champ de recherche à l'ouverture
    effect(() => {
      if (this.open()) {
        setTimeout(() => this.searchInput()?.nativeElement.focus(), 50);
      }
    });
  }

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((o) => !o);
    if (!this.open()) this.search.set('');
  }

  close(): void {
    this.open.set(false);
    this.search.set('');
  }

  pick(v: any): void {
    this.value.set(v);
    this.close();
  }

  clear(): void {
    const s = this.sentinel();
    this.pick(s ? s.value : (this.options()[0]?.value ?? ''));
  }
}

// Alias pour compatibilité
export { FilterDropdownComponent as FilterSelectComponent };
