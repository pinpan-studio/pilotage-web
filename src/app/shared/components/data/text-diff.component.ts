import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DiffLine, diffLines } from '../../utils/diff.util';

interface Row { kind: 'line'; line: DiffLine; }
interface Fold { kind: 'fold'; id: number; count: number; }
interface SplitRow { kind: 'pair'; left: DiffLine | null; right: DiffLine | null; }

/**
 * Comparaison de deux textes (contrat, configuration, notes) : vue unifiée ou côte à côte,
 * mots modifiés surlignés, numéros de ligne, lignes inchangées repliées autour du contexte.
 *
 * ```html
 * <app-text-diff [before]="v1" [after]="v2" mode="split" [context]="2" />
 * ```
 */
@Component({
  selector: 'app-text-diff',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="df">
      <div class="df-head">
        @if (title()) { <strong>{{ title() }}</strong> }
        <span class="df-stat add">+{{ stats().add }}</span><span class="df-stat del">−{{ stats().del }}</span>
        <span class="spacer"></span>
        <div class="df-toggle">
          <button type="button" [class.on]="view() === 'unified'" (click)="view.set('unified')">Unifiée</button>
          <button type="button" [class.on]="view() === 'split'" (click)="view.set('split')">Côte à côte</button>
        </div>
      </div>
      <div class="df-body">
        @if (!stats().add && !stats().del) { <div class="df-same"><mat-icon>check_circle</mat-icon>Aucune différence</div> }
        @else if (view() === 'unified') {
          <table class="df-table">
            @for (r of rows(); track $index) {
              @if (r.kind === 'fold') {
                <tr class="fold"><td colspan="4"><button type="button" (click)="unfold(r.id)"><mat-icon>unfold_more</mat-icon>{{ r.count }} ligne(s) identique(s)</button></td></tr>
              } @else {
                <tr [class]="r.line.op">
                  <td class="no">{{ r.line.oldNo ?? '' }}</td><td class="no">{{ r.line.newNo ?? '' }}</td>
                  <td class="sign">{{ r.line.op === 'add' ? '+' : r.line.op === 'del' ? '−' : '' }}</td>
                  <td class="code">@if (r.line.parts) { @for (p of r.line.parts; track $index) { <span [class.hl]="p.changed">{{ p.text }}</span> } } @else { {{ r.line.text || ' ' }} }</td>
                </tr>
              }
            }
          </table>
        } @else {
          <table class="df-table split">
            @for (r of splitRows(); track $index) {
              @if (r.kind === 'fold') {
                <tr class="fold"><td colspan="4"><button type="button" (click)="unfold(r.id)"><mat-icon>unfold_more</mat-icon>{{ r.count }} ligne(s) identique(s)</button></td></tr>
              } @else {
                <tr>
                  <td class="no" [class]="cls(r.left)">{{ r.left?.oldNo ?? '' }}</td>
                  <td class="code half" [class]="cls(r.left)">@if (r.left) { @if (r.left.parts) { @for (p of r.left.parts; track $index) { <span [class.hl]="p.changed">{{ p.text }}</span> } } @else { {{ r.left.text || ' ' }} } }</td>
                  <td class="no" [class]="cls(r.right)">{{ r.right?.newNo ?? '' }}</td>
                  <td class="code half" [class]="cls(r.right)">@if (r.right) { @if (r.right.parts) { @for (p of r.right.parts; track $index) { <span [class.hl]="p.changed">{{ p.text }}</span> } } @else { {{ r.right.text || ' ' }} } }</td>
                </tr>
              }
            }
          </table>
        }
      </div>
    </div>
  `,
  styleUrls: ['./text-diff.component.scss'],
})
export class TextDiffComponent {
  before = input('');
  after = input('');
  title = input('');
  mode = input<'unified' | 'split'>('unified');
  /** Lignes inchangées conservées autour de chaque modification (-1 = tout afficher). */
  context = input(3);

  view = linkedSignal(() => this.mode());
  private opened = signal<Set<number>>(new Set());

  lines = computed(() => diffLines(this.before(), this.after()));
  stats = computed(() => ({ add: this.lines().filter((l) => l.op === 'add').length, del: this.lines().filter((l) => l.op === 'del').length }));

  /** Repère les plages inchangées repliables (id = index de début). */
  private folds = computed(() => {
    const ctx = this.context(), ls = this.lines();
    const res = new Map<number, number>();
    if (ctx < 0) return res;
    let k = 0;
    while (k < ls.length) {
      if (ls[k].op !== 'equal') { k++; continue; }
      let e = k; while (e < ls.length && ls[e].op === 'equal') e++;
      const start = k === 0 ? 0 : k + ctx, end = e === ls.length ? e : e - ctx;
      if (end - start > 1) res.set(start, end - start);
      k = e;
    }
    return res;
  });

  rows = computed<(Row | Fold)[]>(() => {
    const out: (Row | Fold)[] = [];
    const ls = this.lines();
    for (let i = 0; i < ls.length; i++) {
      const f = this.folds().get(i);
      if (f && !this.opened().has(i)) { out.push({ kind: 'fold', id: i, count: f }); i += f - 1; continue; }
      out.push({ kind: 'line', line: ls[i] });
    }
    return out;
  });

  splitRows = computed<(SplitRow | Fold)[]>(() => {
    const out: (SplitRow | Fold)[] = [];
    const rows = this.rows();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.kind === 'fold') { out.push(r); continue; }
      if (r.line.op === 'equal') { out.push({ kind: 'pair', left: r.line, right: r.line }); continue; }
      const dels: DiffLine[] = [], adds: DiffLine[] = [];
      while (i < rows.length && rows[i].kind === 'line' && (rows[i] as Row).line.op === 'del') dels.push((rows[i++] as Row).line);
      while (i < rows.length && rows[i].kind === 'line' && (rows[i] as Row).line.op === 'add') adds.push((rows[i++] as Row).line);
      i--;
      for (let k = 0; k < Math.max(dels.length, adds.length); k++) out.push({ kind: 'pair', left: dels[k] ?? null, right: adds[k] ?? null });
    }
    return out;
  });

  cls(l: DiffLine | null): string { return l ? l.op : 'empty'; }
  unfold(id: number): void { this.opened.update((s) => new Set(s).add(id)); }
}
