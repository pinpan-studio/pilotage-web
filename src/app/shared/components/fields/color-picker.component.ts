import { Component, ElementRef, booleanAttribute, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export const DEFAULT_SWATCHES = [
  '#4f6bed', '#3b82f6', '#06b6d4', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#8b5cf6', '#64748b', '#334155', '#0f172a',
];

/**
 * Sélecteur de couleur : palette prédéfinie + zone saturation / luminosité, teinte, saisie hexadécimale
 * et pipette (EyeDropper, si disponible). Mode `inline` = palette seule sans popup.
 * Valeur du modèle : `#rrggbb`.
 *
 * ```html
 * <app-color-picker [(ngModel)]="couleur" [swatches]="palette" />
 * ```
 */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [OverlayModule, MatIconModule, MatTooltipModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ColorPickerComponent), multi: true }],
  template: `
    @if (inline()) {
      <div class="cp-swatches inline">
        @for (c of swatches(); track c) {
          <button type="button" class="sw" [style.background]="c" [class.on]="c === value()" (click)="pick(c)" [attr.aria-label]="c">
            @if (c === value()) { <mat-icon [style.color]="contrast(c)">check</mat-icon> }
          </button>
        }
      </div>
    } @else {
      <div class="form-field kit-field">
        <div class="field-box cp-trigger" cdkOverlayOrigin #origin="cdkOverlayOrigin" [class.is-disabled]="disabled()">
          <button type="button" class="cp-chip" [style.background]="value() || 'transparent'" (click)="open.set(!open())" [disabled]="disabled()" aria-label="Choisir une couleur"></button>
          <input type="text" [value]="value()" maxlength="7" spellcheck="false" placeholder="#000000" [disabled]="disabled()"
            (change)="typed($any($event.target))" (focus)="open.set(true)" />
          <mat-icon class="cp-caret" (click)="open.set(!open())">palette</mat-icon>
        </div>
      </div>
      <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()" [cdkConnectedOverlayPositions]="positions"
        (overlayOutsideClick)="open.set(false)" (detach)="open.set(false)" (overlayKeydown)="$event.key === 'Escape' && open.set(false)">
        <div class="kit-color-panel">
          <div #sv class="cp-sv" [style.background-color]="hueColor()" (pointerdown)="svDown($event)">
            <div class="cp-sv-cursor" [style.left.%]="hsv().s * 100" [style.top.%]="(1 - hsv().v) * 100" [style.background]="value()"></div>
          </div>
          <div class="cp-row">
            @if (eyeDropper) { <button type="button" class="cp-eye" (click)="eyedrop()" matTooltip="Pipette"><mat-icon>colorize</mat-icon></button> }
            <input class="cp-hue" type="range" min="0" max="360" [value]="hsv().h" (input)="setHue(+$any($event.target).value)" aria-label="Teinte" />
            <span class="cp-preview" [style.background]="value()"></span>
          </div>
          <div class="cp-swatches">
            @for (c of swatches(); track c) {
              <button type="button" class="sw" [style.background]="c" [class.on]="c === value()" (click)="pick(c)" [matTooltip]="c" [attr.aria-label]="c"></button>
            }
          </div>
          @if (recent().length) {
            <span class="cp-label">Récentes</span>
            <div class="cp-swatches">@for (c of recent(); track c) { <button type="button" class="sw" [style.background]="c" (click)="pick(c)"></button> }</div>
          }
        </div>
      </ng-template>
    }
  `,
  styles: [`
    :host { display: block; }
    .cp-trigger { padding-left: 8px !important; }
    .cp-chip { width: 28px; height: 28px; flex-shrink: 0; border-radius: 15px; border: 1px solid color-mix(in srgb, var(--text-primary) 15%, transparent); cursor: pointer; padding: 0;
      background-image: linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%); }
    .cp-trigger input { font-family: 'Space Mono', ui-monospace, monospace !important; text-transform: lowercase; }
    .cp-caret { cursor: pointer; }
    .cp-swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px;
      &.inline { display: flex; flex-wrap: wrap; gap: 8px; .sw { width: 30px; height: 30px; } } }
    .sw { aspect-ratio: 1; border-radius: 15px; border: 1px solid color-mix(in srgb, #000 10%, transparent); cursor: pointer; padding: 0;
      display: flex; align-items: center; justify-content: center; transition: transform 0.1s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { transform: scale(1.1); }
      &.on { box-shadow: 0 0 0 2px var(--card-bg), 0 0 0 4px var(--text-primary); } }
  `],
})
export class ColorPickerComponent implements ControlValueAccessor {
  swatches = input<string[]>(DEFAULT_SWATCHES);
  inline = input(false, { transform: booleanAttribute });

  private svEl = viewChild<ElementRef<HTMLElement>>('sv');
  readonly eyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  ];
  value = signal('');
  open = signal(false);
  disabled = signal(false);
  recent = signal<string[]>([]);
  /** Teinte mémorisée (une couleur grise n'en porte pas). */
  private hue = signal(230);
  hsv = computed(() => { const c = hexToHsv(this.value() || '#4f6bed'); return { ...c, h: c.s === 0 ? this.hue() : c.h }; });
  hueColor = computed(() => `hsl(${this.hsv().h}, 100%, 50%)`);

  private onChange: (v: string) => void = () => {};
  private touched: () => void = () => {};

  contrast(hex: string): string { const { r, g, b } = hexToRgb(hex); return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#0f172a' : '#fff'; }

  private emit(hex: string, remember = false): void {
    this.value.set(hex);
    this.onChange(hex);
    if (remember && !this.swatches().includes(hex)) this.recent.update((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 8));
  }
  pick(c: string): void { this.hue.set(hexToHsv(c).h); this.emit(c); this.touched(); }
  typed(el: HTMLInputElement): void {
    let v = el.value.trim().toLowerCase();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v.slice(1).split('').map((c) => c + c).join('');
    if (/^#[0-9a-f]{6}$/.test(v)) { this.pick(v); this.recent.update((r) => [v, ...r.filter((c) => c !== v)].slice(0, 8)); }
    else el.value = this.value();
  }
  setHue(h: number): void { this.hue.set(h); const { s, v } = this.hsv(); this.emit(hsvToHex(h, s || 1, v || 1), true); }
  svDown(e: PointerEvent): void {
    const el = this.svEl()!.nativeElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const v = 1 - Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      this.emit(hsvToHex(this.hsv().h, s, v));
    };
    move(e);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', () => { el.removeEventListener('pointermove', move); this.emit(this.value(), true); }, { once: true });
  }
  async eyedrop(): Promise<void> {
    try { const r = await new (window as any).EyeDropper().open(); this.pick(r.sRGBHex.toLowerCase()); } catch { /* annulé */ }
  }

  writeValue(v: string | null): void { this.value.set((v ?? '').toLowerCase()); if (v) this.hue.set(hexToHsv(v).h); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex) ?? ['', '000000'];
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = hexToRgb(hex);
  const R = r / 255, G = g / 255, B = b / 255, max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d) h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: Math.round((h * 60 + 360) % 360), s: max ? d / max : 0, v: max };
}
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
