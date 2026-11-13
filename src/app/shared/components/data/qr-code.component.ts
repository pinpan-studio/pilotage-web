import { Component, booleanAttribute, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { QrEcc, encodeCode128, encodeQr, qrSvgPath } from '../../utils/qr-code.util';

/**
 * QR code SVG généré localement (aucun service externe) : niveau de correction L/M/Q/H, couleurs,
 * logo central optionnel (passer en niveau H), téléchargement PNG / SVG.
 *
 * ```html
 * <app-qr-code value="https://suivi.example.com/v/CI-4521-AB" [size]="160" ecc="Q" />
 * ```
 */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (matrix(); as m) {
      <div class="qr-box">
      <svg [attr.viewBox]="'0 0 ' + (m.length + quiet() * 2) + ' ' + (m.length + quiet() * 2)" [attr.width]="size()" [attr.height]="size()"
        shape-rendering="crispEdges" role="img" [attr.aria-label]="'QR code : ' + value()">
        <rect width="100%" height="100%" [attr.fill]="background()" [attr.rx]="rounded() ? 2 : 0" />
        <path [attr.d]="path()" [attr.fill]="color()" />
        @if (logo() || icon()) {
          <rect [attr.x]="logoBox().x" [attr.y]="logoBox().y" [attr.width]="logoBox().s" [attr.height]="logoBox().s" [attr.fill]="background()" rx="1.2" />
          @if (logo()) { <image [attr.href]="logo()" [attr.x]="logoBox().x + 0.6" [attr.y]="logoBox().y + 0.6" [attr.width]="logoBox().s - 1.2" [attr.height]="logoBox().s - 1.2" /> }
        }
      </svg>
      @if (icon() && !logo()) { <mat-icon class="qr-icon" [style.color]="color()" [style.font-size.px]="size() * 0.13">{{ icon() }}</mat-icon> }
      </div>
    } @else {
      <div class="qr-error" [style.width.px]="size()" [style.height.px]="size()">Texte trop long</div>
    }
    @if (caption()) { <span class="qr-caption">{{ caption() }}</span> }
  `,
  styles: [`
    :host { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; }
    svg { display: block; }
    .qr-box { position: relative; }
    .qr-icon { position: absolute; inset: 0; width: auto !important; height: auto !important; line-height: 1;
      display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .qr-caption { font: 600 12px 'Space Mono', ui-monospace, monospace; color: var(--text-secondary); letter-spacing: 0.05em; }
    .qr-error { display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border-color); border-radius: 8px; font-size: 12px; color: var(--text-muted); }
  `],
})
export class QrCodeComponent {
  value = input.required<string>();
  size = input(160);
  ecc = input<QrEcc>('M');
  color = input('#0f172a');
  background = input('#ffffff');
  quiet = input(4);
  rounded = input(true, { transform: booleanAttribute });
  /** Image centrale (data URL ou même origine) — utiliser ecc="H". */
  logo = input<string | null>(null);
  /** Icône Material centrale (alternative au logo). */
  icon = input<string | null>(null);
  caption = input('');

  matrix = computed(() => { try { return encodeQr(this.value(), this.logo() || this.icon() ? 'H' : this.ecc()); } catch { return null; } });
  path = computed(() => qrSvgPath(this.matrix() ?? [], this.quiet()));
  logoBox = computed(() => {
    const n = this.matrix()?.length ?? 21;
    const s = Math.round(n * 0.22);
    const x = this.quiet() + (n - s) / 2;
    return { x, y: x, s };
  });

  /** Sérialise le QR en SVG autonome (téléchargement). */
  toSvg(): string {
    const n = (this.matrix()?.length ?? 0) + this.quiet() * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${this.background()}"/><path d="${this.path()}" fill="${this.color()}"/></svg>`;
  }
  /** Rend le QR en PNG (data URL) à la résolution voulue. */
  toPng(px = 512): Promise<string> {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([this.toSvg()], { type: 'image/svg+xml' }));
    return new Promise((resolve) => {
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = px;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, px, px);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png'));
      };
      img.src = url;
    });
  }
}

/**
 * Code-barres Code 128 en SVG (jeu B, ou C pour les numériques de longueur paire), texte lisible dessous.
 *
 * ```html
 * <app-barcode value="CI-4521-AB" [height]="56" />
 * ```
 */
@Component({
  selector: 'app-barcode',
  standalone: true,
  template: `
    @if (bars(); as b) {
      <svg [attr.viewBox]="'0 0 ' + b.width + ' ' + height()" [attr.width]="b.width * moduleWidth()" [attr.height]="height()" preserveAspectRatio="none"
        shape-rendering="crispEdges" role="img" [attr.aria-label]="'Code-barres : ' + value()">
        <rect [attr.width]="b.width" [attr.height]="height()" [attr.fill]="background()" />
        @for (r of b.rects; track $index) { <rect [attr.x]="r[0]" y="0" [attr.width]="r[1]" [attr.height]="height()" [attr.fill]="color()" /> }
      </svg>
      @if (showText()) { <span class="bc-text">{{ value() }}</span> }
    } @else { <span class="bc-error">Valeur non encodable</span> }
  `,
  styles: [`
    :host { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
    svg { display: block; max-width: 100%; }
    .bc-text { font: 500 12px 'Space Mono', ui-monospace, monospace; letter-spacing: 0.18em; color: var(--text-primary); }
    .bc-error { font-size: 12px; color: var(--error-color); }
  `],
})
export class BarcodeComponent {
  value = input.required<string>();
  height = input(56);
  moduleWidth = input(2);
  color = input('#0f172a');
  background = input('#ffffff');
  showText = input(true, { transform: booleanAttribute });

  bars = computed(() => {
    let widths: number[];
    try { widths = encodeCode128(this.value()); } catch { return null; }
    const quiet = 10;
    const rects: [number, number][] = [];
    let x = quiet;
    widths.forEach((w, i) => { if (i % 2 === 0) rects.push([x, w]); x += w; });
    return { rects, width: x + quiet };
  });
}
