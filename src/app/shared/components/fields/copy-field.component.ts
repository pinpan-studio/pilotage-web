import { Component, booleanAttribute, computed, inject, input, output, signal } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Valeur en lecture seule à copier (clé API, lien de partage, IMEI, identifiant) : bouton de copie avec
 * confirmation visuelle, masquage optionnel des secrets, régénération, variante multi-ligne (code).
 *
 * ```html
 * <app-copy-field value="sk_live_51H…" [secret]="true" label="Clé API" (regenerate)="rotate()" />
 * ```
 */
@Component({
  selector: 'app-copy-field',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <div class="form-field kit-field">
      <div class="field-box cf" [class.multiline]="multiline()" [class.copied]="copied()">
        @if (icon()) { <mat-icon>{{ icon() }}</mat-icon> }
        @if (multiline()) { <pre class="cf-value">{{ shown() }}</pre> }
        @else { <input class="cf-value" [value]="shown()" readonly (focus)="$any($event.target).select()" [attr.aria-label]="label() || 'Valeur'" /> }
        @if (secret()) {
          <button type="button" class="cf-btn" (click)="revealed.set(!revealed())" [matTooltip]="revealed() ? 'Masquer' : 'Afficher'"><mat-icon>{{ revealed() ? 'visibility_off' : 'visibility' }}</mat-icon></button>
        }
        @if (canRegenerate()) {
          <button type="button" class="cf-btn" (click)="regenerate.emit()" matTooltip="Régénérer"><mat-icon>autorenew</mat-icon></button>
        }
        <button type="button" class="cf-copy" (click)="copy()" [attr.aria-label]="'Copier ' + (label() || 'la valeur')">
          <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon><span>{{ copied() ? 'Copié' : 'Copier' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cf { padding-right: 4px !important; }
    .cf-value { font-family: 'Space Mono', ui-monospace, monospace !important; font-size: 13px !important; color: var(--text-primary); text-overflow: ellipsis; }
    .multiline { align-items: flex-start !important; padding-top: 10px !important; padding-bottom: 10px !important;
      pre { flex: 1; margin: 0; white-space: pre-wrap; word-break: break-all; line-height: 1.55; max-height: 200px; overflow: auto; } }
    .cf-btn { flex-shrink: 0; width: 32px; height: 32px; border: none; border-radius: 50%; background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; } &:hover { background: var(--hover-bg); color: var(--text-primary); } }
    .cf-copy { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 12px; border-radius: 10px; border: none; cursor: pointer;
      background: var(--primary-color-light); color: var(--primary-color); font: 600 12.5px 'Inter', sans-serif; transition: all 0.15s ease;
      mat-icon { font-size: 16px; width: 16px; height: 16px; } &:hover { background: var(--primary-color); color: #fff; } }
    .copied { border-color: var(--success-color) !important;
      .cf-copy { background: var(--success-color); color: #fff; } }
    @media (max-width: 420px) { .cf-copy span { display: none; } .cf-copy { padding: 0 9px; } }
  `],
})
export class CopyFieldComponent {
  private clipboard = inject(Clipboard);

  value = input('');
  label = input('');
  icon = input('');
  secret = input(false, { transform: booleanAttribute });
  multiline = input(false, { transform: booleanAttribute });
  canRegenerate = input(false, { transform: booleanAttribute, alias: 'regenerable' });
  copiedChange = output<string>({ alias: 'copied' });
  regenerate = output<void>();

  revealed = signal(false);
  copied = signal(false);
  shown = computed(() => {
    const v = this.value();
    if (!this.secret() || this.revealed()) return v;
    return v.length <= 8 ? '•'.repeat(v.length) : v.slice(0, 4) + '•'.repeat(Math.min(24, v.length - 8)) + v.slice(-4);
  });
  private timer?: ReturnType<typeof setTimeout>;

  copy(): void {
    if (!this.clipboard.copy(this.value())) return;
    this.copied.set(true);
    this.copiedChange.emit(this.value());
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), 1800);
  }
}
