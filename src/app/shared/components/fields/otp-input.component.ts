import { Component, ElementRef, booleanAttribute, computed, forwardRef, input, output, signal, viewChildren } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Code à usage unique (OTP / PIN) en cases séparées : saisie auto-avancée, retour arrière, flèches,
 * collage d'un code complet, autocomplétion SMS (`autocomplete="one-time-code"`), masquage optionnel.
 *
 * ```html
 * <app-otp-input [length]="6" [(ngModel)]="code" (completed)="verify($event)" />
 * ```
 */
@Component({
  selector: 'app-otp-input',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => OtpInputComponent), multi: true }],
  template: `
    <div class="otp" [class.invalid]="invalid()" [class.success]="success()" role="group" [attr.aria-label]="'Code à ' + length() + ' caractères'">
      @for (i of slots(); track i) {
        @if (separator() && i === Math.floor(length() / 2) && length() > 4) { <span class="sep">–</span> }
        <input #cell [type]="mask() ? 'password' : 'text'" [attr.inputmode]="numeric() ? 'numeric' : 'text'" maxlength="1"
          [attr.autocomplete]="i === 0 ? 'one-time-code' : 'off'" [value]="chars()[i] || ''" [disabled]="disabled()"
          [class.filled]="!!chars()[i]" [attr.aria-label]="'Caractère ' + (i + 1)"
          (input)="onInput(i, $event)" (keydown)="onKey(i, $event)" (paste)="onPaste(i, $event)" (focus)="$any($event.target).select()" (blur)="touched()" />
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .otp { display: flex; align-items: center; gap: 8px; }
    .sep { color: var(--text-muted); font-weight: 600; }
    input {
      width: 46px; height: 54px; padding: 0; text-align: center; box-sizing: border-box;
      border: 1px solid var(--border-color); border-radius: var(--r-m, 12px);
      background: var(--mat-sys-surface-container-high, var(--hover-bg)); color: var(--text-primary);
      font: 600 22px 'Outfit', sans-serif; caret-color: var(--primary-color); transition: all 0.15s ease;
      &:focus { outline: none; background: var(--card-bg); border-color: var(--primary-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent); }
      &.filled { background: var(--card-bg); border-color: color-mix(in srgb, var(--primary-color) 45%, var(--border-color)); }
      &:disabled { opacity: 0.55; }
    }
    .invalid input { border-color: var(--error-color); animation: otp-shake 0.35s ease; }
    .success input { border-color: var(--success-color); color: var(--success-color-text, var(--success-color)); }
    @keyframes otp-shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
    @media (max-width: 420px) { input { width: 40px; height: 48px; font-size: 19px; } .otp { gap: 6px; } }
  `],
})
export class OtpInputComponent implements ControlValueAccessor {
  length = input(6);
  numeric = input(true, { transform: booleanAttribute });
  mask = input(false, { transform: booleanAttribute });
  separator = input(false, { transform: booleanAttribute });
  invalid = input(false);
  success = input(false);
  completed = output<string>();

  private cells = viewChildren<ElementRef<HTMLInputElement>>('cell');
  readonly Math = Math;
  chars = signal<string[]>([]);
  disabled = signal(false);
  slots = computed(() => Array.from({ length: this.length() }, (_, i) => i));

  private onChange: (v: string) => void = () => {};
  touched: () => void = () => {};

  private allowed(c: string): boolean { return this.numeric() ? /\d/.test(c) : /[a-z0-9]/i.test(c); }
  private focus(i: number): void { this.cells()[Math.max(0, Math.min(this.length() - 1, i))]?.nativeElement.focus(); }

  private set(next: string[]): void {
    this.chars.set(next);
    const v = next.join('');
    this.onChange(v);
    if (v.length === this.length() && next.every(Boolean)) this.completed.emit(v);
  }

  onInput(i: number, e: Event): void {
    const el = e.target as HTMLInputElement;
    const c = el.value.slice(-1);
    if (!c || !this.allowed(c)) { el.value = this.chars()[i] ?? ''; return; }
    const next = [...this.chars()];
    next[i] = this.numeric() ? c : c.toUpperCase();
    this.set(next);
    el.value = next[i];
    this.focus(i + 1);
  }

  onKey(i: number, e: KeyboardEvent): void {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...this.chars()];
      if (next[i]) next[i] = ''; else if (i > 0) { next[i - 1] = ''; this.focus(i - 1); }
      this.set(next);
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); this.focus(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.focus(i + 1); }
  }

  onPaste(i: number, e: ClipboardEvent): void {
    e.preventDefault();
    const txt = (e.clipboardData?.getData('text') ?? '').split('').filter((c) => this.allowed(c));
    if (!txt.length) return;
    const next = [...this.chars()];
    txt.slice(0, this.length() - i).forEach((c, k) => (next[i + k] = this.numeric() ? c : c.toUpperCase()));
    this.set(next);
    this.focus(i + txt.length);
  }

  /** Vide le code et replace le focus sur la première case. */
  clear(): void { this.set([]); this.focus(0); }

  writeValue(v: string | null): void { this.chars.set((v ?? '').slice(0, this.length()).split('')); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
