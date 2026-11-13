import { Component, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

/**
 * Notation : étoiles (demi-étoiles possibles), cœurs, ou échelle de satisfaction à émojis.
 * Survol en aperçu, clavier ←/→, re-clic pour effacer, lecture seule pour l'affichage d'une moyenne.
 *
 * ```html
 * <app-rating [(ngModel)]="note" [half]="true" [showValue]="true" />
 * <app-rating [value]="4.3" readonly size="small" />
 * ```
 */
@Component({
  selector: 'app-rating',
  standalone: true,
  imports: [MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RatingComponent), multi: true }],
  template: `
    <div class="rt" [class]="'rt rt--' + size()" [class.readonly]="readonly() || disabled()" [class.heart]="variant() === 'heart'" role="radiogroup" [attr.aria-label]="label()"
      tabindex="0" (keydown)="onKey($event)" (mouseleave)="hover.set(null)">
      @if (variant() === 'emoji') {
        @for (e of emojis; track $index; let i = $index) {
          <button type="button" class="emo" [class.on]="shown() === i + 1" [class.dim]="shown() && shown() !== i + 1" (click)="pick(i + 1)"
            (mouseenter)="preview(i + 1)" [attr.aria-label]="e.label" tabindex="-1"><span>{{ e.icon }}</span></button>
        }
      } @else {
        @for (i of stars(); track i) {
          <span class="star" (mousemove)="move(i, $event)" (click)="click(i, $event)">
            <mat-icon class="bg">{{ icons()[0] }}</mat-icon>
            <span class="fg" [style.width.%]="fill(i)"><mat-icon>{{ icons()[1] }}</mat-icon></span>
          </span>
        }
      }
      @if (showValue()) {
        <span class="val">{{ valueLabel() }}@if (count() !== null) { <em>({{ count() }})</em> }</span>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .rt { display: inline-flex; align-items: center; gap: 2px; outline: none; border-radius: 8px;
      &:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 40%, transparent); } }
    .star { position: relative; display: inline-flex; cursor: pointer; transition: transform 0.1s ease;
      mat-icon { font-size: var(--rt-size); width: var(--rt-size); height: var(--rt-size); }
      .bg { color: color-mix(in srgb, var(--text-muted) 40%, transparent); }
      .fg { position: absolute; left: 0; top: 0; overflow: hidden; color: var(--rt-color); }
      &:hover { transform: scale(1.12); } }
    .rt--small { --rt-size: 16px; } .rt--medium { --rt-size: 26px; } .rt--large { --rt-size: 36px; }
    :host { --rt-color: #f59e0b; }
    .heart { --rt-color: #ef4444; }
    .readonly { pointer-events: none; .star:hover { transform: none; } }
    .val { margin-left: 8px; font-weight: 600; font-size: 13px; color: var(--text-primary); font-variant-numeric: tabular-nums;
      em { font-style: normal; font-weight: 400; color: var(--text-muted); margin-left: 4px; } }
    .rt--small .val { font-size: 12px; margin-left: 4px; }
    .emo { border: none; background: none; padding: 2px; cursor: pointer; border-radius: 50%; transition: all 0.15s ease; line-height: 1;
      span { font-size: calc(var(--rt-size) * 1.15); display: block; filter: grayscale(0.4); }
      &.on { transform: scale(1.25); span { filter: none; } }
      &.dim span { opacity: 0.45; filter: grayscale(1); }
      &:hover span { filter: none; opacity: 1; } }
  `],
})
export class RatingComponent implements ControlValueAccessor {
  max = input(5);
  half = input(false, { transform: booleanAttribute });
  readonly = input(false, { transform: booleanAttribute });
  variant = input<'star' | 'heart' | 'emoji'>('star');
  size = input<'small' | 'medium' | 'large'>('medium');
  showValue = input(false, { transform: booleanAttribute });
  /** Nombre d'avis affiché à côté de la valeur. */
  count = input<number | null>(null);
  label = input('Note');
  /** Valeur en lecture seule (sans formulaire). */
  valueInput = input<number | null>(null, { alias: 'value' });

  readonly emojis = [
    { icon: '😡', label: 'Très insatisfait' }, { icon: '🙁', label: 'Insatisfait' }, { icon: '😐', label: 'Neutre' },
    { icon: '🙂', label: 'Satisfait' }, { icon: '😍', label: 'Très satisfait' },
  ];
  private model = signal(0);
  hover = signal<number | null>(null);
  disabled = signal(false);
  value = computed(() => this.valueInput() ?? this.model());
  shown = computed(() => this.hover() ?? this.value());
  stars = computed(() => Array.from({ length: this.max() }, (_, i) => i));
  icons = computed(() => (this.variant() === 'heart' ? ['favorite', 'favorite'] : ['star', 'star']));

  private onChange: (v: number) => void = () => {};
  private touched: () => void = () => {};

  valueLabel = computed(() => this.variant() === 'emoji'
    ? (this.shown() ? this.emojis[Math.round(this.shown()) - 1].label : '—')
    : this.shown().toLocaleString('fr-FR', { maximumFractionDigits: 1 }));

  fill(i: number): number { return Math.max(0, Math.min(1, this.shown() - i)) * 100; }
  private at(i: number, e: MouseEvent): number {
    if (!this.half()) return i + 1;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientX - r.left < r.width / 2 ? i + 0.5 : i + 1;
  }
  move(i: number, e: MouseEvent): void { this.preview(this.at(i, e)); }
  preview(v: number): void { if (!this.readonly() && !this.disabled()) this.hover.set(v); }
  click(i: number, e: MouseEvent): void { this.pick(this.at(i, e)); }
  pick(v: number): void {
    if (this.readonly() || this.disabled()) return;
    const next = v === this.model() ? 0 : v;
    this.model.set(next);
    this.hover.set(null);
    this.onChange(next);
    this.touched();
  }
  onKey(e: KeyboardEvent): void {
    const s = this.half() && this.variant() !== 'emoji' ? 0.5 : 1;
    const max = this.variant() === 'emoji' ? 5 : this.max();
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); this.pick(Math.min(max, this.model() + s) || s); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(0, this.model() - s); this.model.set(v); this.onChange(v); }
  }

  writeValue(v: number | null): void { this.model.set(v ?? 0); }
  registerOnChange(fn: (v: number) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
