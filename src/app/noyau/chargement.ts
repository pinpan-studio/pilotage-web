import { Component, input } from '@angular/core';
import { SkeletonComponent } from '../shared/components/skeleton/skeleton.component';

/**
 * Squelettes de chargement à la forme des pages (blocs app-skeleton du ui-kit) :
 * tableau-de-bord, table, liste, document, planning, parametres.
 */
@Component({
  selector: 'app-chargement',
  imports: [SkeletonComponent],
  styles: [`
    :host { display: block; }
    .kp { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4); }
    .g3 { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-4); }
    .bloc { background: var(--card-bg); border-radius: var(--radius-md); padding: var(--space-5); }
    .haut { height: 280px; }
    .barre { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
    .barre i { display: block; height: 32px; width: 110px; border-radius: var(--radius-sm); }
    .doc { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-4); }
    i, .sk { background: linear-gradient(90deg, var(--hover-bg) 25%, color-mix(in srgb, var(--hover-bg) 40%, var(--card-bg)) 50%, var(--hover-bg) 75%); background-size: 200% 100%; animation: brille 1.4s ease-in-out infinite; }
    .sk { border-radius: var(--radius-sm); }
    @keyframes brille { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
    @media (max-width: 960px) { .kp { grid-template-columns: repeat(2, minmax(0, 1fr)); } .g3, .doc { grid-template-columns: 1fr; } }
  `],
  template: `
  @switch (forme()) {
    @case ('tableau-de-bord') {
      <div class="kp">@for (i of [1,2,3,4]; track i) { <div class="bloc"><app-skeleton variant="line" [count]="3" /></div> }</div>
      <div class="g3"><div class="bloc haut sk"></div><div class="bloc"><app-skeleton variant="avatar" [count]="5" /></div></div>
      <div class="g3" style="margin-top: 16px"><div class="bloc"><app-skeleton variant="table-row" [count]="5" /></div><div class="bloc"><app-skeleton variant="line" [count]="6" /></div></div>
    }
    @case ('table') {
      <div class="barre">@for (i of [1,2,3,4,5]; track i) { <i></i> }</div>
      <div class="bloc"><app-skeleton variant="table-row" [count]="lignes()" /></div>
    }
    @case ('planning') {
      <div class="barre">@for (i of [1,2,3,4]; track i) { <i></i> }</div>
      <div class="bloc"><app-skeleton variant="card" [count]="8" /></div>
    }
    @case ('document') {
      <div class="doc"><div class="bloc"><app-skeleton variant="line" [count]="14" /></div><div class="bloc"><app-skeleton variant="avatar" [count]="4" /></div></div>
    }
    @case ('parametres') { <div class="bloc"><app-skeleton variant="avatar" [count]="lignes()" /></div> }
    @default { <app-skeleton variant="avatar" [count]="lignes()" /> }
  }`,
})
export class Chargement {
  readonly forme = input<'tableau-de-bord' | 'table' | 'liste' | 'document' | 'planning' | 'parametres'>('liste');
  readonly lignes = input(6);
}
