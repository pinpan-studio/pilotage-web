import { Component, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface PasswordRule { label: string; test: (v: string) => boolean; }

export const DEFAULT_PASSWORD_RULES: PasswordRule[] = [
  { label: '8 caractères minimum', test: (v) => v.length >= 8 },
  { label: 'Une majuscule et une minuscule', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: 'Un chiffre', test: (v) => /\d/.test(v) },
  { label: 'Un caractère spécial', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** Score 0–4 : longueur, variété des caractères, pénalités (répétitions, suites, mots courants). */
export function passwordScore(v: string): number {
  if (!v) return 0;
  let s = 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(v)).length;
  s += Math.min(2, Math.floor(v.length / 6));
  s += classes >= 3 ? 2 : classes === 2 ? 1 : 0;
  if (/(.)\1{2,}/.test(v)) s--;
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|azerty|qwerty)/i.test(v)) s--;
  if (/(password|motdepasse|admin|lookas|abidjan|123456)/i.test(v)) s -= 2;
  if (v.length < 6) s = Math.min(s, 1);
  return Math.max(0, Math.min(4, s));
}

/**
 * Mot de passe avec affichage / masquage, jauge de robustesse (4 niveaux), liste des règles cochées
 * en direct, détection du verrouillage majuscules et générateur de mot de passe robuste.
 *
 * ```html
 * <app-password-field [(ngModel)]="pwd" [rules]="regles" [generator]="true" />
 * ```
 */
@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PasswordFieldComponent), multi: true }],
  template: `
    <div class="form-field kit-field">
      <div class="field-box" [class.is-disabled]="disabled()">
        <mat-icon>lock</mat-icon>
        <input [type]="visible() ? 'text' : 'password'" [value]="value()" [placeholder]="placeholder()" [disabled]="disabled()"
          [attr.autocomplete]="autocomplete()" (input)="set($any($event.target).value)" (keyup)="caps($event)" (keydown)="caps($event)" (blur)="touched(); capsOn.set(false)" />
        @if (generator() && !disabled()) { <button type="button" class="pf-btn" (click)="generate()" matTooltip="Générer un mot de passe robuste"><mat-icon>auto_fix_high</mat-icon></button> }
        <button type="button" class="pf-btn" (click)="visible.set(!visible())" [matTooltip]="visible() ? 'Masquer' : 'Afficher'" [disabled]="disabled()">
          <mat-icon>{{ visible() ? 'visibility_off' : 'visibility' }}</mat-icon></button>
      </div>
    </div>
    @if (capsOn()) { <span class="pf-caps"><mat-icon>keyboard_capslock</mat-icon>Verrouillage majuscules activé</span> }
    @if (meter()) {
      <div class="pf-meter" [attr.data-score]="value() ? score() : -1">
        @for (i of [0, 1, 2, 3]; track i) { <span [class.on]="value() && i < Math.max(1, score())"></span> }
        <em>{{ value() ? levels[score()] : '' }}</em>
      </div>
    }
    @if (rules().length && (value() || showRulesEmpty())) {
      <ul class="pf-rules">
        @for (r of rules(); track r.label) {
          <li [class.ok]="r.test(value())"><mat-icon>{{ r.test(value()) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ r.label }}</li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; }
    .pf-btn { flex-shrink: 0; width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; } &:hover:not(:disabled) { background: var(--hover-bg); color: var(--primary-color); } }
    .pf-caps { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 11.5px; color: var(--warning-color-text, var(--warning-color));
      mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    .pf-meter { display: flex; align-items: center; gap: 4px; margin-top: 8px;
      span { flex: 1; height: 4px; border-radius: 2px; background: var(--border-color); transition: background 0.2s ease; }
      em { min-width: 78px; text-align: right; font-style: normal; font-size: 11.5px; font-weight: 600; }
      &[data-score='0'] { span.on { background: var(--error-color); } em { color: var(--error-color); } }
      &[data-score='1'] { span.on { background: var(--error-color); } em { color: var(--error-color); } }
      &[data-score='2'] { span.on { background: var(--warning-color); } em { color: var(--warning-color-text, var(--warning-color)); } }
      &[data-score='3'] { span.on { background: var(--info-color); } em { color: var(--info-color); } }
      &[data-score='4'] { span.on { background: var(--success-color); } em { color: var(--success-color-text, var(--success-color)); } } }
    .pf-rules { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px 12px;
      li { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); transition: color 0.15s ease;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
        &.ok { color: var(--success-color-text, var(--success-color)); } } }
  `],
})
export class PasswordFieldComponent implements ControlValueAccessor {
  placeholder = input('Mot de passe');
  rules = input<PasswordRule[]>(DEFAULT_PASSWORD_RULES);
  meter = input(true, { transform: booleanAttribute });
  generator = input(false, { transform: booleanAttribute });
  showRulesEmpty = input(false, { transform: booleanAttribute });
  autocomplete = input('new-password');

  readonly Math = Math;
  readonly levels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];
  value = signal('');
  visible = signal(false);
  capsOn = signal(false);
  disabled = signal(false);
  score = computed(() => passwordScore(this.value()));

  private onChange: (v: string) => void = () => {};
  touched: () => void = () => {};

  set(v: string): void { this.value.set(v); this.onChange(v); }
  caps(e: KeyboardEvent): void { this.capsOn.set(!!e.getModifierState?.('CapsLock')); }

  /** 16 caractères aléatoires (crypto) garantissant chaque classe. */
  generate(): void {
    const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?-_+='];
    const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    const all = sets.join('');
    const chars = sets.map((s) => s[rnd(s.length)]);
    while (chars.length < 16) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    this.set(chars.join(''));
    this.visible.set(true);
  }

  writeValue(v: string | null): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
