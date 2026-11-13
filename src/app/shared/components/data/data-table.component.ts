import { Component, TemplateRef, booleanAttribute, computed, contentChild, effect, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

export type DataCellType = 'text' | 'number' | 'currency' | 'date' | 'badge' | 'progress' | 'mono';

export interface DataColumn<T = any> {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  /** Colonne figée à gauche (`start`) ou à droite (`end`). */
  sticky?: 'start' | 'end';
  align?: 'left' | 'right' | 'center';
  type?: DataCellType;
  sortable?: boolean;
  /** Édition en ligne au double-clic. */
  editable?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  /** Masquée par défaut (réactivable via le menu Colonnes). */
  hidden?: boolean;
  /** Non masquable. */
  required?: boolean;
  /** Couleur d'un badge selon la valeur (token : success, warning…). */
  tone?: (row: T) => string;
  format?: (row: T) => string;
  /** Total en pied de tableau (somme des lignes filtrées). */
  total?: boolean;
}

export interface BulkAction { id: string; label: string; icon: string; tone?: 'error' | 'primary'; }
export interface CellEditEvent<T = any> { row: T; key: string; value: unknown; previous: unknown; }

/**
 * Table de données avancée (sans dépendance) : en-tête et colonnes figés, redimensionnement à la souris,
 * colonnes masquables, tri, sélection multiple (Maj+clic pour une plage) avec barre d'actions groupées,
 * lignes dépliables (`<ng-template #expanded let-row>`), édition en ligne (double-clic, Entrée / Échap),
 * totaux, densité et pagination.
 *
 * ```html
 * <app-data-table [rows]="clients" [columns]="cols" rowKey="_id" selectable [bulkActions]="actions"
 *   (bulkAction)="onBulk($event)" (cellEdit)="save($event)">
 *   <ng-template #expanded let-row>…</ng-template>
 * </app-data-table>
 * ```
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.scss'],
})
export class DataTableComponent<T extends Record<string, any> = any> {
  rows = input<T[]>([]);
  columns = input<DataColumn<T>[]>([]);
  rowKey = input('id');
  selectable = input(false, { transform: booleanAttribute });
  bulkActions = input<BulkAction[]>([]);
  pageSize = input(10);
  maxHeight = input('520px');
  title = input('');
  /** Recherche plein texte dans la barre d'outils. */
  searchable = input(true, { transform: booleanAttribute });
  /** Lignes cliquables : émet `rowClick` au clic sur une cellule de données. */
  clickable = input(false, { transform: booleanAttribute });

  bulkAction = output<{ action: string; rows: T[] }>();
  cellEdit = output<CellEditEvent<T>>();
  selectionChange = output<T[]>();
  rowClick = output<T>();

  expandedTpl = contentChild<TemplateRef<unknown>>('expanded');

  // ── État ─────────────────────────────────────────────
  widths = signal<Record<string, number>>({});
  hidden = signal<Set<string>>(new Set());
  sort = signal<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  selected = signal<Set<unknown>>(new Set());
  expanded = signal<Set<unknown>>(new Set());
  editing = signal<{ id: unknown; key: string } | null>(null);
  edits = signal<Map<unknown, Partial<T>>>(new Map());
  query = signal('');
  page = signal(0);
  density = signal<'compact' | 'normal' | 'comfortable'>('normal');
  readonly Math = Math;
  private anchor: unknown = null;

  constructor() {
    effect(() => {
      const cols = this.columns();
      this.widths.set(Object.fromEntries(cols.map((c) => [c.key, c.width ?? 160])));
      this.hidden.set(new Set(cols.filter((c) => c.hidden).map((c) => c.key)));
    });
    effect(() => { this.query(); this.sort(); this.page.set(0); });
  }

  id(r: T): unknown { return r[this.rowKey()]; }
  value(r: T, key: string): any { const e = this.edits().get(this.id(r)); return e && key in e ? (e as any)[key] : r[key]; }

  visibleCols = computed(() => {
    const cols = this.columns().filter((c) => !this.hidden().has(c.key));
    return [...cols.filter((c) => c.sticky === 'start'), ...cols.filter((c) => !c.sticky), ...cols.filter((c) => c.sticky === 'end')];
  });
  /** Décalages des colonnes figées (px), en tenant compte des colonnes techniques. */
  offsets = computed(() => {
    const res: Record<string, number> = {};
    let left = (this.selectable() ? 44 : 0) + (this.expandedTpl() ? 40 : 0);
    for (const c of this.visibleCols().filter((x) => x.sticky === 'start')) { res[c.key] = left; left += this.widths()[c.key]; }
    let right = 0;
    for (const c of [...this.visibleCols().filter((x) => x.sticky === 'end')].reverse()) { res[c.key] = right; right += this.widths()[c.key]; }
    return res;
  });
  lastStart = computed(() => this.visibleCols().filter((c) => c.sticky === 'start').at(-1)?.key);
  firstEnd = computed(() => this.visibleCols().find((c) => c.sticky === 'end')?.key);
  tableWidth = computed(() => this.visibleCols().reduce((s, c) => s + this.widths()[c.key], (this.selectable() ? 44 : 0) + (this.expandedTpl() ? 40 : 0)));

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    let list = this.rows();
    if (q) list = list.filter((r) => this.columns().some((c) => String(this.display(r, c)).toLowerCase().includes(q)));
    const s = this.sort();
    if (s) {
      const k = s.key, m = s.dir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const x = this.value(a, k), y = this.value(b, k);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'fr', { numeric: true })) * m;
      });
    }
    return list;
  });
  pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize())));
  pageRows = computed(() => this.filtered().slice(this.page() * this.pageSize(), (this.page() + 1) * this.pageSize()));
  totals = computed(() => {
    const res: Record<string, number> = {};
    for (const c of this.columns().filter((x) => x.total)) res[c.key] = this.filtered().reduce((s, r) => s + (+this.value(r, c.key) || 0), 0);
    return res;
  });
  hasTotals = computed(() => this.columns().some((c) => c.total));
  selectedRows = computed(() => this.rows().filter((r) => this.selected().has(this.id(r))));
  allOnPage = computed(() => this.pageRows().length > 0 && this.pageRows().every((r) => this.selected().has(this.id(r))));
  someOnPage = computed(() => !this.allOnPage() && this.pageRows().some((r) => this.selected().has(this.id(r))));
  colSpan = computed(() => this.visibleCols().length + (this.selectable() ? 1 : 0) + (this.expandedTpl() ? 1 : 0));

  // ── Affichage ────────────────────────────────────────
  display(r: T, c: DataColumn<T>): string {
    if (c.format) return c.format({ ...r, ...(this.edits().get(this.id(r)) ?? {}) } as T);
    const v = this.value(r, c.key);
    if (v === null || v === undefined || v === '') return '';
    switch (c.type) {
      case 'number': return Number(v).toLocaleString('fr-FR');
      case 'currency': return `${Number(v).toLocaleString('fr-FR')} F`;
      case 'date': return new Date(v).toLocaleDateString('fr-FR');
      case 'progress': return `${v} %`;
      default: return c.options?.find((o) => o.value === v)?.label ?? String(v);
    }
  }
  fmtTotal(c: DataColumn<T>): string {
    const v = this.totals()[c.key];
    return c.type === 'currency' ? `${v.toLocaleString('fr-FR')} F` : v.toLocaleString('fr-FR');
  }
  align(c: DataColumn<T>): string { return c.align ?? (c.type === 'number' || c.type === 'currency' ? 'right' : 'left'); }

  // ── Tri ──────────────────────────────────────────────
  toggleSort(c: DataColumn<T>): void {
    if (c.sortable === false) return;
    const s = this.sort();
    this.sort.set(!s || s.key !== c.key ? { key: c.key, dir: 'asc' } : s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null);
  }

  // ── Colonnes ─────────────────────────────────────────
  toggleCol(key: string): void { this.hidden.update((h) => { const n = new Set(h); n.has(key) ? n.delete(key) : n.add(key); return n; }); }
  resetCols(): void {
    this.hidden.set(new Set(this.columns().filter((c) => c.hidden).map((c) => c.key)));
    this.widths.set(Object.fromEntries(this.columns().map((c) => [c.key, c.width ?? 160])));
  }
  resizeStart(c: DataColumn<T>, e: PointerEvent): void {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, w0 = this.widths()[c.key], min = c.minWidth ?? 70;
    const move = (ev: PointerEvent) => this.widths.update((w) => ({ ...w, [c.key]: Math.max(min, w0 + ev.clientX - sx) }));
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
  }
  autoFit(c: DataColumn<T>): void {
    const longest = Math.max(c.label.length, ...this.filtered().map((r) => this.display(r, c).length));
    this.widths.update((w) => ({ ...w, [c.key]: Math.min(420, Math.max(c.minWidth ?? 70, longest * 8 + 40)) }));
  }

  // ── Sélection ────────────────────────────────────────
  private emitSel(s: Set<unknown>): void { this.selected.set(s); this.selectionChange.emit(this.selectedRows()); }
  toggleRow(r: T, e: MouseEvent): void {
    const n = new Set(this.selected()), id = this.id(r);
    if (e.shiftKey && this.anchor !== null) {
      const ids = this.filtered().map((x) => this.id(x));
      const a = ids.indexOf(this.anchor), b = ids.indexOf(id);
      if (a >= 0 && b >= 0) ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => n.add(x));
    } else { n.has(id) ? n.delete(id) : n.add(id); this.anchor = id; }
    this.emitSel(n);
  }
  togglePage(): void {
    const n = new Set(this.selected()), all = this.allOnPage();
    this.pageRows().forEach((r) => (all ? n.delete(this.id(r)) : n.add(this.id(r))));
    this.emitSel(n);
  }
  selectAllFiltered(): void { this.emitSel(new Set(this.filtered().map((r) => this.id(r)))); }
  clearSel(): void { this.emitSel(new Set()); }
  runBulk(a: BulkAction): void { this.bulkAction.emit({ action: a.id, rows: this.selectedRows() }); }

  // ── Dépli ────────────────────────────────────────────
  toggleExpand(r: T): void { this.expanded.update((s) => { const n = new Set(s), id = this.id(r); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  // ── Édition ──────────────────────────────────────────
  isEditing(r: T, c: DataColumn<T>): boolean { const e = this.editing(); return !!e && e.id === this.id(r) && e.key === c.key; }
  startEdit(r: T, c: DataColumn<T>): void {
    if (!c.editable) return;
    this.editing.set({ id: this.id(r), key: c.key });
    setTimeout(() => (document.querySelector('.dt-edit-input') as HTMLInputElement | null)?.focus?.());
  }
  commitEdit(r: T, c: DataColumn<T>, raw: string): void {
    if (!this.isEditing(r, c)) return;
    const previous = this.value(r, c.key);
    const value = c.editable === 'number' ? (raw === '' ? null : Number(raw.replace(/\s/g, '').replace(',', '.'))) : raw;
    this.editing.set(null);
    if (value === previous || (c.editable === 'number' && value !== null && isNaN(value as number))) return;
    this.edits.update((m) => new Map(m).set(this.id(r), { ...(m.get(this.id(r)) ?? {}), [c.key]: value } as Partial<T>));
    this.cellEdit.emit({ row: r, key: c.key, value, previous });
  }
  isEdited(r: T, c: DataColumn<T>): boolean { const e = this.edits().get(this.id(r)); return !!e && c.key in e; }
  cancelEdit(): void { this.editing.set(null); }
  editKey(r: T, c: DataColumn<T>, e: KeyboardEvent): void {
    if (e.key === 'Enter') this.commitEdit(r, c, (e.target as HTMLInputElement).value);
    else if (e.key === 'Escape') this.cancelEdit();
  }

  /** Export CSV des lignes filtrées et colonnes visibles (séparateur « ; » pour Excel FR). */
  exportCsv(): void {
    const cols = this.visibleCols();
    const esc = (s: string) => /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const lines = [cols.map((c) => esc(c.label)).join(';'), ...this.filtered().map((r) => cols.map((c) => esc(this.display(r, c))).join(';'))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${this.title() || 'export'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
