import { Component, DestroyRef, ElementRef, afterNextRender, booleanAttribute, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type CounterFormat = 'number' | 'currency' | 'percent' | 'compact';

/**
 * Nombre animé (compte de l'ancienne à la nouvelle valeur, easing) : se déclenche à l'apparition à l'écran
 * puis à chaque changement de valeur. Formats nombre, FCFA, pourcentage, compact (1,2 M).
 * Respecte `prefers-reduced-motion`.
 *
 * ```html
 * <app-stat-counter [value]="ca" format="currency" [duration]="1200" />
 * ```
 */
@Component({
  selector: 'app-stat-counter',
  standalone: true,
  template: `{{ prefix() }}{{ text() }}{{ suffix() }}`,
  styles: [`:host { font-variant-numeric: tabular-nums; white-space: nowrap; }`],
})
export class StatCounterComponent {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  value = input.required<number>();
  format = input<CounterFormat>('number');
  decimals = input(0);
  duration = input(1000);
  prefix = input('');
  suffix = input('');
  currency = input('FCFA');

  private shown = signal(0);
  private visible = signal(false);
  private raf = 0;

  text = computed(() => formatStat(this.shown(), this.format(), this.decimals(), this.currency()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { this.visible.set(true); io.disconnect(); } });
      io.observe(this.el.nativeElement);
      destroyRef.onDestroy(() => { io.disconnect(); cancelAnimationFrame(this.raf); });
    });
    effect(() => {
      const to = this.value();
      if (!this.visible()) return;
      untracked(() => this.animate(this.shown(), to));
    });
  }

  private animate(from: number, to: number): void {
    cancelAnimationFrame(this.raf);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === to) { this.shown.set(to); return; }
    const start = performance.now(), d = this.duration();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / d);
      const eased = 1 - Math.pow(1 - t, 4);
      this.shown.set(from + (to - from) * eased);
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

export function formatStat(v: number, format: CounterFormat, decimals = 0, currency = 'FCFA'): string {
  const nf = (n: number, d = decimals) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, ' ');
  switch (format) {
    case 'currency': return `${nf(v)} ${currency}`;
    case 'percent': return `${nf(v, decimals || 1)} %`;
    case 'compact': {
      const a = Math.abs(v);
      return a >= 1e9 ? `${nf(v / 1e9, 1)} Md` : a >= 1e6 ? `${nf(v / 1e6, 1)} M` : a >= 1e3 ? `${nf(v / 1e3, 1)} k` : nf(v);
    }
    default: return nf(v);
  }
}

/**
 * Badge de tendance (↑ 12,4 %) : couleur selon le sens et selon que la hausse est bonne ou non
 * (`inverse` : une baisse est positive — délais, pannes, coûts).
 *
 * ```html
 * <app-trend [value]="12.4" label="vs mois dernier" />
 * <app-trend [value]="-8" inverse />
 * ```
 */
@Component({
  selector: 'app-trend',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <span class="tr" [class]="'tr tr--' + tone()" [class.soft]="soft()">
      <mat-icon>{{ value() > 0 ? 'trending_up' : value() < 0 ? 'trending_down' : 'trending_flat' }}</mat-icon>
      {{ value() > 0 ? '+' : '' }}{{ value().toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}{{ unit() }}
    </span>
    @if (label()) { <span class="tr-label">{{ label() }}</span> }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 6px; }
    .tr { display: inline-flex; align-items: center; gap: 3px; font: 600 12px 'Inter', sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.soft { padding: 2px 8px 2px 6px; border-radius: 12px; } }
    .tr--up { color: var(--success-color-text, var(--success-color)); &.soft { background: var(--success-color-light); } }
    .tr--down { color: var(--error-color-text, var(--error-color)); &.soft { background: var(--error-color-light); } }
    .tr--flat { color: var(--text-muted); &.soft { background: var(--hover-bg); } }
    .tr-label { font-size: 12px; color: var(--text-muted); }
  `],
})
export class TrendComponent {
  value = input.required<number>();
  unit = input(' %');
  label = input('');
  inverse = input(false, { transform: booleanAttribute });
  soft = input(true, { transform: booleanAttribute });
  tone = computed(() => {
    const v = this.value();
    if (Math.abs(v) < 0.05) return 'flat';
    return (v > 0) !== this.inverse() ? 'up' : 'down';
  });
}
