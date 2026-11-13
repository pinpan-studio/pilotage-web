import { Component, OnDestroy, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

/**
 * Champ numérique à boutons − / + : bornes, pas, décimales, appui long pour répéter,
 * flèches ↑/↓ (Maj = ×10), unité affichée. Variante `compact` (pilule) pour les quantités.
 *
 * ```html
 * <app-number-stepper [(ngModel)]="vehicules" [min]="1" [max]="500" unit="véh." />
 * ```
 */
@Component({
  selector: 'app-number-stepper',
  standalone: true,
  imports: [MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumberStepperComponent), multi: true }],
  template: `
    <div class="ns" [class.compact]="compact()" [class.disabled]="disabled()">
      <button type="button" (pointerdown)="hold(-1, $event)" (pointerup)="release()" (pointerleave)="release()" (keydown.enter)="step(-1)"
        [disabled]="disabled() || atMin()" aria-label="Diminuer"><mat-icon>remove</mat-icon></button>
      <div class="val">
        <input type="text" inputmode="decimal" [value]="display()" [disabled]="disabled()" (change)="onType($any($event.target))" (keydown)="onKey($event)" (blur)="touched()"
          role="spinbutton" [attr.aria-valuemin]="min()" [attr.aria-valuemax]="max()" [attr.aria-valuenow]="value()" />
        @if (unit()) { <span class="unit">{{ unit() }}</span> }
      </div>
      <button type="button" (pointerdown)="hold(1, $event)" (pointerup)="release()" (pointerleave)="release()" (keydown.enter)="step(1)"
        [disabled]="disabled() || atMax()" aria-label="Augmenter"><mat-icon>add</mat-icon></button>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .ns {
      display: inline-flex; align-items: center; height: 44px; border-radius: var(--r-m, 12px);
      border: 1px solid var(--border-color); background: var(--mat-sys-surface-container-high, var(--hover-bg)); transition: all 0.15s ease;
      &:focus-within { background: var(--card-bg); border-color: var(--primary-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent); }
      &.disabled { opacity: 0.6; }
    }
    button {
      width: 40px; height: 100%; border: none; background: transparent; color: var(--text-secondary); cursor: pointer;
      display: flex; align-items: center; justify-content: center; touch-action: manipulation;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &:hover:not(:disabled) { color: var(--primary-color); background: var(--primary-color-light); }
      &:first-child { border-radius: 11px 0 0 11px; } &:last-child { border-radius: 0 11px 11px 0; }
      &:disabled { opacity: 0.35; cursor: default; }
    }
    .val { display: flex; align-items: baseline; justify-content: center; gap: 4px; min-width: 70px; padding: 0 4px;
      border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color); height: 100%; align-items: center; }
    input { width: 6ch; min-width: 0; border: none; outline: none; background: transparent; text-align: center; color: var(--text-primary);
      font: 600 15px 'Inter', sans-serif; font-variant-numeric: tabular-nums; }
    .unit { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
    .compact { height: 34px; border-radius: 17px;
      button { width: 32px; &:first-child { border-radius: 17px 0 0 17px; } &:last-child { border-radius: 0 17px 17px 0; } mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      .val { min-width: 32px; border: none; } input { font-size: 14px; width: 3ch; } }
  `],
})
export class NumberStepperComponent implements ControlValueAccessor, OnDestroy {
  min = input(-Infinity);
  max = input(Infinity);
  stepSize = input(1, { alias: 'step' });
  decimals = input(0);
  unit = input('');
  compact = input(false, { transform: booleanAttribute });

  value = signal<number>(0);
  disabled = signal(false);
  display = computed(() => this.value().toLocaleString('fr-FR', { minimumFractionDigits: this.decimals(), maximumFractionDigits: this.decimals() }));
  atMin = computed(() => this.value() <= this.min());
  atMax = computed(() => this.value() >= this.max());

  private onChange: (v: number) => void = () => {};
  touched: () => void = () => {};
  private timer?: ReturnType<typeof setTimeout>;

  private commit(v: number): void {
    const f = 10 ** this.decimals();
    const n = Math.max(this.min(), Math.min(this.max(), Math.round(v * f) / f));
    if (n === this.value()) return;
    this.value.set(n);
    this.onChange(n);
  }
  step(d: number, mult = 1): void { this.commit(this.value() + d * this.stepSize() * mult); }

  /** Appui long : répétition accélérée. */
  hold(d: number, e: PointerEvent): void {
    if (e.button !== 0) return;
    this.step(d);
    let delay = 380;
    const tick = () => { this.step(d); delay = Math.max(40, delay * 0.8); this.timer = setTimeout(tick, delay); };
    this.timer = setTimeout(tick, delay);
  }
  release(): void { clearTimeout(this.timer); }

  onType(el: HTMLInputElement): void {
    const n = parseFloat(el.value.replace(/\s| /g, '').replace(',', '.'));
    if (isNaN(n)) el.value = this.display(); else { this.commit(n); el.value = this.display(); }
  }
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1); }
  }

  writeValue(v: number | null): void { this.value.set(v ?? (isFinite(this.min()) ? this.min() : 0)); }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
  ngOnDestroy(): void { this.release(); }
}
