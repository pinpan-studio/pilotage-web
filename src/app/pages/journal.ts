import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { Api } from '../../api/genere/api';
import { projetsJournal, projetsSessions } from '../../api/genere/functions';
import { EvenementDto, SessionDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { SkeletonComponent } from '../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { DefilementInfiniDirective } from '../shared/directives/defilement-infini.directive';
import { ProjetCourant } from './projet';

const ICONES: Record<string, string> = { modification: 'edit', creation: 'note_add', commande: 'terminal', commit: 'commit', doc: 'description', agent: 'smart_toy' };
const PAR_PAGE = 30;

/** Journal : sessions de développement et flux d'événements en défilement infini (pages de 30, filtres côté API). */
@Component({
  selector: 'app-journal',
  imports: [FormsModule, MatIconModule, MatExpansionModule, SkeletonComponent, EmptyStateComponent, DefilementInfiniDirective, ...PIPES],
  styles: [`.jour { position: sticky; top: 0; z-index: 1; padding: var(--space-3) 0 var(--space-2); background: var(--card-bg); font: 600 var(--fs-overline) / 1.4 var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
    .fin { padding: var(--space-4) 0 var(--space-2); text-align: center; font-size: var(--fs-caption); color: var(--text-muted); }`],
  template: `
  <div class="grid-3">
    <section class="card span-2">
      <div class="card-head"><h2>Événements</h2><span class="sub">{{ total() ?? '…' }} au total</span></div>
      <div class="card-body">
        <div class="toolbar-row">
          <button type="button" class="chip-filter" [class.on]="!evt()" (click)="filtrer('', depot())">Tous</button>
          @for (t of types; track t) { <button type="button" class="chip-filter" [class.on]="evt() === t" (click)="filtrer(t, depot())"><mat-icon>{{ icone(t) }}</mat-icon>{{ t }}</button> }
          <span class="spacer"></span>
          <select class="select-chip" [ngModel]="depot()" (ngModelChange)="filtrer(evt(), $event)" aria-label="Dépôt"><option value="">Tous les dépôts</option>@for (d of p.detail()?.depots ?? []; track d.id) { <option [value]="d.nom">{{ d.nom }}</option> }</select>
        </div>
        <div class="rows">
          @for (g of parJour(); track g.jour) {
            <div class="jour">{{ g.jour | dateFr }}</div>
            @for (e of g.elements; track e.id) {
              <div class="row" style="padding-left: 0; padding-right: 0">
                <span class="ic-tile" [class]="'ic-tile ' + (e.evt === 'commit' ? 'tone-success' : e.evt === 'doc' || e.evt === 'agent' ? 'tone-purple' : 'tone-neutral')"><mat-icon>{{ icone(e.evt) }}</mat-icon></span>
                <div class="grow"><strong class="mono">{{ e.hash ? e.hash + ' — ' : '' }}{{ e.fichier || e.commande || e.message }}</strong>
                  <small>{{ e.auteur }} · {{ e.depot ?? '—' }}@for (f of e.fonctionnalites; track f) { · {{ f }} }</small></div>
                <span class="num" style="font-size: 12px; font-weight: 500">{{ e.ts | dateFr: true }}</span></div>
            }
          }
          @if (chargement()) { <app-skeleton variant="avatar" [count]="elements().length ? 3 : 8" /> }
          @else if (!elements().length) { <app-empty-state icon="history" title="Aucun événement" subtitle="Rien ne correspond à ces filtres." /> }
          @else if (fin()) { <div class="fin">Début du journal atteint · {{ elements().length }} événement(s)</div> }
          <div appDefilementInfini [actif]="!fin() && !chargement()" (atteint)="suivante()"></div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Sessions</h2><span class="sub">{{ sessions()?.length ?? '…' }}</span></div>
      <div class="card-body">
        @if (!sessions()) { <app-skeleton variant="avatar" [count]="4" /> }
        @else {
          <mat-accordion displayMode="flat">
            @for (s of sessions(); track s.id) {
              <mat-expansion-panel>
                <mat-expansion-panel-header><mat-panel-title>{{ s.debut | dateFr }} · {{ s.depot ?? '—' }}</mat-panel-title>
                  <mat-panel-description>{{ s.auteur }}@if (s.utilisateur_id) { &nbsp;<span class="agent-badge"><mat-icon>smart_toy</mat-icon>Agent</span> }</mat-panel-description></mat-expansion-panel-header>
                @if (s.fonctionnalites.length) { <p>@for (f of s.fonctionnalites; track f) { <span class="ref">{{ f }}</span> }</p> }
                @if (s.notes.length) { <h3 style="margin-top:0">Notes</h3><ul>@for (n of s.notes; track n.ts) { <li><small class="muted">{{ n.ts | dateFr: true }}</small> — {{ n.texte }}</li> }</ul> }
                <div class="prose" style="font-size: var(--fs-body-sm)" [innerHTML]="s.resume | md"></div>
              </mat-expansion-panel>
            } @empty { <app-empty-state icon="code" title="Aucune session" subtitle="Les sessions Claude Code apparaîtront ici." /> }
          </mat-accordion>
        }
      </div>
    </section>
  </div>`,
})
export class Journal {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly sentinelle = viewChild(DefilementInfiniDirective);
  readonly types = Object.keys(ICONES);
  readonly sessions = signal<SessionDto[] | null>(null);
  readonly elements = signal<EvenementDto[]>([]);
  readonly total = signal<number | null>(null);
  readonly chargement = signal(false);
  readonly evt = signal(''); readonly depot = signal('');
  private page = 0;
  private generation = 0;
  readonly fin = computed(() => this.total() !== null && this.elements().length >= this.total()!);
  readonly parJour = computed(() => {
    const g: { jour: string; elements: EvenementDto[] }[] = [];
    for (const e of this.elements()) { const j = e.ts.slice(0, 10); if (g.at(-1)?.jour !== j) g.push({ jour: j, elements: [] }); g.at(-1)!.elements.push(e); }
    return g;
  });
  icone = (t: string) => ICONES[t] ?? 'circle';

  constructor() {
    effect(() => {
      const c = this.p.code(); if (!c) return;
      untracked(() => {
        this.api.invoke(projetsSessions, { code: c }).then((s) => this.sessions.set(s)).catch(() => this.sessions.set([]));
        this.filtrer('', '');
      });
    });
  }
  filtrer(evt: string, depot: string) {
    this.evt.set(evt); this.depot.set(depot);
    this.generation++; this.page = 0; this.elements.set([]); this.total.set(null); this.chargement.set(false);
    this.suivante();
  }
  async suivante() {
    if (this.chargement() || this.fin()) return;
    const gen = this.generation;
    this.chargement.set(true);
    try {
      const r = await this.api.invoke(projetsJournal, { code: this.p.code(), page: this.page + 1, par_page: PAR_PAGE, evt: this.evt() || undefined, depot: this.depot() || undefined });
      if (gen !== this.generation) return; // filtre changé entre-temps
      this.page = r.page; this.total.set(r.total); this.elements.update((l) => [...l, ...r.elements]);
    } finally {
      if (gen === this.generation) { this.chargement.set(false); setTimeout(() => this.sentinelle()?.verifier(), 50); }
    }
  }
}
