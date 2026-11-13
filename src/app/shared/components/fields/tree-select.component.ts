import { Component, ElementRef, booleanAttribute, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';

export interface TreeOption { value: string; label: string; icon?: string; children?: TreeOption[]; disabled?: boolean; }
interface FlatNode { node: TreeOption; depth: number; parent: string | null; hasChildren: boolean; }

/**
 * Sélection dans une arborescence (zones › villes › quartiers, catégories…) dans un panneau déroulant :
 * recherche (garde les ancêtres des correspondances), dépli / repli, sélection simple ou multiple avec
 * cases tri-état (cocher un parent coche ses descendants). Valeur : `string` ou `string[]` (feuilles).
 *
 * ```html
 * <app-tree-select [options]="zones" [multiple]="true" [(ngModel)]="quartiers" placeholder="Zones…" />
 * ```
 */
@Component({
  selector: 'app-tree-select',
  standalone: true,
  imports: [OverlayModule, MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TreeSelectComponent), multi: true }],
  template: `
    <div class="form-field kit-field">
      <button type="button" class="field-box ts-trigger" cdkOverlayOrigin #origin="cdkOverlayOrigin" (click)="toggle()" [disabled]="disabled()" [class.is-disabled]="disabled()">
        <mat-icon>{{ icon() }}</mat-icon>
        <span class="ts-value" [class.ph]="!selected().length">
          @if (!selected().length) { {{ placeholder() }} }
          @else if (multiple()) {
            @for (v of selected().slice(0, 2); track v) { <span class="ts-chip">{{ labelOf(v) }}</span> }
            @if (selected().length > 2) { <span class="ts-more">+{{ selected().length - 2 }}</span> }
          } @else { {{ pathOf(selected()[0]) }} }
        </span>
        @if (selected().length && clearable()) { <mat-icon class="ts-clear" (click)="clear($event)">close</mat-icon> }
        <mat-icon class="ts-arrow" [class.open]="open()">expand_more</mat-icon>
      </button>
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()" [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayMinWidth]="width()" (overlayOutsideClick)="open.set(false)" (detach)="open.set(false)" (overlayKeydown)="$event.key === 'Escape' && open.set(false)">
      <div class="kit-tree-panel">
        <div class="tp-search"><mat-icon>search</mat-icon><input #search placeholder="Rechercher…" [value]="query()" (input)="query.set($any($event.target).value)" />
          @if (query()) { <button type="button" (click)="query.set('')"><mat-icon>close</mat-icon></button> }</div>
        <div class="tp-list" role="tree">
          @for (f of visible(); track f.node.value) {
            <div class="tp-row" role="treeitem" [style.padding-left.px]="8 + f.depth * 20" [class.sel]="!multiple() && selected()[0] === f.node.value"
              [class.disabled]="f.node.disabled" [attr.aria-expanded]="f.hasChildren ? isOpen(f.node.value) : null" (click)="rowClick(f)">
              @if (f.hasChildren) {
                <button type="button" class="tp-exp" (click)="expand(f.node.value, $event)"><mat-icon [class.open]="isOpen(f.node.value)">chevron_right</mat-icon></button>
              } @else { <span class="tp-exp"></span> }
              @if (multiple()) {
                <span class="tp-check" [class.on]="state(f.node) === 'all'" [class.some]="state(f.node) === 'some'"></span>
              }
              @if (f.node.icon) { <mat-icon class="tp-icon">{{ f.node.icon }}</mat-icon> }
              <span class="tp-label" [innerHTML]="highlight(f.node.label)"></span>
              @if (f.hasChildren) { <span class="tp-count">{{ leaves(f.node).length }}</span> }
            </div>
          } @empty { <div class="tp-empty">Aucun résultat pour « {{ query() }} »</div> }
        </div>
        @if (multiple()) {
          <div class="tp-foot"><span>{{ selected().length }} sélectionné(s)</span><span class="spacer"></span>
            <button type="button" (click)="setValue([])">Tout effacer</button><button type="button" class="ok" (click)="open.set(false)">Valider</button></div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .ts-trigger { width: 100%; cursor: pointer; text-align: left; font: inherit; color: var(--text-primary); }
    .ts-value { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 14px; font-weight: 500;
      &.ph { color: var(--text-muted); font-weight: 400; } }
    .ts-chip { padding: 2px 8px; border-radius: 10px; background: var(--primary-color-light); color: var(--primary-color); font-size: 12px; font-weight: 600; }
    .ts-more { font-size: 12px; color: var(--text-muted); font-weight: 600; }
    .ts-clear { font-size: 18px !important; width: 18px !important; height: 18px !important; cursor: pointer; }
    .ts-arrow { transition: transform 0.2s ease; &.open { transform: rotate(180deg); } }
  `],
})
export class TreeSelectComponent implements ControlValueAccessor {
  options = input<TreeOption[]>([]);
  multiple = input(false, { transform: booleanAttribute });
  placeholder = input('Sélectionner…');
  icon = input('account_tree');
  clearable = input(true);
  /** Sélection simple : n'autoriser que les feuilles. */
  leafOnly = input(false, { transform: booleanAttribute });

  private originEl = viewChild('origin', { read: ElementRef });
  private searchEl = viewChild<ElementRef<HTMLInputElement>>('search');
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];
  open = signal(false);
  query = signal('');
  width = signal(280);
  selected = signal<string[]>([]);
  disabled = signal(false);
  private expanded = signal<Set<string>>(new Set());

  private flat = computed(() => {
    const out: FlatNode[] = [];
    const walk = (list: TreeOption[], depth: number, parent: string | null) =>
      list.forEach((n) => { out.push({ node: n, depth, parent, hasChildren: !!n.children?.length }); if (n.children) walk(n.children, depth + 1, n.value); });
    walk(this.options(), 0, null);
    return out;
  });
  private byValue = computed(() => new Map(this.flat().map((f) => [f.node.value, f])));
  private matches = computed(() => {
    const q = this.norm(this.query().trim());
    if (!q) return null;
    const keep = new Set<string>();
    for (const f of this.flat()) {
      if (!this.norm(f.node.label).includes(q)) continue;
      let cur: string | null = f.node.value;
      while (cur) { keep.add(cur); cur = this.byValue().get(cur)?.parent ?? null; }
    }
    return keep;
  });
  visible = computed(() => {
    const m = this.matches();
    return this.flat().filter((f) => {
      if (m) return m.has(f.node.value);
      let p = f.parent;
      while (p) { if (!this.expanded().has(p)) return false; p = this.byValue().get(p)?.parent ?? null; }
      return true;
    });
  });

  private onChange: (v: string | string[] | null) => void = () => {};
  private touched: () => void = () => {};

  private norm(s: string): string { return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(); }
  highlight(label: string): string {
    const esc = label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const q = this.query().trim();
    if (!q) return esc;
    const i = this.norm(label).indexOf(this.norm(q));
    return i < 0 ? esc : esc.slice(0, i) + '<mark>' + esc.slice(i, i + q.length) + '</mark>' + esc.slice(i + q.length);
  }
  isOpen(v: string): boolean { return !!this.matches() || this.expanded().has(v); }
  leaves(n: TreeOption): string[] { return n.children?.length ? n.children.flatMap((c) => this.leaves(c)) : [n.value]; }
  labelOf(v: string): string { return this.byValue().get(v)?.node.label ?? v; }
  pathOf(v: string): string {
    const parts: string[] = [];
    let cur: string | null = v;
    while (cur) { const f = this.byValue().get(cur); if (!f) break; parts.unshift(f.node.label); cur = f.parent; }
    return parts.join(' › ');
  }
  state(n: TreeOption): 'all' | 'some' | 'none' {
    const l = this.leaves(n), sel = new Set(this.selected());
    const c = l.filter((v) => sel.has(v)).length;
    return c === 0 ? 'none' : c === l.length ? 'all' : 'some';
  }

  toggle(): void {
    if (this.disabled()) return;
    this.width.set(Math.max(260, this.originEl()?.nativeElement.getBoundingClientRect().width ?? 280));
    this.open.set(!this.open());
    if (this.open()) setTimeout(() => this.searchEl()?.nativeElement.focus(), 30);
    else this.touched();
  }
  expand(v: string, e?: Event): void {
    e?.stopPropagation();
    this.expanded.update((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }
  rowClick(f: FlatNode): void {
    if (f.node.disabled) return;
    if (this.multiple()) {
      const l = this.leaves(f.node);
      const all = this.state(f.node) === 'all';
      const sel = new Set(this.selected());
      l.forEach((v) => (all ? sel.delete(v) : sel.add(v)));
      this.setValue([...sel]);
    } else if (f.hasChildren && this.leafOnly()) {
      this.expand(f.node.value);
    } else {
      this.setValue([f.node.value]);
      this.open.set(false);
    }
  }
  clear(e: Event): void { e.stopPropagation(); this.setValue([]); }
  setValue(v: string[]): void {
    this.selected.set(v);
    this.onChange(this.multiple() ? v : v[0] ?? null);
  }

  writeValue(v: string | string[] | null): void {
    const list = v == null ? [] : Array.isArray(v) ? v : [v];
    this.selected.set(list);
    // Déplie les ancêtres des valeurs sélectionnées.
    const exp = new Set(this.expanded());
    queueMicrotask(() => {
      for (const s of list) { let p = this.byValue().get(s)?.parent ?? null; while (p) { exp.add(p); p = this.byValue().get(p)?.parent ?? null; } }
      this.expanded.set(exp);
    });
  }
  registerOnChange(fn: (v: string | string[] | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
