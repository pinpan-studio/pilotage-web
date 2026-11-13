import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  forwardRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface SelectOption {
  value: any;
  label: string;
  icon?: string;
  color?: string;
  description?: string;
  count?: number;
  disabled?: boolean;
}

/**
 * Composant de sélection riche et personnalisable avec recherche intégrée,
 * reprenant l'esthétique et l'expérience de `app-filter-dropdown`.
 *
 * Compatible `ControlValueAccessor` (s'utilise avec `formControlName`, `[formControl]`, `[(ngModel)]`).
 *
 * Usage :
 * ```html
 * <app-searchable-select formControlName="type_requete" [options]="typeOptions" placeholder="Type de requête..." icon="category" />
 * ```
 */
@Component({
  selector: 'app-searchable-select, app-form-select, app-select',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, MatIconModule, MatTooltipModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() set options(val: any[]) {
    this._rawOptions.set(val || []);
  }
  @Input() placeholder = 'Sélectionner...';
  @Input() searchPlaceholder = 'Rechercher…';
  @Input() icon = '';
  @Input() clearable = false;
  @Input() allowNull = false;
  @Input() nullLabel = '— Aucun —';
  @Input() disabled = false;
  @Input() showCount = false;

  @Output() selectionChange = new EventEmitter<any>();

  @ViewChild('triggerEl', { read: ElementRef }) triggerEl?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private _rawOptions = signal<any[]>([]);
  value = signal<any>(null);
  isOpen = signal(false);
  searchTerm = signal('');
  highlightedIndex = signal(0);
  triggerWidth = signal<number>(0);

  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  /** Normalisation des options sous forme uniforme `SelectOption[]` */
  readonly normalizedOptions = computed<SelectOption[]>(() => {
    const raw = this._rawOptions();
    if (!raw || !Array.isArray(raw)) return [];

    const list: SelectOption[] = raw.map((item) => {
      if (item === null || item === undefined) {
        return { value: null, label: this.nullLabel };
      }
      if (typeof item === 'object') {
        return {
          value: item.value !== undefined ? item.value : (item._id !== undefined ? item._id : item),
          label: item.label || item.libelle || item.name || item.nom || item.fullname || String(item.value ?? ''),
          icon: item.icon,
          color: item.color,
          description: item.description,
          count: item.count,
          disabled: !!item.disabled,
        };
      }
      return { value: item, label: String(item) };
    });

    if (this.allowNull && !list.some((o) => o.value === null || o.value === '')) {
      return [{ value: null, label: this.nullLabel }, ...list];
    }

    return list;
  });

  /** Options filtrées selon le terme de recherche */
  readonly filteredOptions = computed<SelectOption[]>(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const opts = this.normalizedOptions();
    if (!q) return opts;
    return opts.filter((o) => {
      const labelMatch = (o.label || '').toLowerCase().includes(q);
      const descMatch = (o.description || '').toLowerCase().includes(q);
      return labelMatch || descMatch;
    });
  });

  /** Option actuellement sélectionnée */
  readonly selectedOption = computed<SelectOption | null>(() => {
    const v = this.value();
    const opts = this.normalizedOptions();
    if (v === null || v === undefined) return null;
    return opts.find((o) => o.value === v || String(o.value) === String(v)) || null;
  });

  /** Libellé affiché sur le trigger */
  readonly displayLabel = computed<string>(() => {
    const sel = this.selectedOption();
    if (sel) return sel.label;
    if (this.value() === null && this.allowNull) return this.nullLabel;
    return '';
  });

  private onChange: (v: any) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => {
          this.searchInput?.nativeElement.focus();
        }, 50);
      }
    });
  }

  toggle(): void {
    if (this.disabled) return;
    if (!this.isOpen()) {
      this.updateTriggerWidth();
      this.searchTerm.set('');
      this.highlightedIndex.set(0);
      this.isOpen.set(true);
    } else {
      this.close();
    }
  }

  open(): void {
    if (this.disabled || this.isOpen()) return;
    this.updateTriggerWidth();
    this.searchTerm.set('');
    this.highlightedIndex.set(0);
    this.isOpen.set(true);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.searchTerm.set('');
    this.onTouched();
  }

  select(option: SelectOption): void {
    if (option.disabled) return;
    this.value.set(option.value);
    this.onChange(option.value);
    this.selectionChange.emit(option.value);
    this.close();
  }

  clear(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.value.set(null);
    this.onChange(null);
    this.selectionChange.emit(null);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.highlightedIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'Enter' || event.key === 'ArrowDown' || event.key === ' ') {
        event.preventDefault();
        this.open();
      }
      return;
    }

    const opts = this.filteredOptions();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (this.highlightedIndex() + 1) % (opts.length || 1);
      this.highlightedIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (this.highlightedIndex() - 1 + opts.length) % (opts.length || 1);
      this.highlightedIndex.set(prev);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = opts[this.highlightedIndex()];
      if (current) {
        this.select(current);
      }
    }
  }

  private updateTriggerWidth(): void {
    if (this.triggerEl?.nativeElement) {
      const rect = this.triggerEl.nativeElement.getBoundingClientRect();
      this.triggerWidth.set(rect.width || this.triggerEl.nativeElement.offsetWidth);
    }
  }

  // --- ControlValueAccessor ---
  writeValue(obj: any): void {
    this.value.set(obj);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
