import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsJournal, projetsSessions } from '../../api/genere/functions';
import { EvenementDto, SessionDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { dateHeure } from '../noyau/format';
import { SkeletonComponent } from '../shared/components/skeleton/skeleton.component';
import { DefilementInfiniDirective } from '../shared/directives/defilement-infini.directive';
import { GroupedBoardComponent, PlanningFilter, PlanningGroup, PlanningItem, PlanningTone } from '../shared/components/planning';
import { ProjetCourant } from './projet';

const ICONES: Record<string, string> = { modification: 'edit', creation: 'note_add', commande: 'terminal', commit: 'commit', doc: 'description', agent: 'smart_toy' };
const TONS: Record<string, PlanningTone> = { modification: 'neutral', creation: 'primary', commande: 'info', commit: 'success', doc: 'purple', agent: 'purple' };
const PAR_PAGE = 50;
type Vue = 'evenements' | 'sessions';

/**
 * Journal : vue groupée du ui-kit en liste (démo « Par véhicule (liste) », layout="list"), un groupe par dépôt.
 * Événements chargés au fil du défilement (pages de 50) ; sessions de développement.
 */
@Component({
  selector: 'app-journal',
  imports: [MatIconModule, GroupedBoardComponent, SkeletonComponent, DefilementInfiniDirective, ...PIPES],
  styles: [`.card.plan { padding: var(--space-4); } .fin { padding: var(--space-4) 0 var(--space-2); text-align: center; font-size: var(--fs-caption); color: var(--text-muted); }`],
  template: `
  <div class="m3-filter-toggle" role="tablist" aria-label="Journal">
    <button type="button" role="tab" [class.active]="vue() === 'evenements'" (click)="vue.set('evenements')"><mat-icon>history</mat-icon>Événements</button>
    <button type="button" role="tab" [class.active]="vue() === 'sessions'" (click)="vue.set('sessions')"><mat-icon>code</mat-icon>Sessions</button>
  </div>
  <section class="card plan">
    @if (vue() === 'evenements') {
      @if (elements().length) {
        <app-grouped-board [items]="itemsEvenements()" [groups]="depots()" layout="list" [showProgress]="false" [searchable]="true" [filters]="filtres" ungroupedLabel="Sans dépôt" />
      }
      @if (chargement()) { <app-skeleton variant="avatar" [count]="elements().length ? 3 : 8" /> }
      @else if (fin() && elements().length) { <div class="fin">Début du journal atteint · {{ elements().length }} événement(s) sur {{ total() }}</div> }
      <div appDefilementInfini [actif]="!fin() && !chargement()" (atteint)="suivante()"></div>
    } @else {
      @if (!sessions()) { <app-skeleton variant="avatar" [count]="5" /> }
      @else { <app-grouped-board [items]="itemsSessions()" [groups]="depots()" layout="list" [showProgress]="false" [searchable]="true" ungroupedLabel="Sans dépôt" /> }
    }
  </section>`,
})
export class Journal {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly sentinelle = viewChild(DefilementInfiniDirective);
  readonly vue = signal<Vue>('evenements');
  readonly sessions = signal<SessionDto[] | null>(null);
  readonly elements = signal<EvenementDto[]>([]);
  readonly total = signal<number | null>(null);
  readonly chargement = signal(false);
  private page = 0;
  readonly fin = computed(() => this.total() !== null && this.elements().length >= this.total()!);
  readonly filtres: PlanningFilter[] = [{ key: 'evt', label: 'Type', allLabel: 'Tous', options: Object.keys(ICONES).map((k) => ({ value: k, label: k })) }];

  readonly depots = computed<PlanningGroup[]>(() => (this.p.detail()?.depots ?? []).map((d) => ({ key: d.nom, label: d.nom, subtitle: d.stack, icon: 'source' })));
  readonly itemsEvenements = computed<PlanningItem[]>(() => this.elements().map((e) => ({
    id: e.id, ref: dateHeure(e.ts).replace(/\/\d{4}/, '').replace(' ', ' · '),
    title: `${e.hash ? e.hash + ' — ' : ''}${e.evt === 'commit' ? e.message : (e.fichier || e.commande || e.message)} · ${e.auteur}`, group: e.depot ?? undefined,
    start: e.ts, assignee: e.auteur, tone: TONS[e.evt] ?? 'neutral', badge: { label: e.evt, tone: TONS[e.evt] ?? 'neutral' },
    description: dateHeure(e.ts), tags: e.fonctionnalites, fields: { evt: e.evt } })));
  readonly itemsSessions = computed<PlanningItem[]>(() => (this.sessions() ?? []).map((s) => {
    const resume = s.resume.replace(/^---[\s\S]*?---/, '').split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').trim()).filter((l) => l && !/^Session du/.test(l));
    return { id: s.id, title: resume[0] || (s.notes[0]?.texte ?? 'Session'), description: resume.slice(1, 3).join(' · '), group: s.depot ?? undefined,
      start: s.debut, end: s.fin ?? undefined, done: !!s.fin, assignee: s.auteur, tone: s.utilisateur_id ? 'purple' : 'info',
      badge: s.utilisateur_id ? { label: 'Agent', tone: 'purple' } : { label: s.fin ? 'Clôturée' : 'En cours', tone: s.fin ? 'success' : 'info' },
      tags: [...s.fonctionnalites, ...(s.notes.length ? [`${s.notes.length} note(s)`] : [])] };
  }));

  constructor() {
    effect(() => {
      const c = this.p.code(); if (!c) return;
      untracked(() => {
        this.api.invoke(projetsSessions, { code: c }).then((s) => this.sessions.set(s)).catch(() => this.sessions.set([]));
        this.page = 0; this.elements.set([]); this.total.set(null); this.chargement.set(false);
        this.suivante();
      });
    });
  }
  async suivante() {
    if (this.chargement() || this.fin()) return;
    this.chargement.set(true);
    try {
      const r = await this.api.invoke(projetsJournal, { code: this.p.code(), page: this.page + 1, par_page: PAR_PAGE });
      this.page = r.page; this.total.set(r.total); this.elements.update((l) => [...l, ...r.elements]);
    } finally { this.chargement.set(false); setTimeout(() => this.sentinelle()?.verifier(), 50); }
  }
}
