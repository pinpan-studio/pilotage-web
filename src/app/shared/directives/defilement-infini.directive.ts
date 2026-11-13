import { Directive, ElementRef, OnDestroy, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Défilement infini : placer sur un élément « sentinelle » en fin de liste.
 * `(atteint)` est émis quand la sentinelle devient visible (marge `marge` avant le bas), tant que `actif` est vrai.
 *
 * ```html
 * @for (e of elements(); track e.id) { … }
 * <div appDefilementInfini [actif]="!fin() && !chargement()" (atteint)="suivante()"></div>
 * ```
 */
@Directive({ selector: '[appDefilementInfini]', standalone: true })
export class DefilementInfiniDirective implements OnDestroy {
  readonly actif = input(true);
  readonly marge = input('400px');
  readonly atteint = output<void>();
  private readonly el = inject(ElementRef<HTMLElement>);
  private obs?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      this.obs = new IntersectionObserver((entrees) => { if (entrees.some((e) => e.isIntersecting) && this.actif()) this.atteint.emit(); }, { rootMargin: `0px 0px ${this.marge()} 0px` });
      this.obs.observe(this.el.nativeElement);
    });
  }
  /** À appeler après un chargement si la sentinelle est restée visible (liste courte). */
  verifier() { const r = this.el.nativeElement.getBoundingClientRect(); if (this.actif() && r.top < innerHeight + 400) this.atteint.emit(); }
  ngOnDestroy() { this.obs?.disconnect(); }
}
