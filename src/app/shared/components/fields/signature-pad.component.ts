import { Component, DestroyRef, ElementRef, afterNextRender, booleanAttribute, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Pt { x: number; y: number; t: number; w: number; }
interface Stroke { color: string; points: Pt[]; }

/**
 * Pavé de signature (canvas, souris / doigt / stylet) : trait lissé à épaisseur variable selon la vitesse
 * (et la pression du stylet), annuler, effacer, choix d'encre, redimensionnement net (haute densité).
 * Valeur du modèle : data URL PNG (fond transparent) ou `null`.
 *
 * ```html
 * <app-signature-pad [(ngModel)]="signature" label="Signature du client" />
 * ```
 */
@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SignaturePadComponent), multi: true }],
  template: `
    <div class="sig" [class.disabled]="disabled()" [class.signed]="strokes().length > 0" [class.invalid]="invalid()">
      <canvas #canvas [style.height]="height()" (pointerdown)="down($event)" aria-label="Zone de signature" role="img"></canvas>
      <div class="sig-line"><span>✕</span><i></i></div>
      @if (!strokes().length) { <div class="sig-hint"><mat-icon>draw</mat-icon>{{ placeholder() }}</div> }
      <div class="sig-tools">
        @for (c of inks(); track c) {
          <button type="button" class="ink" [style.background]="c" [class.on]="c === ink()" (click)="ink.set(c)" [attr.aria-label]="'Encre ' + c"></button>
        }
        <span class="sep"></span>
        <button type="button" (click)="undo()" [disabled]="!strokes().length || disabled()" matTooltip="Annuler le dernier trait"><mat-icon>undo</mat-icon></button>
        <button type="button" (click)="clear()" [disabled]="!strokes().length || disabled()" matTooltip="Effacer"><mat-icon>delete_outline</mat-icon></button>
      </div>
    </div>
    @if (signedAt() && showDate()) { <span class="sig-meta"><mat-icon>verified</mat-icon>Signé le {{ signedAt() }}</span> }
  `,
  styles: [`
    :host { display: block; }
    .sig { position: relative; border: 1px dashed var(--border-color); border-radius: var(--r-m, 12px); background: var(--mat-sys-surface-container-high, var(--hover-bg)); overflow: hidden; transition: all 0.15s ease;
      &.signed { border-style: solid; background: var(--card-bg); }
      &.invalid { border-color: var(--error-color); }
      &.disabled { opacity: 0.6; pointer-events: none; } }
    canvas { display: block; width: 100%; touch-action: none; cursor: crosshair; position: relative; z-index: 1; }
    .sig-line { position: absolute; left: 24px; right: 24px; bottom: 34%; display: flex; align-items: flex-end; gap: 8px; pointer-events: none; color: var(--text-muted);
      span { font-size: 14px; line-height: 1; } i { flex: 1; border-bottom: 1px solid color-mix(in srgb, var(--text-muted) 50%, transparent); } }
    .sig-hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--text-muted); font-size: 13px; pointer-events: none;
      mat-icon { font-size: 20px; width: 20px; height: 20px; } }
    .sig-tools { position: absolute; z-index: 2; top: 8px; right: 8px; display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 18px; background: var(--card-bg); box-shadow: var(--elevation-1);
      button:not(.ink) { width: 30px; height: 30px; border: none; border-radius: 50%; background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 18px; width: 18px; height: 18px; } &:hover:not(:disabled) { background: var(--hover-bg); } &:disabled { opacity: 0.35; cursor: default; } }
      .ink { width: 18px; height: 18px; margin: 0 2px; border-radius: 50%; border: 2px solid var(--card-bg); cursor: pointer; padding: 0;
        &.on { box-shadow: 0 0 0 2px var(--text-secondary); } }
      .sep { width: 1px; height: 18px; background: var(--border-color); margin: 0 2px; } }
    .sig-meta { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 11.5px; color: var(--success-color-text, var(--success-color));
      mat-icon { font-size: 15px; width: 15px; height: 15px; } }
  `],
})
export class SignaturePadComponent implements ControlValueAccessor {
  height = input('180px');
  placeholder = input('Signez dans ce cadre');
  inks = input(['#0f172a', '#1d4ed8', '#4f6bed']);
  minWidth = input(0.8);
  maxWidth = input(3);
  invalid = input(false);
  showDate = input(true, { transform: booleanAttribute });
  signed = output<string | null>();

  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  strokes = signal<Stroke[]>([]);
  ink = signal('#0f172a');
  disabled = signal(false);
  signedAt = signal<string | null>(null);
  private pendingImage: string | null = null;

  private onChange: (v: string | null) => void = () => {};
  private touched: () => void = () => {};

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.ink.set(this.inks()[0]);
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.canvasRef().nativeElement);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  private get ctx(): CanvasRenderingContext2D { return this.canvasRef().nativeElement.getContext('2d')!; }

  private resize(): void {
    const c = this.canvasRef().nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    if (!width) return;
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  private redraw(): void {
    const c = this.canvasRef().nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    if (this.pendingImage && !this.strokes().length) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0, c.getBoundingClientRect().width, c.getBoundingClientRect().height);
      img.src = this.pendingImage;
    }
    for (const s of this.strokes()) this.drawStroke(s, 0);
  }

  /** Dessine un trait à partir du point `from` (segments quadratiques lissés). */
  private drawStroke(s: Stroke, from: number): void {
    const g = this.ctx, p = s.points;
    g.strokeStyle = g.fillStyle = s.color;
    g.lineCap = g.lineJoin = 'round';
    if (p.length === 1) { g.beginPath(); g.arc(p[0].x, p[0].y, p[0].w / 2, 0, Math.PI * 2); g.fill(); return; }
    for (let i = Math.max(1, from); i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      const pa = i > 1 ? { x: (p[i - 2].x + a.x) / 2, y: (p[i - 2].y + a.y) / 2 } : a;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      g.lineWidth = (a.w + b.w) / 2;
      g.beginPath(); g.moveTo(pa.x, pa.y); g.quadraticCurveTo(a.x, a.y, mid.x, mid.y); g.stroke();
    }
  }

  down(e: PointerEvent): void {
    if (this.disabled() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const c = this.canvasRef().nativeElement;
    c.setPointerCapture(e.pointerId);
    const r = c.getBoundingClientRect();
    const stroke: Stroke = { color: this.ink(), points: [] };
    const add = (ev: PointerEvent) => {
      const x = ev.clientX - r.left, y = ev.clientY - r.top, t = ev.timeStamp;
      const last = stroke.points[stroke.points.length - 1];
      let w = (this.minWidth() + this.maxWidth()) / 2;
      if (last) {
        const v = Math.hypot(x - last.x, y - last.y) / Math.max(1, t - last.t);
        w = Math.max(this.minWidth(), Math.min(this.maxWidth(), this.maxWidth() - v * 1.6));
        w = last.w * 0.7 + w * 0.3;
        if (Math.hypot(x - last.x, y - last.y) < 1.2) return;
      }
      if (ev.pointerType === 'pen' && ev.pressure) w = this.minWidth() + (this.maxWidth() - this.minWidth()) * ev.pressure;
      stroke.points.push({ x, y, t, w });
      this.drawStroke(stroke, stroke.points.length - 1);
    };
    add(e);
    this.strokes.update((s) => [...s, stroke]);
    const move = (ev: PointerEvent) => (ev.getCoalescedEvents?.() ?? [ev]).forEach(add);
    const up = () => {
      c.removeEventListener('pointermove', move);
      if (stroke.points.length === 1) this.drawStroke(stroke, 0);
      this.emit();
      this.touched();
    };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up, { once: true });
    c.addEventListener('pointercancel', up, { once: true });
  }

  undo(): void { this.strokes.update((s) => s.slice(0, -1)); this.pendingImage = null; this.redraw(); this.emit(); }
  clear(): void { this.strokes.set([]); this.pendingImage = null; this.redraw(); this.emit(); }

  private emit(): void {
    const v = this.strokes().length ? this.canvasRef().nativeElement.toDataURL('image/png') : null;
    this.signedAt.set(v ? new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : null);
    this.onChange(v);
    this.signed.emit(v);
  }

  writeValue(v: string | null): void {
    this.strokes.set([]);
    this.pendingImage = v;
    try { this.redraw(); } catch { /* vue non encore initialisée : le ResizeObserver redessinera */ }
  }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.touched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
