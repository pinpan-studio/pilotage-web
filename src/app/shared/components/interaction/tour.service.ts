import { Component, Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { MatIconModule } from '@angular/material/icon';

export interface TourStep {
  /** Sélecteur CSS ou élément à mettre en avant (absent : carte centrée). */
  target?: string | HTMLElement;
  title: string;
  content: string;
  icon?: string;
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  /** Exécuté avant l'affichage de l'étape (ouvrir un onglet, faire défiler…). */
  before?: () => void | Promise<void>;
}

export interface TourOptions { onFinish?: (completed: boolean) => void; padding?: number; }

interface Rect { top: number; left: number; width: number; height: number; }

/**
 * Visite guidée / onboarding : met en lumière les éléments un par un (projecteur), avec carte d'explication
 * positionnée automatiquement, progression, Précédent / Suivant / Passer, clavier (←/→, Échap),
 * suivi du redimensionnement et du défilement.
 *
 * ```ts
 * tour.start([{ target: '#filtres', title: 'Filtres', content: 'Affinez la liste…' }, …], { onFinish: (ok) => … });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private overlay = inject(Overlay);
  private zone = inject(NgZone);
  private ref?: OverlayRef;
  private opts: TourOptions = {};
  private listener = () => this.measure();
  private keyListener = (e: KeyboardEvent) => this.onKey(e);

  readonly steps = signal<TourStep[]>([]);
  readonly index = signal(0);
  readonly rect = signal<Rect | null>(null);
  readonly active = computed(() => !!this.steps().length);
  readonly step = computed(() => this.steps()[this.index()]);

  start(steps: TourStep[], opts: TourOptions = {}): void {
    this.end(false, true);
    this.opts = opts;
    this.steps.set(steps);
    this.ref = this.overlay.create({ positionStrategy: this.overlay.position().global(), width: '100vw', height: '100vh', panelClass: 'kit-tour-pane' });
    this.ref.attach(new ComponentPortal(TourOverlayComponent));
    window.addEventListener('resize', this.listener);
    window.addEventListener('scroll', this.listener, true);
    document.addEventListener('keydown', this.keyListener, true);
    void this.go(0);
  }

  async go(i: number): Promise<void> {
    const s = this.steps()[i];
    if (!s) return;
    await s.before?.();
    this.index.set(i);
    const el = this.el(s);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this.measure();
    // Re-mesure après le défilement fluide.
    setTimeout(() => this.measure(), 380);
  }
  next(): void { this.index() < this.steps().length - 1 ? void this.go(this.index() + 1) : this.end(true); }
  prev(): void { if (this.index() > 0) void this.go(this.index() - 1); }

  end(completed = false, silent = false): void {
    if (!this.ref) return;
    this.ref.dispose();
    this.ref = undefined;
    window.removeEventListener('resize', this.listener);
    window.removeEventListener('scroll', this.listener, true);
    document.removeEventListener('keydown', this.keyListener, true);
    this.steps.set([]);
    this.rect.set(null);
    if (!silent) this.opts.onFinish?.(completed);
  }

  private el(s: TourStep): HTMLElement | null {
    return !s.target ? null : typeof s.target === 'string' ? document.querySelector<HTMLElement>(s.target) : s.target;
  }
  private measure(): void {
    const s = this.step();
    const el = s && this.el(s);
    if (!el) { this.rect.set(null); return; }
    const r = el.getBoundingClientRect(), p = this.opts.padding ?? 8;
    this.zone.run(() => this.rect.set({ top: r.top - p, left: r.left - p, width: r.width + p * 2, height: r.height + p * 2 }));
  }
  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.end(false); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); this.next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
  }
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="kit-tour" (click)="$event.stopPropagation()">
      @if (tour.rect(); as r) {
        <div class="tour-spot" [style.top.px]="r.top" [style.left.px]="r.left" [style.width.px]="r.width" [style.height.px]="r.height"></div>
      } @else { <div class="tour-dim"></div> }
      @if (tour.step(); as s) {
        <div class="tour-card" role="dialog" aria-modal="true" [attr.aria-label]="s.title" [style.top.px]="card().top" [style.left.px]="card().left" [class]="'tour-card arrow-' + card().side">
          <div class="tc-head">
            @if (s.icon) { <span class="tc-ic"><mat-icon>{{ s.icon }}</mat-icon></span> }
            <strong>{{ s.title }}</strong>
            <button type="button" class="tc-x" (click)="tour.end(false)" aria-label="Fermer la visite"><mat-icon>close</mat-icon></button>
          </div>
          <p>{{ s.content }}</p>
          <div class="tc-foot">
            <div class="tc-dots">@for (x of tour.steps(); track $index) { <i [class.on]="$index === tour.index()" [class.done]="$index < tour.index()"></i> }</div>
            <span class="tc-count">{{ tour.index() + 1 }} / {{ tour.steps().length }}</span>
            <span class="spacer"></span>
            @if (tour.index() > 0) { <button type="button" class="tc-btn ghost" (click)="tour.prev()">Précédent</button> }
            @else { <button type="button" class="tc-btn ghost" (click)="tour.end(false)">Passer</button> }
            <button type="button" class="tc-btn" (click)="tour.next()">{{ tour.index() === tour.steps().length - 1 ? 'Terminer' : 'Suivant' }}</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class TourOverlayComponent {
  readonly tour = inject(TourService);
  private readonly W = 340;
  private readonly H = 190;

  card = computed(() => {
    const r = this.tour.rect(), vw = window.innerWidth, vh = window.innerHeight, m = 12, W = Math.min(this.W, vw - 24);
    if (!r) return { top: vh / 2 - this.H / 2, left: vw / 2 - W / 2, side: 'none' };
    const pref = this.tour.step()?.placement ?? 'auto';
    const fits = {
      bottom: r.top + r.height + m + this.H < vh, top: r.top - m - this.H > 0,
      right: r.left + r.width + m + W < vw, left: r.left - m - W > 0,
    };
    const side = pref !== 'auto' && fits[pref] ? pref : (['bottom', 'top', 'right', 'left'] as const).find((s) => fits[s]) ?? 'bottom';
    const clampX = (x: number) => Math.max(12, Math.min(vw - W - 12, x));
    const clampY = (y: number) => Math.max(12, Math.min(vh - this.H - 12, y));
    switch (side) {
      case 'bottom': return { top: Math.min(vh - this.H - 12, r.top + r.height + m), left: clampX(r.left + r.width / 2 - W / 2), side };
      case 'top': return { top: Math.max(12, r.top - m - this.H), left: clampX(r.left + r.width / 2 - W / 2), side };
      case 'right': return { top: clampY(r.top + r.height / 2 - this.H / 2), left: r.left + r.width + m, side };
      default: return { top: clampY(r.top + r.height / 2 - this.H / 2), left: r.left - m - W, side };
    }
  });
}
