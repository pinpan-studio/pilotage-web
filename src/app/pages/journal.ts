import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsJournal, projetsSessions } from '../../api/genere/functions';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { versIso } from '../noyau/dates';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
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
  imports: [MatIconModule, GroupedBoardComponent, SkeletonComponent, DefilementInfiniDirective, ...PIPES, FormsModule, MatButtonModule, MatDatepickerModule, SearchableSelectComponent],
  styles: [`.filtres-j { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--space-2); margin: var(--space-3) 0; align-items: center; }
    .card.plan { padding: var(--space-4); } .fin { padding: var(--space-4) 0 var(--space-2); text-align: center; font-size: var(--fs-caption); color: var(--text-muted); }`],
  template: `
  <div class="m3-filter-toggle" role="tablist" aria-label="Journal">
    <button type="button" role="tab" [class.active]="vue() === 'evenements'" (click)="vue.set('evenements')"><mat-icon>history</mat-icon>Événements</button>
    <button type="button" role="tab" [class.active]="vue() === 'sessions'" (click)="vue.set('sessions')"><mat-icon>code</mat-icon>Sessions</button>
  </div>
  @if (vue() === 'evenements') {
    <div class="filtres-j">
      <app-searchable-select [ngModel]="f().depot" (ngModelChange)="filtrer({ depot: $event })" [options]="oDepots()" icon="source" placeholder="Tous les dépôts" [allowNull]="true" nullLabel="Tous les dépôts" />
      <app-searchable-select [ngModel]="f().evt" (ngModelChange)="filtrer({ evt: $event })" [options]="oTypes" icon="category" placeholder="Tous les types" [allowNull]="true" nullLabel="Tous les types" />
      <div class="form-field"><div class="field-box"><mat-icon>person</mat-icon><input placeholder="Auteur" [ngModel]="f().auteur" (change)="filtrer({ auteur: $any($event.target).value })" list="auteurs-j" /><datalist id="auteurs-j">@for (a of auteurs(); track a) { <option [value]="a"></option> }</datalist></div></div>
      <div class="form-field"><div class="field-box"><mat-icon>checklist</mat-icon><input placeholder="F-012" [ngModel]="f().fonctionnalite" (change)="filtrer({ fonctionnalite: $any($event.target).value.trim().toUpperCase() })" /></div></div>
      <div class="form-field"><div class="field-box"><mat-icon>date_range</mat-icon>
        <mat-date-range-input [rangePicker]="per"><input matStartDate [ngModel]="debut" (dateChange)="debut = $event.value" placeholder="Du" /><input matEndDate [ngModel]="fin2" (dateChange)="fin2 = $event.value; filtrer({ depuis: versIso(debut) ?? undefined, jusqua: versIso(fin2) ?? undefined })" placeholder="au" /></mat-date-range-input>
        <mat-date-range-picker #per /><button mat-icon-button type="button" (click)="per.open()" aria-label="Période"><mat-icon>calendar_month</mat-icon></button></div></div>
      @if (actifs()) { <button mat-button (click)="reinitialiser()"><mat-icon>filter_alt_off</mat-icon>Effacer</button> }
    </div>
  }
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

  readonly f = signal<{ depot?: string; evt?: string; auteur?: string; fonctionnalite?: string; depuis?: string; jusqua?: string }>({});
  debut: Date | null = null; fin2: Date | null = null;
  readonly versIso = versIso;
  readonly oTypes = Object.keys(ICONES).map((k) => ({ value: k, label: k, icon: ICONES[k] }));
  readonly oDepots = computed(() => (this.p.detail()?.depots ?? []).map((d) => ({ value: d.nom, label: d.nom, icon: 'source' })));
  readonly auteurs = computed(() => [...new Set([...(this.sessions() ?? []).map((s) => s.auteur), ...this.elements().map((e) => e.auteur)].filter(Boolean))].sort());
  readonly actifs = computed(() => Object.values(this.f()).some((v) => !!v));
  filtrer(x: Partial<ReturnType<typeof this.f>>) {
    const n = { ...this.f(), ...x }; for (const k of Object.keys(n) as (keyof typeof n)[]) if (!n[k]) delete n[k];
    this.f.set(n); this.recharger();
  }
  reinitialiser() { this.debut = null; this.fin2 = null; this.f.set({}); this.recharger(); }
  private recharger() { this.page = 0; this.elements.set([]); this.total.set(null); this.chargement.set(false); this.suivante(); }
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
      const r = await this.api.invoke(projetsJournal, { code: this.p.code(), page: this.page + 1, par_page: PAR_PAGE, ...this.f() });
      this.page = r.page; this.total.set(r.total); this.elements.update((l) => [...l, ...r.elements]);
    } finally { this.chargement.set(false); setTimeout(() => this.sentinelle()?.verifier(), 50); }
  }
}
