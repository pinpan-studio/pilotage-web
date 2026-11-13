import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface TransferItem { value: string; label: string; description?: string; icon?: string; disabled?: boolean; }

/**
 * Liste de transfert (deux colonnes) pour affecter des éléments : permissions, véhicules à un groupe,
 * membres d'une équipe. Recherche par colonne, sélection multiple (Maj+clic pour une plage),
 * boutons de transfert, glisser-déposer entre colonnes, double-clic pour transférer.
 * Valeur du modèle : `string[]` des éléments de droite.
 *
 * ```html
 * <app-transfer-list [items]="vehicules" [(ngModel)]="affectes" sourceTitle="Disponibles" targetTitle="Groupe Nord" />
 * ```
 */
@Component({
  selector: 'app-transfer-list',
  standalone: true,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, MatIconModule, MatTooltipModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TransferListComponent), multi: true }],
  template: `
    <div class="tl" cdkDropListGroup [class.disabled]="disabled()">
      @for (side of sides; track side) {
        <div class="tl-col">
          <div class="tl-head">
            <span class="tl-check" [class.on]="allChecked(side)" [class.some]="someChecked(side)" (click)="checkAll(side)" role="checkbox" [attr.aria-checked]="allChecked(side)"></span>
            <strong>{{ side === 'source' ? sourceTitle() : targetTitle() }}</strong>
            <span class="tl-count">{{ checkedIn(side).length ? checkedIn(side).length + ' / ' : '' }}{{ list(side).length }}</span>
          </div>
          <div class="tl-search"><mat-icon>search</mat-icon>
            <input placeholder="Filtrer…" [value]="q()[side]" (input)="setQ(side, $any($event.target).value)" /></div>
          <div class="tl-list" cdkDropList [cdkDropListData]="side" (cdkDropListDropped)="drop($event)">
            @for (it of filtered(side); track it.value) {
              <div class="tl-item" cdkDrag [cdkDragData]="it.value" [cdkDragDisabled]="it.disabled || disabled()" [class.on]="checked().has(it.value)" [class.disabled]="it.disabled"
                (click)="check(side, it, $event)" (dblclick)="moveOne(side, it)">
                <span class="tl-check" [class.on]="checked().has(it.value)"></span>
                @if (it.icon) { <mat-icon class="ic">{{ it.icon }}</mat-icon> }
                <span class="txt"><span>{{ it.label }}</span>@if (it.description) { <small>{{ it.description }}</small> }</span>
                <mat-icon class="grip">drag_indicator</mat-icon>
              </div>
            } @empty {
              <div class="tl-empty"><mat-icon>{{ q()[side] ? 'search_off' : 'inbox' }}</mat-icon>{{ q()[side] ? 'Aucun résultat' : side === 'source' ? 'Tout est affecté' : 'Glissez des éléments ici' }}</div>
            }
          </div>
        </div>
        @if (side === 'source') {
          <div class="tl-actions">
            <button type="button" (click)="moveAll('target')" [disabled]="!list('source').length || disabled()" matTooltip="Tout ajouter"><mat-icon>keyboard_double_arrow_right</mat-icon></button>
            <button type="button" class="pri" (click)="moveChecked('source')" [disabled]="!checkedIn('source').length || disabled()" matTooltip="Ajouter la sélection"><mat-icon>chevron_right</mat-icon></button>
            <button type="button" class="pri" (click)="moveChecked('target')" [disabled]="!checkedIn('target').length || disabled()" matTooltip="Retirer la sélection"><mat-icon>chevron_left</mat-icon></button>
            <button type="button" (click)="moveAll('source')" [disabled]="!list('target').length || disabled()" matTooltip="Tout retirer"><mat-icon>keyboard_double_arrow_left</mat-icon></button>
          </div>
        }
      }
    </div>
  `,
  styleUrls: ['./transfer-list.component.scss'],
})
export class TransferListComponent implements ControlValueAccessor {
  items = input<TransferItem[]>([]);
  sourceTitle = input('Disponibles');
  targetTitle = input('Sélectionnés');

  readonly sides = ['source', 'target'] as const;
  target = signal<string[]>([]);
  checked = signal<Set<string>>(new Set());
  q = signal<Record<'source' | 'target', string>>({ source: '', target: '' });
  disabled = signal(false);
  private anchor: string | null = null;

  private targetSet = computed(() => new Set(this.target()));
  private lists = computed(() => ({
    source: this.items().filter((i) => !this.targetSet().has(i.value)),
    target: this.target().map((v) => this.items().find((i) => i.value === v)).filter((i): i is TransferItem => !!i),
  }));

  private onChange: (v: string[]) => void = () => {};
  private touched: () => void = () => {};

  list(side: 'source' | 'target'): TransferItem[] { return this.lists()[side]; }
  filtered(side: 'source' | 'target'): TransferItem[] {
    const q = this.q()[side].trim().toLowerCase();
    return q ? this.list(side).filter((i) => (i.label + ' ' + (i.description ?? '')).toLowerCase().includes(q)) : this.list(side);
  }
  setQ(side: 'source' | 'target', v: string): void { this.q.update((s) => ({ ...s, [side]: v })); }
  checkedIn(side: 'source' | 'target'): string[] { return this.list(side).filter((i) => this.checked().has(i.value)).map((i) => i.value); }
  private selectable(side: 'source' | 'target'): TransferItem[] { return this.filtered(side).filter((i) => !i.disabled); }
  allChecked(side: 'source' | 'target'): boolean { const s = this.selectable(side); return !!s.length && s.every((i) => this.checked().has(i.value)); }
  someChecked(side: 'source' | 'target'): boolean { return !this.allChecked(side) && this.selectable(side).some((i) => this.checked().has(i.value)); }

  checkAll(side: 'source' | 'target'): void {
    const all = this.allChecked(side);
    const next = new Set(this.checked());
    this.selectable(side).forEach((i) => (all ? next.delete(i.value) : next.add(i.value)));
    this.checked.set(next);
  }
  check(side: 'source' | 'target', it: TransferItem, e: MouseEvent): void {
    if (it.disabled || this.disabled()) return;
    const next = new Set(this.checked());
    const list = this.selectable(side);
    if (e.shiftKey && this.anchor) {
      const a = list.findIndex((i) => i.value === this.anchor), b = list.findIndex((i) => i.value === it.value);
      if (a >= 0 && b >= 0) list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((i) => next.add(i.value));
    } else {
      next.has(it.value) ? next.delete(it.value) : next.add(it.value);
      this.anchor = it.value;
    }
    this.checked.set(next);
  }

  private commit(target: string[]): void { this.target.set(target); this.onChange(target); this.touched(); }
  private move(values: string[], to: 'source' | 'target', index?: number): void {
    const cur = this.target().filter((v) => !values.includes(v));
    if (to === 'target') { const at = index ?? cur.length; cur.splice(at, 0, ...values); }
    const next = new Set(this.checked());
    values.forEach((v) => next.delete(v));
    this.checked.set(next);
    this.commit(cur);
  }
  moveChecked(from: 'source' | 'target'): void { this.move(this.checkedIn(from), from === 'source' ? 'target' : 'source'); }
  moveAll(to: 'source' | 'target'): void {
    const from = to === 'target' ? 'source' : 'target';
    this.move(this.filtered(from).filter((i) => !i.disabled).map((i) => i.value), to);
  }
  moveOne(side: 'source' | 'target', it: TransferItem): void { if (!it.disabled && !this.disabled()) this.move([it.value], side === 'source' ? 'target' : 'source'); }

  drop(e: CdkDragDrop<'source' | 'target'>): void {
    const v = e.item.data as string;
    const to = e.container.data;
    if (e.previousContainer === e.container) {
      if (to !== 'target' || this.q().target) return;
      const arr = [...this.target()];
      arr.splice(e.previousIndex, 1);
      arr.splice(e.currentIndex, 0, v);
      this.commit(arr);
      return;
    }
    // Déplace aussi les autres éléments cochés de la colonne d'origine.
    const from = e.previousContainer.data;
    const values = this.checked().has(v) ? this.checkedIn(from) : [v];
    this.move(values, to, to === 'target' ? e.currentIndex : undefined);
  }

  writeValue(v: string[] | null): void { this.target.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
