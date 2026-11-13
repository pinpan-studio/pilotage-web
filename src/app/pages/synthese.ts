import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData } from 'chart.js';
import { Api } from '../../api/genere/api';
import { projetsFonctionnalites, projetsJournal } from '../../api/genere/functions';
import { EvenementDto, FonctionnaliteDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Statut, tonDeCouleur } from '../noyau/statut';
import { GraphiquesService } from '../noyau/graphiques.service';
import { date, dateHeure } from '../noyau/format';
import { StatCounterComponent } from '../shared/components/data/stat-counter.component';
import { DataColumn, DataTableComponent } from '../shared/components/data/data-table.component';
import { BannerComponent } from '../shared/components/feedback';
import { ProjetCourant } from './projet';
import { Analyses, OngletAnalyse } from './analyses';

const ICONE_ALERTE: Record<string, string> = { haute: 'error', moyenne: 'warning', basse: 'info' };
const TON_ALERTE: Record<string, string> = { haute: 'tone-error', moyenne: 'tone-warning', basse: 'tone-neutral' };
const TON_EVT: Record<string, string> = { commit: 'success', doc: 'purple', agent: 'purple', commande: 'info', creation: 'primary', modification: 'neutral' };

interface Surveillance { id: string; ref: string; titre: string; statut: string; statut_code: string; raison: string; avancement: number; activite: string }

/** Vue d'ensemble d'un projet — composition du tableau de bord du ui-kit (examples/app/dashboard). */
import { Chargement } from '../noyau/chargement';
@Component({
  selector: 'app-synthese',
  imports: [Chargement, Analyses, DecimalPipe, RouterLink, MatIconModule, MatProgressBarModule, BaseChartDirective, StatCounterComponent, DataTableComponent, BannerComponent, Statut, ...PIPES],
  template: `
  <nav class="tabs" aria-label="Sections du tableau de bord" style="margin-top: -8px">
    @for (o of ongletsAnalyse; track o.id) { <button type="button" [class.on]="onglet() === o.id" (click)="onglet.set(o.id)"><mat-icon>{{ o.icone }}</mat-icon>{{ o.libelle }}</button> }
  </nav>
  @if (onglet() !== 'ensemble') { <app-analyses [onglet]="$any(onglet())" /> }
  @else if (p.indicateurs(); as m) {
    @if (nbHautes(); as n) {
      <app-banner class="alert-banner" tone="error" [title]="n + ' alerte(s) haute(s)'" compact [dismissible]="false">{{ m.alertes[0].texte }}</app-banner>
    }
    <div class="kpis">
      <div class="card kpi"><span class="k-label"><mat-icon>trending_up</mat-icon>Avancement global</span>
        <span class="k-val"><app-stat-counter [value]="m.avancement * 100" />&nbsp;<small>%</small></span>
        <span class="k-foot">{{ m.nb_fonctionnalites }} fonctionnalités · pondéré par le poids</span>
        <div class="spark"><canvas baseChart type="line" [data]="spark()" [options]="g.optionsSpark()"></canvas></div></div>
      <div class="card kpi"><span class="k-label"><mat-icon>rule</mat-icon>Couverture du TDR</span>
        <span class="k-val">{{ m.couverture | pct }}</span><span class="k-foot">{{ m.exigences_non_couvertes.length ? m.exigences_non_couvertes.join(', ') + ' non couverte(s)' : 'Toutes les exigences sont couvertes' }}</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>fact_check</mat-icon>Recette OK</span>
        <span class="k-val">{{ m.taux_recette | pct }}</span><span class="k-foot">{{ m.recette.ok }} OK · {{ m.recette.ko }} KO · {{ m.recette.reserve }} réserve · {{ m.recette.non_teste }} non testé</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>forum</mat-icon>Retours clients ouverts</span>
        <span class="k-val">{{ m.retours_ouverts.length }}</span><span class="k-foot">Résolution moyenne : {{ m.delai_moyen_resolution != null ? (m.delai_moyen_resolution | number: '1.0-1') + ' j' : '—' }}</span></div>
    </div>

    <div class="grid-3">
      <section class="card span-2">
        <div class="card-head"><h2>Activité de développement</h2><span class="sub">événements par jour · 30 jours · {{ m.nb_commits }} commit(s) au total</span></div>
        <div class="card-body"><div class="chart"><canvas baseChart type="bar" [data]="activite()" [options]="g.optionsLignes()"></canvas></div></div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Fonctionnalités</h2><a routerLink="../fonctionnalites">Tout voir</a></div>
        <div class="card-body">
          <div class="donut"><canvas baseChart type="doughnut" [data]="donut()" [options]="g.optionsDonut()"></canvas>
            <div class="center"><strong>{{ total() }}</strong><span>fonctionnalités</span></div></div>
          <ul class="legend">@for (s of statuts(); track s.code) { <li><i [style.background]="s.couleur"></i><span>{{ s.libelle }}</span><b>{{ s.nb }}</b><em>{{ s.nb / total() * 100 | number: '1.0-0' }} %</em></li> }</ul>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Avancement par lot</h2></div>
        <div class="card-body goals">
          @for (l of m.par_lot; track l.nom) { <div class="goal"><div class="g-top"><span>{{ l.nom }}</span><strong class="tabular">{{ l.avancement | pct }}</strong></div>
            <mat-progress-bar mode="determinate" [value]="l.avancement * 100" /><small>{{ l.nb }} fonctionnalité(s)</small></div> }
        </div>
        <div class="card-head"><h2>Développement par dépôt</h2></div>
        <div class="card-body goals">
          @for (d of m.par_depot; track d.nom) { <div class="goal"><div class="g-top"><span>{{ d.nom }}</span><strong class="tabular">{{ d.avancement | pct }}</strong></div>
            <mat-progress-bar mode="determinate" [value]="d.avancement * 100" /><small>Synchronisé {{ synchro(d.nom) }}</small></div> }
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Activité récente</h2><span class="live"><i></i>Journal</span></div>
        <ol class="feed">@for (e of evenements(); track e.id) {
          <li><span class="dot" [style.background]="g.ton(tonEvt(e.evt))"></span>
            <div><p>{{ libelleEvt(e) }}</p><small>{{ e.auteur }} · {{ e.depot ?? '—' }} · {{ quand(e.ts) }}</small></div></li>
        } @empty { <li><div><p class="muted">Aucune activité.</p></div></li> }</ol>
      </section>

      <section class="card">
        <div class="card-head"><h2>Jalons</h2><a routerLink="../planning">Planning</a></div>
        <div class="rows" style="padding-bottom: 8px">@for (j of m.jalons; track j.ref) {
          <div class="row"><span class="ic-tile" [class]="'ic-tile tone-' + tonJalon(j.statut)"><mat-icon>{{ j.statut === 'atteint' ? 'flag' : j.statut === 'en_retard' ? 'running_with_errors' : 'outlined_flag' }}</mat-icon></span>
            <div class="grow"><strong>{{ j.nom }}</strong><small>{{ j.date_prevue | dateFr }}{{ j.ecart ? ' · écart ' + j.ecart + ' j' : '' }}{{ j.facturation ? ' · ' + j.facturation : '' }}</small></div>
            <app-statut [code]="j.statut" /></div>
        }</div>
      </section>

      <section class="card span-2">
        <div class="card-head"><h2>Alertes</h2><span class="sub">{{ m.alertes.length }}</span></div>
        <div class="card-body">
          @if (!m.alertes.length) { <p class="muted">Aucune alerte.</p> }
          <ul class="alerts">@for (a of m.alertes; track $index) { <li [class]="tonAlerte(a.niveau)"><mat-icon>{{ iconeAlerte(a.niveau) }}</mat-icon><span>{{ a.texte }}</span></li> }</ul>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Qualité et livrables</h2></div>
        <div class="card-body goals">
          <div class="goal"><div class="g-top"><span>Tests OK</span><strong class="tabular">{{ m.taux_recette | pct }}</strong></div><mat-progress-bar mode="determinate" [value]="(m.taux_recette ?? 0) * 100" /></div>
          <div class="goal"><div class="g-top"><span>Couverture du TDR</span><strong class="tabular">{{ m.couverture | pct }}</strong></div><mat-progress-bar mode="determinate" [value]="(m.couverture ?? 0) * 100" /></div>
          <div class="goal"><div class="g-top"><span>Livrables documentaires</span><strong class="tabular">{{ m.avancement_documents | pct }}</strong></div><mat-progress-bar mode="determinate" [value]="(m.avancement_documents ?? 0) * 100" />
            <small>{{ m.actions_en_retard.length }} action(s) en retard · {{ m.nb_risques_actifs }} risque(s) actif(s) · {{ m.changements_en_analyse.length }} changement(s) en analyse</small></div>
        </div>
      </section>

      <app-data-table class="wide" title="Fonctionnalités à surveiller" [rows]="surveillance()" [columns]="colonnes" [pageSize]="6" maxHeight="none" [searchable]="false" clickable (rowClick)="ouvrir($event)" />
    </div>
  } @else { <app-chargement forme="tableau-de-bord" /> }`,
})
export class Synthese {
  readonly p = inject(ProjetCourant);
  readonly g = inject(GraphiquesService);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly router = inject(Router);
  readonly evenements = signal<EvenementDto[]>([]);
  readonly onglet = signal<'ensemble' | OngletAnalyse>('ensemble');
  readonly ongletsAnalyse: { id: 'ensemble' | OngletAnalyse; libelle: string; icone: string }[] = [
    { id: 'ensemble', libelle: 'Synthèse', icone: 'space_dashboard' }, { id: 'avancement', libelle: 'Avancement', icone: 'stacked_bar_chart' },
    { id: 'qualite', libelle: 'Qualité et risques', icone: 'verified' }, { id: 'activite', libelle: 'Activité', icone: 'insights' },
  ];
  readonly foncs = signal<FonctionnaliteDto[]>([]);

  readonly nbHautes = computed(() => this.p.indicateurs()?.alertes.filter((a) => a.niveau === 'haute').length ?? 0);
  readonly statuts = computed(() => {
    const ps = this.p.indicateurs()?.par_statut ?? {};
    this.g.c();
    return (this.ref.donnees()?.statuts_fonctionnalite ?? []).filter((s) => ps[s.code]).map((s) => ({ code: s.code, libelle: s.libelle, nb: ps[s.code], couleur: this.g.ton(tonDeCouleur(s.couleur)) }));
  });
  readonly total = computed(() => this.statuts().reduce((a, s) => a + s.nb, 0) || 1);
  readonly donut = computed<ChartData<'doughnut'>>(() => ({ labels: this.statuts().map((s) => s.libelle),
    datasets: [{ data: this.statuts().map((s) => s.nb), backgroundColor: this.statuts().map((s) => s.couleur), borderColor: this.g.c().card, borderWidth: 2, hoverOffset: 4 }] }));
  private readonly jours = computed(() => {
    const m = this.p.indicateurs(); if (!m) return [];
    const par = new Map(m.activite_par_jour.map((a) => [a.jour, a.nb]));
    const fin = new Date(`${m.date_calcul}T00:00:00Z`).getTime();
    return Array.from({ length: 30 }, (_, i) => { const d = new Date(fin - (29 - i) * 86400000).toISOString().slice(0, 10); return { jour: d, nb: par.get(d) ?? 0 }; });
  });
  readonly activite = computed<ChartData<'bar'>>(() => {
    const c = this.g.c();
    return { labels: this.jours().map((j) => date(j.jour).slice(0, 5)), datasets: [{ label: 'Événements', data: this.jours().map((j) => j.nb), backgroundColor: c.primary, borderRadius: 4, maxBarThickness: 18 }] };
  });
  readonly spark = computed<ChartData<'line'>>(() => {
    const c = this.g.c(); let cumul = 0;
    return { labels: this.jours().map((j) => j.jour), datasets: [{ data: this.jours().map((j) => (cumul += j.nb)), borderColor: c.primary, backgroundColor: this.g.alpha(c.primary, 0.12), fill: true }] };
  });
  readonly colonnes: DataColumn<Surveillance>[] = [
    { key: 'ref', label: 'Réf.', type: 'mono', width: 90, required: true },
    { key: 'titre', label: 'Fonctionnalité', minWidth: 240, required: true },
    { key: 'statut', label: 'Statut', type: 'badge', width: 130, tone: (r) => tonDeCouleur(this.ref.couleur(r.statut_code)) },
    { key: 'raison', label: 'Motif', minWidth: 220 },
    { key: 'avancement', label: 'Avancement', type: 'progress', width: 150 },
    { key: 'activite', label: 'Dernière activité', width: 140 },
  ];
  readonly surveillance = computed<Surveillance[]>(() => {
    const m = this.p.indicateurs(); if (!m) return [];
    return this.foncs().flatMap((f) => {
      const raisons: string[] = [];
      if (f.statut_effectif === 'bloque') raisons.push(f.notes || 'Bloquée');
      const ko = f.cas_test.filter((t) => ['ko', 'reserve'].includes(m.resultats_tests[t]?.resultat ?? ''));
      if (ko.length) raisons.push(`Test(s) ${ko.join(', ')} non conforme(s)`);
      if (f.statut_effectif === 'developpe' && !f.cas_test.length) raisons.push('Développée sans cas de test');
      if (f.retours.length && f.statut_effectif !== 'valide') raisons.push(`Retour(s) ${f.retours.join(', ')}`);
      return raisons.length ? [{ id: f.id, ref: f.ref, titre: f.titre, statut: this.ref.libelle(f.statut_effectif), statut_code: f.statut_effectif, raison: raisons.join(' · '), avancement: Math.round(f.avancement * 100), activite: date(f.derniere_activite) }] : [];
    });
  });

  constructor() {
    effect(() => {
      const c = this.p.code(); if (!c) return;
      this.api.invoke(projetsJournal, { code: c, par_page: 8 }).then((j) => this.evenements.set(j.elements)).catch(() => undefined);
      this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.foncs.set(l)).catch(() => undefined);
    });
  }
  synchro(depot: string) { const s = this.p.indicateurs()?.synchronisation.find((x) => x.depot === depot)?.derniere_synchro; return s ? dateHeure(s) : 'jamais'; }
  iconeAlerte = (n: string) => ICONE_ALERTE[n] ?? 'info';
  tonAlerte = (n: string) => TON_ALERTE[n] ?? 'tone-neutral';
  tonEvt = (e: string) => TON_EVT[e] ?? 'neutral';
  tonJalon = (s: string) => (s === 'atteint' ? 'success' : s === 'en_retard' ? 'error' : 'primary');
  libelleEvt(e: EvenementDto) {
    switch (e.evt) {
      case 'commit': return `Commit ${e.hash} — ${e.message}`;
      case 'commande': return `Commande : ${e.commande}`;
      case 'doc': return `Documentation mise à jour : ${e.fichier || e.message}`;
      case 'agent': return `Sous-agent : ${e.message}`;
      case 'creation': return `Création de ${e.fichier}`;
      default: return `Modification de ${e.fichier}`;
    }
  }
  quand(ts: string) {
    const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    return min < 60 ? `il y a ${Math.max(min, 1)} min` : min < 1440 ? `il y a ${Math.round(min / 60)} h` : dateHeure(ts);
  }
  ouvrir(r: Surveillance) { this.router.navigate(['/projets', this.p.code(), 'fonctionnalites', r.ref]); }
}
