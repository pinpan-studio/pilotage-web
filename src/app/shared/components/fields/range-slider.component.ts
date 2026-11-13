import { Component, ElementRef, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type RangeValue = [number, number];

/**
 * Intervalle à deux curseurs (filtres de prix, de vitesse, de période) avec histogramme optionnel
 * de la distribution, champs min / max saisissables, clavier (←/→, Page ↑/↓, Début/Fin).
 * Valeur du modèle : `[min, max]`.
 *
 * ```html
 * <app-range-slider [(ngModel)]="prix" [min]="0" [max]="500000" [step]="5000" [histogram]="distribution" unit="FCFA" />
 * ```
 */
@Component({
  selector: 'app-range-slider',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RangeSliderComponent), multi: true }],
  template: `
    <div class="rs" [class.disabled]="disabled()">
      @if (histogram().length) {
        <div class="rs-hist">
          @for (h of histogram(); track $index) {
            <span [style.height.%]="(h / histMax()) * 100" [class.in]="inRange($index)"></span>
          }
        </div>
      }
      <div #track class="rs-track" (pointerdown)="trackDown($event)">
        <div class="rs-fill" [style.left.%]="pct(lo())" [style.right.%]="100 - pct(hi())"></div>
        @for (t of thumbs; track t) {
          <div class="rs-thumb" [style.left.%]="pct(t ? hi() : lo())" [class.active]="active() === t" tabindex="0" role="slider"
            [attr.aria-label]="t ? 'Maximum' : 'Minimum'" [attr.aria-valuemin]="min()" [attr.aria-valuemax]="max()" [attr.aria-valuenow]="t ? hi() : lo()"
            [attr.aria-valuetext]="fmt(t ? hi() : lo())" (pointerdown)="thumbDown(t, $event)" (keydown)="onKey(t, $event)">
            <span class="rs-tip">{{ fmt(t ? hi() : lo()) }}</span>
          </div>
        }
      </div>
      @if (inputs()) {
        <div class="rs-inputs">
          <label class="field-box"><span>Min</span><input type="text" inputmode="numeric" [value]="fmtNum(lo())" (change)="typed(0, $any($event.target))" [disabled]="disabled()" />@if (unit()) { <em>{{ unit() }}</em> }</label>
          <span class="dash">—</span>
          <label class="field-box"><span>Max</span><input type="text" inputmode="numeric" [value]="fmtNum(hi())" (change)="typed(1, $any($event.target))" [disabled]="disabled()" />@if (unit()) { <em>{{ unit() }}</em> }</label>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .rs { padding: 4px 10px 0; &.disabled { opacity: 0.55; pointer-events: none; } }
    .rs-hist { display: flex; align-items: flex-end; gap: 2px; height: 56px; margin: 0 2px -2px;
      span { flex: 1; min-height: 2px; border-radius: 3px 3px 0 0; background: color-mix(in srgb, var(--text-muted) 30%, transparent); transition: background 0.15s ease; }
      span.in { background: color-mix(in srgb, var(--primary-color) 55%, transparent); } }
    .rs-track { position: relative; height: 28px; cursor: pointer; touch-action: none;
      &::before { content: ''; position: absolute; left: 0; right: 0; top: 12px; height: 4px; border-radius: 2px; background: var(--border-color); } }
    .rs-fill { position: absolute; top: 12px; height: 4px; border-radius: 2px; background: var(--primary-color); }
    .rs-thumb {
      position: absolute; top: 4px; width: 20px; height: 20px; margin-left: -10px; border-radius: 50%; cursor: grab;
      background: var(--card-bg); border: 2px solid var(--primary-color); box-shadow: var(--elevation-1); outline: none; transition: box-shadow 0.15s ease;
      &:focus-visible, &.active { box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary-color) 20%, transparent); }
      &.active { cursor: grabbing; }
      .rs-tip { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%) scale(0.8); opacity: 0; transition: all 0.12s ease;
        padding: 3px 8px; border-radius: 6px; white-space: nowrap; background: var(--text-primary); color: var(--card-bg); font: 600 11.5px 'Inter', sans-serif; pointer-events: none; }
      &:hover .rs-tip, &.active .rs-tip, &:focus-visible .rs-tip { opacity: 1; transform: translateX(-50%) scale(1); }
    }
    .rs-inputs { display: flex; align-items: center; gap: 8px; margin-top: 10px;
      .field-box { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 10px; box-sizing: border-box;
        border: 1px solid var(--border-color); border-radius: var(--r-m, 12px); background: var(--mat-sys-surface-container-high, var(--hover-bg));
        &:focus-within { background: var(--card-bg); border-color: var(--primary-color); }
        span { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--text-primary); font: 500 14px 'Inter', sans-serif; text-align: right; font-variant-numeric: tabular-nums; }
        em { font-style: normal; font-size: 11.5px; color: var(--text-muted); } }
      .dash { color: var(--text-muted); } }
  `],
})
export class RangeSliderComponent implements ControlValueAccessor {
  min = input(0);
  max = input(100);
  step = input(1);
  /** Écart minimal entre les deux curseurs. */
  minGap = input(0);
  unit = input('');
  /** Effectifs par tranche égale entre min et max. */
  histogram = input<number[]>([]);
  inputs = input(true);
  /** Formatage de l'infobulle. */
  format = input<((v: number) => string) | null>(null);

  private trackEl = viewChild.required<ElementRef<HTMLElement>>('track');
  readonly thumbs: (0 | 1)[] = [0, 1];
  lo = signal(0);
  hi = signal(100);
  active = signal<0 | 1 | null>(null);
  disabled = signal(false);
  histMax = computed(() => Math.max(1, ...this.histogram()));

  private onChange: (v: RangeValue) => void = () => {};
  private touched: () => void = () => {};

  pct(v: number): number { return ((v - this.min()) / (this.max() - this.min() || 1)) * 100; }
  fmtNum(v: number): string { return v.toLocaleString('fr-FR').replace(/ /g, ' '); }
  fmt(v: number): string { const f = this.format(); return f ? f(v) : `${this.fmtNum(v)}${this.unit() ? ' ' + this.unit() : ''}`; }
  inRange(i: number): boolean {
    const n = this.histogram().length, w = (this.max() - this.min()) / n;
    const a = this.min() + i * w, b = a + w;
    return b > this.lo() && a < this.hi();
  }

  private snap(v: number): number {
    const s = this.step();
    return Math.max(this.min(), Math.min(this.max(), Math.round((v - this.min()) / s) * s + this.min()));
  }
  private set(t: 0 | 1, v: number): void {
    v = this.snap(v);
    if (t === 0) this.lo.set(Math.min(v, this.hi() - this.minGap()));
    else this.hi.set(Math.max(v, this.lo() + this.minGap()));
    this.onChange([this.lo(), this.hi()]);
  }
  private valueAt(e: PointerEvent): number {
    const r = this.trackEl().nativeElement.getBoundingClientRect();
    return this.min() + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (this.max() - this.min());
  }

  private drag(t: 0 | 1, e: PointerEvent): void {
    const el = this.trackEl().nativeElement;
    el.setPointerCapture(e.pointerId);
    this.active.set(t);
    const move = (ev: PointerEvent) => this.set(t, this.valueAt(ev));
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => { el.removeEventListener('pointermove', move); this.active.set(null); this.touched(); }, { once: true });
  }
  thumbDown(t: 0 | 1, e: PointerEvent): void { e.stopPropagation(); this.drag(t, e); }
  trackDown(e: PointerEvent): void {
    const v = this.valueAt(e);
    const t: 0 | 1 = Math.abs(v - this.lo()) <= Math.abs(v - this.hi()) ? 0 : 1;
    this.set(t, v);
    this.drag(t, e);
  }
  onKey(t: 0 | 1, e: KeyboardEvent): void {
    const cur = t ? this.hi() : this.lo();
    const big = (this.max() - this.min()) / 10;
    const map: Record<string, number> = {
      ArrowLeft: cur - this.step(), ArrowDown: cur - this.step(), ArrowRight: cur + this.step(), ArrowUp: cur + this.step(),
      PageDown: cur - big, PageUp: cur + big, Home: this.min(), End: this.max(),
    };
    if (e.key in map) { e.preventDefault(); this.set(t, map[e.key]); }
  }
  typed(t: 0 | 1, el: HTMLInputElement): void {
    const n = parseFloat(el.value.replace(/[\s ]/g, '').replace(',', '.'));
    if (!isNaN(n)) this.set(t, n);
    el.value = this.fmtNum(t ? this.hi() : this.lo());
  }

  writeValue(v: RangeValue | null): void {
    this.lo.set(v?.[0] ?? this.min());
    this.hi.set(v?.[1] ?? this.max());
  }
  registerOnChange(fn: (v: RangeValue) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
