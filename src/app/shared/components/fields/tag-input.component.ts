import { Component, ElementRef, booleanAttribute, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';

/**
 * Saisie de tags libres avec suggestions : Entrée / virgule / Tab pour valider, collage de listes
 * (séparées par virgules, points-virgules ou retours ligne), retour arrière pour supprimer le dernier,
 * double-clic pour modifier un tag, limite et validation (ex. emails). Valeur : `string[]`.
 *
 * ```html
 * <app-tag-input [(ngModel)]="tags" [suggestions]="motsCles" [max]="8" placeholder="Ajouter un mot-clé…" />
 * ```
 */
@Component({
  selector: 'app-tag-input',
  standalone: true,
  imports: [OverlayModule, MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagInputComponent), multi: true }],
  template: `
    <div class="form-field kit-field">
      <div class="field-box tg" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.is-disabled]="disabled()" (click)="focus()">
        @if (icon()) { <mat-icon>{{ icon() }}</mat-icon> }
        <div class="tg-wrap">
          @for (t of tags(); track t; let i = $index) {
            <span class="tg-tag" [class.bad]="!valid(t)" (dblclick)="edit(i)" [title]="valid(t) ? 'Double-clic pour modifier' : invalidMessage()">
              {{ t }}
              @if (!disabled()) { <button type="button" (click)="remove(i); $event.stopPropagation()" [attr.aria-label]="'Retirer ' + t"><mat-icon>close</mat-icon></button> }
            </span>
          }
          @if (!full()) {
            <input #inp [placeholder]="tags().length ? '' : placeholder()" [value]="text()" [disabled]="disabled()"
              (input)="text.set($any($event.target).value); active.set(0)" (keydown)="onKey($event)" (paste)="onPaste($event)"
              (focus)="focused.set(true)" (blur)="onBlur()" />
          }
        </div>
        @if (max()) { <span class="tg-count">{{ tags().length }}/{{ max() }}</span> }
      </div>
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="focused() && options().length > 0"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayWidth]="width()">
      <div class="kit-suggest-panel" (mousedown)="$event.preventDefault()">
        @for (o of options(); track o.value; let i = $index) {
          <div class="sg-item" [class.active]="i === active()" [class.create]="o.create" (click)="add(o.value)" (mouseenter)="active.set(i)">
            <mat-icon>{{ o.create ? 'add' : 'sell' }}</mat-icon>
            <span class="sg-text"><span>{{ o.create ? 'Créer « ' + o.value + ' »' : o.value }}</span></span>
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .tg { height: auto !important; min-height: 44px; padding-top: 5px !important; padding-bottom: 5px !important; cursor: text; flex-wrap: nowrap; }
    .tg-wrap { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
    .tg-wrap input { flex: 1 0 100px !important; min-width: 100px; height: 30px; }
    .tg-tag { display: inline-flex; align-items: center; gap: 2px; height: 26px; padding: 0 4px 0 10px; border-radius: 13px;
      background: var(--primary-color-light); color: var(--primary-color); font-size: 12.5px; font-weight: 600; white-space: nowrap; cursor: default;
      button { width: 20px; height: 20px; border: none; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 14px; width: 14px; height: 14px; } &:hover { background: color-mix(in srgb, currentColor 18%, transparent); } }
      &.bad { background: var(--error-color-light); color: var(--error-color-text, var(--error-color)); text-decoration: underline wavy; text-underline-offset: 3px; } }
    .tg-count { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; align-self: center; }
  `],
})
export class TagInputComponent implements ControlValueAccessor {
  suggestions = input<string[]>([]);
  placeholder = input('Ajouter…');
  icon = input('sell');
  max = input<number | null>(null);
  /** Autoriser des valeurs absentes des suggestions. */
  allowCustom = input(true, { transform: booleanAttribute });
  /** Validation d'un tag (ex. email). */
  validator = input<((t: string) => boolean) | null>(null);
  invalidMessage = input('Valeur invalide');
  /** Normalisation (ex. minuscules). */
  transform = input<((t: string) => string) | null>(null);

  private inp = viewChild<ElementRef<HTMLInputElement>>('inp');
  private originEl = viewChild('origin', { read: ElementRef });
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];
  tags = signal<string[]>([]);
  text = signal('');
  focused = signal(false);
  active = signal(0);
  disabled = signal(false);
  width = signal(280);
  full = computed(() => !!this.max() && this.tags().length >= this.max()!);
  options = computed(() => {
    const q = this.text().trim().toLowerCase();
    const have = new Set(this.tags().map((t) => t.toLowerCase()));
    const list = this.suggestions().filter((s) => !have.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q))).slice(0, 8).map((value) => ({ value, create: false }));
    if (q && this.allowCustom() && !have.has(q) && !list.some((o) => o.value.toLowerCase() === q)) list.push({ value: this.text().trim(), create: true });
    return list;
  });

  private onChange: (v: string[]) => void = () => {};
  private touched: () => void = () => {};

  valid(t: string): boolean { const v = this.validator(); return !v || v(t); }
  focus(): void {
    this.width.set(this.originEl()?.nativeElement.getBoundingClientRect().width ?? 280);
    this.inp()?.nativeElement.focus();
  }

  add(raw: string): void {
    const f = this.transform();
    const t = (f ? f(raw.trim()) : raw.trim());
    if (!t || this.full()) return;
    if (this.tags().some((x) => x.toLowerCase() === t.toLowerCase())) { this.text.set(''); return; }
    if (!this.allowCustom() && !this.suggestions().some((s) => s.toLowerCase() === t.toLowerCase())) return;
    this.commit([...this.tags(), t]);
    this.text.set('');
    const el = this.inp()?.nativeElement;
    if (el) el.value = '';
  }
  remove(i: number): void { this.commit(this.tags().filter((_, k) => k !== i)); }
  edit(i: number): void {
    if (this.disabled()) return;
    const t = this.tags()[i];
    this.remove(i);
    this.text.set(t);
    setTimeout(() => { const el = this.inp()?.nativeElement; if (el) { el.value = t; el.focus(); el.select(); } });
  }
  private commit(v: string[]): void { this.tags.set(v); this.onChange(v); }

  onKey(e: KeyboardEvent): void {
    const opts = this.options();
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); this.active.set((this.active() + 1) % opts.length); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); this.active.set((this.active() - 1 + opts.length) % opts.length); }
    else if (e.key === 'Enter' || e.key === ',' || e.key === ';' || (e.key === 'Tab' && this.text().trim())) {
      e.preventDefault();
      const o = opts[this.active()];
      this.add(o && (e.key === 'Enter' || e.key === 'Tab') ? o.value : this.text());
    } else if (e.key === 'Backspace' && !this.text() && this.tags().length) {
      this.remove(this.tags().length - 1);
    } else if (e.key === 'Escape') { this.focused.set(false); }
  }
  onPaste(e: ClipboardEvent): void {
    const txt = e.clipboardData?.getData('text') ?? '';
    if (!/[,;\n]/.test(txt)) return;
    e.preventDefault();
    txt.split(/[,;\n]+/).forEach((t) => this.add(t));
  }
  onBlur(): void {
    this.focused.set(false);
    if (this.text().trim() && this.allowCustom()) this.add(this.text());
    this.touched();
  }

  writeValue(v: string[] | null): void { this.tags.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
