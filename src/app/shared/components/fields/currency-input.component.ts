import { Component, ElementRef, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface CurrencyDef { code: string; symbol: string; decimals: number; }
export const CURRENCIES: Record<string, CurrencyDef> = {
  XOF: { code: 'XOF', symbol: 'FCFA', decimals: 0 },
  EUR: { code: 'EUR', symbol: '€', decimals: 2 },
  USD: { code: 'USD', symbol: '$', decimals: 2 },
};

/**
 * Montant formaté au fil de la frappe (séparateurs de milliers fr-FR, décimales selon la devise),
 * curseur préservé. La valeur du modèle est un nombre (ou `null`). Sélecteur de devise optionnel,
 * montant en lettres pour les documents (FCFA).
 *
 * ```html
 * <app-currency-input [(ngModel)]="montant" currency="XOF" [max]="100000000" />
 * ```
 */
@Component({
  selector: 'app-currency-input',
  standalone: true,
  imports: [MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CurrencyInputComponent), multi: true }],
  template: `
    <div class="form-field kit-field"><div class="field-box cur" [class.is-disabled]="disabled()">
      <mat-icon>{{ icon() }}</mat-icon>
      <input #el type="text" inputmode="decimal" [placeholder]="placeholder()" [value]="text()" [disabled]="disabled()"
        (input)="onInput(el)" (blur)="onBlur(el)" (keydown)="onKey($event)" />
      @if (currencies().length > 1) {
        <select class="cur-select" [value]="code()" (change)="override.set($any($event.target).value); reformat(el)" aria-label="Devise">
          @for (c of currencies(); track c) { <option [value]="c">{{ def(c).symbol }}</option> }
        </select>
      } @else { <span class="cur-symbol">{{ def(code()).symbol }}</span> }
    </div></div>
    @if (inWords() && value() !== null && code() === 'XOF') { <span class="field-hint words">{{ words() }}</span> }
  `,
  styles: [`
    :host { display: block; }
    .cur input { font-variant-numeric: tabular-nums; font-weight: 500; text-align: right; }
    .cur-symbol { font-size: 12.5px; font-weight: 700; color: var(--text-muted); }
    .cur-select { flex: 0 0 auto !important; width: auto !important; font-weight: 700 !important; font-size: 12.5px !important; color: var(--text-secondary) !important; cursor: pointer; appearance: auto; }
    .words { font-style: italic; }
  `],
})
export class CurrencyInputComponent implements ControlValueAccessor {
  currency = input('XOF');
  /** Devises proposées dans le sélecteur (une seule : symbole fixe). */
  currencies = input<string[]>([]);
  min = input(0);
  max = input(Number.MAX_SAFE_INTEGER);
  placeholder = input('0');
  icon = input('payments');
  inWords = input(false);

  private el = viewChild<ElementRef<HTMLInputElement>>('el');
  override = signal<string | null>(null);
  code = computed(() => this.override() ?? this.currency());
  value = signal<number | null>(null);
  disabled = signal(false);
  text = signal('');
  words = computed(() => `${amountInWords(this.value() ?? 0)} francs CFA`);

  private onChange: (v: number | null) => void = () => {};
  private touched: () => void = () => {};

  def(c: string): CurrencyDef { return CURRENCIES[c] ?? { code: c, symbol: c, decimals: 2 }; }
  private format(n: number | null, decimals = this.def(this.code()).decimals): string {
    return n === null ? '' : n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).replace(/ /g, ' ');
  }

  onInput(el: HTMLInputElement): void {
    const dec = this.def(this.code()).decimals;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/[^\d,.]/g, '').length;
    let raw = el.value.replace(/[^\d,.]/g, '').replace('.', ',');
    const [int, ...rest] = raw.split(',');
    const frac = dec ? rest.join('').slice(0, dec) : '';
    raw = int.replace(/^0+(?=\d)/, '');
    if (!raw && !frac) { this.text.set(''); el.value = ''; this.emit(null); return; }
    let n = parseFloat(`${raw || '0'}.${frac || '0'}`);
    if (n > this.max()) n = this.max();
    const intTxt = Math.floor(n).toLocaleString('fr-FR').replace(/ /g, ' ');
    const txt = dec && rest.length ? `${intTxt},${frac}` : intTxt;
    el.value = txt;
    this.text.set(txt);
    // Replace le curseur après le même nombre de chiffres.
    let pos = 0, seen = 0;
    while (pos < txt.length && seen < digitsBefore) { if (/[\d,]/.test(txt[pos])) seen++; pos++; }
    el.setSelectionRange(pos, pos);
    this.emit(n);
  }
  onBlur(el: HTMLInputElement): void {
    const v = this.value();
    if (v !== null && v < this.min()) this.emit(this.min());
    this.reformat(el);
    this.touched();
  }
  reformat(el?: HTMLInputElement): void {
    const t = this.format(this.value());
    this.text.set(t);
    if (el) el.value = t;
  }
  onKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = e.shiftKey ? 10000 : 1000;
    const n = Math.max(this.min(), Math.min(this.max(), (this.value() ?? 0) + (e.key === 'ArrowUp' ? step : -step)));
    this.emit(n);
    this.reformat(this.el()?.nativeElement);
  }
  private emit(n: number | null): void { this.value.set(n); this.onChange(n); }

  writeValue(v: number | null): void { this.value.set(v ?? null); this.reformat(); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}

/** Montant entier en toutes lettres (français, règles usuelles : vingt/cent au pluriel, « et un »). */
export function amountInWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  const below100 = (x: number, last = true): string => {
    if (x < 17) return units[x];
    if (x < 20) return 'dix-' + units[x - 10];
    const t = Math.floor(x / 10), u = x % 10;
    if (t === 7 || t === 9) return tens[t] + (u === 1 && t === 7 ? '-et-' : '-') + below100(10 + u);
    if (u === 0) return tens[t] + (t === 8 && last ? 's' : '');
    return tens[t] + (u === 1 && t !== 8 ? '-et-' : '-') + units[u];
  };
  const below1000 = (x: number, last: boolean): string => {
    const h = Math.floor(x / 100), r = x % 100;
    const hs = h === 0 ? '' : h === 1 ? 'cent' : units[h] + '-cent' + (r === 0 && last ? 's' : '');
    return [hs, r ? below100(r, last) : ''].filter(Boolean).join('-');
  };
  const parts: string[] = [];
  const scales: [number, string, string][] = [[1e9, 'milliard', 'milliards'], [1e6, 'million', 'millions'], [1e3, 'mille', 'mille']];
  let rest = n;
  for (const [v, sing, plur] of scales) {
    const q = Math.floor(rest / v);
    if (!q) continue;
    rest %= v;
    if (v === 1e3) parts.push(q === 1 ? 'mille' : below1000(q, false) + '-mille');
    else parts.push(below1000(q, true) + ' ' + (q > 1 ? plur : sing));
  }
  if (rest) parts.push(below1000(rest, true));
  const s = parts.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
