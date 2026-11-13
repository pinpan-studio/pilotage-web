import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData } from 'chart.js';
import { Api } from '../../api/genere/api';
import { projetsDocuments, projetsFonctionnalites, projetsJournal, projetsRisques } from '../../api/genere/functions';
import { DocumentDto, EvenementDto, FonctionnaliteDto, Risque } from '../../api/genere/models';
import { ReferentielsService } from '../noyau/referentiels.service';
import { tonDeCouleur } from '../noyau/statut';
import { GraphiquesService } from '../noyau/graphiques.service';
import { SkeletonComponent } from '../shared/components/skeleton/skeleton.component';
import { ProjetCourant } from './projet';

export type OngletAnalyse = 'avancement' | 'qualite' | 'activite';
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Onglets d'analyse de la vue d'ensemble — catalogue de visualisations repris de
 * ui-kit examples/app/dashboard/ex-dashboard-analytics (barres empilées / horizontales, entonnoir, anneaux,
 * camembert, aire polaire, heatmap, classement, calendrier d'activité, aires empilées), appliqué aux données du projet.
 */
@Component({
  selector: 'app-analyses',
  imports: [DecimalPipe, MatTooltipModule, BaseChartDirective, SkeletonComponent],
  styleUrl: './analyses.scss',
  template: `
  @if (!pret()) { <div class="grid">@for (i of [1,2,3]; track i) { <section class="card"><div class="card-body"><app-skeleton variant="card" [count]="1" /></div></section> }</div> }
  @else {
  @switch (onglet()) {
    @case ('avancement') {
      <div class="grid">
        <section class="card span-2"><div class="card-head"><h2>Statuts par lot</h2><span class="tag">Barres empilées</span></div>
          <div class="card-body"><div class="chart"><canvas baseChart type="bar" [data]="statutsParLot()" [options]="opts(true)"></canvas></div></div></section>
        <section class="card"><div class="card-head"><h2>Développement par dépôt</h2><span class="tag">Barres horizontales</span></div>
          <div class="card-body"><div class="chart"><canvas baseChart type="bar" [data]="depots()" [options]="optsH()"></canvas></div></div></section>
        <section class="card span-2"><div class="card-head"><h2>Cycle des fonctionnalités</h2><span class="tag">Entonnoir</span></div>
          <div class="card-body funnel">
            @for (f of entonnoir(); track f.label; let i = $index) {
              <div class="f-row"><span class="f-lbl">{{ f.label }}</span>
                <div class="f-track"><div class="f-bar" [style.width.%]="largeur(f.v)" [style.opacity]="1 - i * 0.14"></div></div>
                <span class="f-val tabular">{{ f.v }}</span><span class="f-rate tabular">@if (i && entonnoir()[i - 1].v) { {{ f.v / entonnoir()[i - 1].v * 100 | number: '1.0-0' }} % } @else { — }</span></div>
            }
            <p class="f-foot">Poids cumulé validé : <strong>{{ poidsValide() }} / {{ poidsTotal() }}</strong> points</p>
          </div></section>
        <section class="card"><div class="card-head"><h2>Objectifs du projet</h2><span class="tag">Anneaux</span></div>
          <div class="card-body rings">
            @for (r of anneaux(); track r.label) {
              <div class="ring" [style.--tone]="'var(--' + r.tone + '-color)'">
                <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" class="r-track" /><circle cx="50" cy="50" r="40" class="r-val" [attr.stroke-dasharray]="dash(r.v)" /></svg>
                <strong class="tabular">{{ r.v | number: '1.0-0' }} %</strong><span>{{ r.label }}</span></div>
            }
          </div></section>
      </div>
    }
    @case ('qualite') {
      <div class="grid">
        <section class="card"><div class="card-head"><h2>Résultats de recette</h2><span class="tag">Camembert</span></div>
          <div class="card-body"><div class="chart"><canvas baseChart type="pie" [data]="recette()" [options]="optsRadial()"></canvas></div></div></section>
        <section class="card"><div class="card-head"><h2>Documents par statut</h2><span class="tag">Aire polaire</span></div>
          <div class="card-body"><div class="chart"><canvas baseChart type="polarArea" [data]="docsStatut()" [options]="optsRadial()"></canvas></div></div></section>
        <section class="card"><div class="card-head"><h2>Risques les plus critiques</h2><span class="tag">Classement</span></div>
          <div class="card-body ranking">
            @for (r of risquesTop(); track r.ref; let i = $index) {
              <div class="rk"><span class="rk-pos">{{ i + 1 }}</span>
                <div class="rk-main"><div class="rk-top"><strong>{{ r.ref }}</strong><span class="tabular">{{ r.probabilite * r.impact }} / 16</span></div>
                  <div class="rk-bar"><i [style.width.%]="r.probabilite * r.impact / 16 * 100" [style.background]="r.probabilite * r.impact >= 9 ? 'var(--error-color)' : 'var(--warning-color)'"></i></div><small>{{ r.titre }}</small></div></div>
            } @empty { <p class="muted">Aucun risque.</p> }
          </div></section>
        <section class="card span-2"><div class="card-head"><h2>Livrables par phase</h2><span class="tag">Barres empilées</span></div>
          <div class="card-body"><div class="chart"><canvas baseChart type="bar" [data]="docsPhase()" [options]="opts(true)"></canvas></div></div></section>
        <section class="card"><div class="card-head"><h2>Matrice des risques</h2><span class="tag">Heatmap</span></div>
          <div class="card-body">
            <div class="heat" style="grid-template-columns: 70px repeat(4, minmax(0, 1fr))">
              <span></span>@for (i of [1,2,3,4]; track i) { <span class="hx">Impact {{ i }}</span> }
              @for (p of [4,3,2,1]; track p) { <span class="hy">Proba. {{ p }}</span>
                @for (i of [1,2,3,4]; track i) { <i style="aspect-ratio: 1.3; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px" [style.background]="couleurMatrice(p, i)" [matTooltip]="matrice(p, i).join(', ') || 'Aucun risque'">{{ matrice(p, i).length || '' }}</i> } }
            </div>
            <div class="legend-scale"><span>Criticité faible</span>@for (s of [2, 4, 6, 9, 12]; track s) { <i [style.background]="couleurCriticite(s)"></i> }<span>forte</span></div>
          </div></section>
      </div>
    }
    @case ('activite') {
      <div class="grid">
        <section class="card span-3"><div class="card-head"><h2>Activité sur 12 mois</h2><span class="tag">Calendrier d’activité</span></div>
          <div class="card-body cal-wrap"><div class="cal">
            <div class="cal-months">@for (m of axeMois(); track $index) { <span [style.grid-column]="m.col + 2">{{ m.label }}</span> }</div>
            <div class="cal-grid">
              <div class="cal-days">@for (d of jours; track d; let i = $index) { <span>{{ i % 2 === 0 ? d : '' }}</span> }</div>
              @for (w of calendrier(); track $index) { <div class="cal-week">@for (c of w; track $index) { <i [class]="'lv' + c.lvl" [matTooltip]="c.libelle"></i> }</div> }
            </div></div>
            <div class="legend-scale"><span>Moins</span>@for (l of [0, 1, 2, 3, 4]; track l) { <i [class]="'lv' + l"></i> }<span>Plus</span></div>
          </div></section>
        <section class="card span-2"><div class="card-head"><h2>Activité par heure</h2><span class="tag">Heatmap</span></div>
          <div class="card-body">
            <div class="heat" style="grid-template-columns: 34px repeat(24, minmax(0, 1fr))">
              <span></span>@for (h of heures; track h) { <span class="hx">{{ h % 3 === 0 ? h + ' h' : '' }}</span> }
              @for (row of chaleur(); track $index; let d = $index) { <span class="hy">{{ jours[d] }}</span>
                @for (v of row; track $index; let h = $index) { <i [style.background]="couleurChaleur(v)" [matTooltip]="jours[d] + ' ' + heures[h] + ' h : ' + v + ' événement(s)'"></i> } }
            </div>
            <div class="legend-scale"><span>Moins</span>@for (s of [0.1, 0.3, 0.5, 0.7, 0.9]; track s) { <i [style.background]="couleurChaleur(s * maxChaleur())"></i> }<span>Plus</span></div>
          </div></section>
        <section class="card"><div class="card-head"><h2>Contributeurs</h2><span class="tag">Classement</span></div>
          <div class="card-body ranking">
            @for (p of contributeurs(); track p.nom; let i = $index) {
              <div class="rk"><span class="rk-pos">{{ i + 1 }}</span>
                <div class="rk-main"><div class="rk-top"><strong>{{ p.nom }}</strong><span class="tabular">{{ p.v }}</span></div>
                  <div class="rk-bar"><i [style.width.%]="p.v / contributeurs()[0].v * 100" [class.over]="i === 0"></i></div><small>{{ p.commits }} commit(s) · {{ p.depots }}</small></div></div>
            }
          </div></section>
        <section class="card span-3"><div class="card-head"><h2>Événements par type</h2><span class="tag">Aires empilées · 30 jours</span></div>
          <div class="card-body"><div class="chart"><canvas baseChart type="line" [data]="parType()" [options]="opts(true)"></canvas></div></div></section>
      </div>
    }
  }
  }`,
})
export class Analyses {
  readonly onglet = input.required<OngletAnalyse>();
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly g = inject(GraphiquesService);
  readonly jours = JOURS;
  readonly heures = Array.from({ length: 24 }, (_, i) => i);
  readonly foncs = signal<FonctionnaliteDto[]>([]);
  readonly docs = signal<DocumentDto[]>([]);
  readonly risques = signal<Risque[]>([]);
  readonly evts = signal<EvenementDto[]>([]);
  private readonly nb = signal(0);
  readonly pret = computed(() => this.nb() >= 4 && !!this.p.indicateurs() && !!this.ref.donnees());

  constructor() {
    effect(() => {
      const c = this.p.code(); if (!c) return;
      untracked(() => {
        this.nb.set(0);
        const fin = () => this.nb.update((n) => n + 1);
        this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.foncs.set(l)).finally(fin);
        this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)).finally(fin);
        this.api.invoke(projetsRisques, { code: c }).then((l) => this.risques.set(l)).finally(fin);
        this.chargerEvenements(c).finally(fin);
      });
    });
  }
  /** Jusqu'à 1 000 événements récents (5 pages de 200) pour la heatmap et le classement. */
  private async chargerEvenements(code: string) {
    const tous: EvenementDto[] = [];
    for (let page = 1; page <= 5; page++) {
      const r = await this.api.invoke(projetsJournal, { code, page, par_page: 200 }).catch(() => null);
      if (!r) break; tous.push(...r.elements); if (tous.length >= r.total) break;
    }
    this.evts.set(tous);
  }

  // ─── Options (reprises de ex-dashboard-analytics) ─────────────
  private police = { family: 'Inter', size: 11 };
  opts(empile = false): any {
    const c = this.g.c();
    const axe = (grille: boolean) => ({ stacked: empile, grid: grille ? { color: c.grid } : { display: false }, border: { display: false }, ticks: { color: c.muted, font: this.police, maxTicksLimit: 8, precision: 0 } });
    return { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, position: 'top', align: 'end', labels: { color: c.muted, usePointStyle: true, boxWidth: 8, font: this.police } } },
      scales: { x: axe(false), y: { ...axe(true), beginAtZero: true } } };
  }
  optsH(): any {
    const c = this.g.c();
    return { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
      scales: { x: { min: 0, max: 100, grid: { color: c.grid }, border: { display: false }, ticks: { color: c.muted, font: this.police, callback: (v: number) => `${v} %` } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: c.muted, font: this.police } } } };
  }
  optsRadial(): any {
    const c = this.g.c();
    return { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: c.text, usePointStyle: true, boxWidth: 8, font: this.police, padding: 12 } } },
      scales: {} };
  }
  private couleur(code: string) { return this.g.ton(tonDeCouleur(this.ref.couleur(code))); }
  private serie() { const c = this.g.c(); return [c.primary, c.info, c.warning, c.success, c.purple, c.error, c.muted]; }

  // ─── Avancement ───────────────────────────────────────────────
  readonly statutsParLot = computed<ChartData<'bar'>>(() => {
    const lots = [...new Set(this.foncs().map((f) => f.jalon || 'Sans lot'))];
    const statuts = (this.ref.donnees()?.statuts_fonctionnalite ?? []).filter((s) => this.foncs().some((f) => f.statut_effectif === s.code));
    return { labels: lots, datasets: statuts.map((s, i) => ({ label: s.libelle, stack: 's', backgroundColor: this.couleur(s.code), borderRadius: i === statuts.length - 1 ? 4 : 0, maxBarThickness: 48,
      data: lots.map((l) => this.foncs().filter((f) => (f.jalon || 'Sans lot') === l && f.statut_effectif === s.code).reduce((a, f) => a + f.poids, 0)) })) };
  });
  readonly depots = computed<ChartData<'bar'>>(() => {
    const d = this.p.indicateurs()?.par_depot ?? []; const c = this.g.c();
    return { labels: d.map((x) => x.nom), datasets: [{ label: 'Avancement', data: d.map((x) => Math.round(x.avancement * 100)), backgroundColor: d.map((_, i) => (i ? this.g.alpha(c.primary, 0.6 - i * 0.1) : c.primary)), borderRadius: 4, barPercentage: 0.6 }] };
  });
  readonly entonnoir = computed(() => {
    const a = this.foncs().filter((f) => f.statut !== 'abandonne'); const s = (l: string[]) => a.filter((f) => l.includes(f.statut_effectif)).length;
    return [{ label: 'Fonctionnalités', v: a.length }, { label: 'Démarrées', v: a.length - s(['a_faire']) }, { label: 'Développées', v: s(['developpe', 'recette', 'valide']) },
      { label: 'Recettées', v: s(['recette', 'valide']) }, { label: 'Validées client', v: s(['valide']) }];
  });
  readonly poidsTotal = computed(() => this.foncs().filter((f) => f.statut !== 'abandonne').reduce((a, f) => a + f.poids, 0));
  readonly poidsValide = computed(() => this.foncs().filter((f) => f.statut_effectif === 'valide').reduce((a, f) => a + f.poids, 0));
  largeur(v: number) { const m = this.entonnoir()[0].v || 1; return Math.max(6, Math.sqrt(v / m) * 100); }
  readonly anneaux = computed(() => {
    const m = this.p.indicateurs()!; const j = m.jalons.length ? (m.jalons.filter((x) => x.statut === 'atteint').length / m.jalons.length) * 100 : 0;
    return [{ label: 'Couverture du TDR', v: (m.couverture ?? 0) * 100, tone: 'success' }, { label: 'Tests OK', v: (m.taux_recette ?? 0) * 100, tone: 'info' },
      { label: 'Livrables documentaires', v: (m.avancement_documents ?? 0) * 100, tone: 'warning' }, { label: 'Jalons atteints', v: j, tone: 'primary' }];
  });
  dash(v: number) { const l = 2 * Math.PI * 40; return `${(l * v) / 100} ${l}`; }

  // ─── Qualité ──────────────────────────────────────────────────
  readonly recette = computed<ChartData<'pie'>>(() => {
    const r = this.p.indicateurs()!.recette as unknown as Record<string, number>; const codes = ['ok', 'ko', 'reserve', 'non_teste'];
    return { labels: codes.map((c) => this.ref.libelle(c)), datasets: [{ data: codes.map((c) => r[c] ?? 0), backgroundColor: codes.map((c) => this.couleur(c)), borderColor: this.g.c().card, borderWidth: 2 }] };
  });
  readonly docsStatut = computed<ChartData<'polarArea'>>(() => {
    const st = (this.ref.donnees()?.statuts_document ?? []).filter((s) => this.docs().some((d) => d.statut === s.code));
    return { labels: st.map((s) => s.libelle), datasets: [{ data: st.map((s) => this.docs().filter((d) => d.statut === s.code).length), backgroundColor: st.map((s) => this.g.alpha(this.couleur(s.code), 0.7)), borderColor: this.g.c().card, borderWidth: 2 }] };
  });
  readonly docsPhase = computed<ChartData<'bar'>>(() => {
    const ph = (this.ref.donnees()?.phases ?? []).filter((x) => this.docs().some((d) => d.phase === x.code));
    const st = (this.ref.donnees()?.statuts_document ?? []).filter((s) => this.docs().some((d) => d.statut === s.code));
    return { labels: ph.map((x) => x.libelle), datasets: st.map((s) => ({ label: s.libelle, stack: 'd', backgroundColor: this.couleur(s.code), maxBarThickness: 48,
      data: ph.map((x) => this.docs().filter((d) => d.phase === x.code && d.statut === s.code).length) })) };
  });
  readonly risquesTop = computed(() => [...this.risques()].filter((r) => r.statut !== 'clos').sort((a, b) => b.probabilite * b.impact - a.probabilite * a.impact).slice(0, 5));
  matrice(p: number, i: number) { return this.risques().filter((r) => r.statut !== 'clos' && r.probabilite === p && r.impact === i).map((r) => r.ref); }
  couleurCriticite(c: number) { return c >= 9 ? 'var(--error-color-light)' : c >= 4 ? 'var(--warning-color-light)' : 'var(--success-color-light)'; }
  couleurMatrice(p: number, i: number) { return this.matrice(p, i).length ? (p * i >= 9 ? 'var(--error-color)' : p * i >= 4 ? 'var(--warning-color)' : 'var(--success-color)') : this.couleurCriticite(p * i); }

  // ─── Activité ─────────────────────────────────────────────────
  readonly calendrier = computed(() => {
    const m = this.p.indicateurs()!; const par = new Map(m.activite_par_jour.map((a) => [a.jour, a.nb]));
    const fin = new Date(`${m.date_calcul}T00:00:00Z`); const decal = (fin.getUTCDay() + 6) % 7;
    const debut = new Date(fin.getTime() - (51 * 7 + decal) * 86400000);
    const max = Math.max(1, ...m.activite_par_jour.map((a) => a.nb));
    return Array.from({ length: 52 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
      const date = new Date(debut.getTime() + (w * 7 + d) * 86400000); const j = date.toISOString().slice(0, 10); const v = par.get(j) ?? 0;
      const lvl = v === 0 ? 0 : v < max * 0.25 ? 1 : v < max * 0.5 ? 2 : v < max * 0.75 ? 3 : 4;
      return { lvl, libelle: `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })} : ${v} événement(s)`, mois: date.getUTCMonth(), jourDuMois: date.getUTCDate() };
    }));
  });
  readonly axeMois = computed(() => this.calendrier().map((w, i) => ({ i, w })).filter(({ w }) => w[0].jourDuMois <= 7).map(({ i, w }) => ({ label: MOIS[w[0].mois], col: i })));
  readonly chaleur = computed(() => {
    const g = JOURS.map(() => this.heures.map(() => 0));
    for (const e of this.evts()) {
      const d = new Date(e.ts); const h = d.getUTCHours(); const j = (d.getUTCDay() + 6) % 7; // Africa/Abidjan = UTC
      g[j][h]++;
    }
    return g;
  });
  readonly maxChaleur = computed(() => Math.max(1, ...this.chaleur().flat()));
  couleurChaleur(v: number) { return `color-mix(in srgb, var(--primary-color) ${Math.round((v / this.maxChaleur()) * 100)}%, var(--hover-bg))`; }
  readonly contributeurs = computed(() => {
    const m = new Map<string, { nom: string; v: number; commits: number; depots: Set<string> }>();
    for (const e of this.evts()) { const x = m.get(e.auteur) ?? { nom: e.auteur, v: 0, commits: 0, depots: new Set<string>() }; x.v++; if (e.evt === 'commit') x.commits++; if (e.depot) x.depots.add(e.depot); m.set(e.auteur, x); }
    return [...m.values()].sort((a, b) => b.v - a.v).slice(0, 6).map((x) => ({ nom: x.nom || '—', v: x.v, commits: x.commits, depots: [...x.depots].join(', ') }));
  });
  readonly parType = computed<ChartData<'line'>>(() => {
    const m = this.p.indicateurs()!; const fin = new Date(`${m.date_calcul}T00:00:00Z`).getTime();
    const jours = Array.from({ length: 30 }, (_, i) => new Date(fin - (29 - i) * 86400000).toISOString().slice(0, 10));
    const types = ['modification', 'creation', 'commande', 'commit', 'doc', 'agent'].filter((t) => this.evts().some((e) => e.evt === t));
    const s = this.serie();
    return { labels: jours.map((j) => `${j.slice(8, 10)}/${j.slice(5, 7)}`), datasets: types.map((t, i) => ({ label: t, fill: true, tension: 0.35, pointRadius: 0, borderColor: s[i], backgroundColor: this.g.alpha(s[i], 0.45),
      data: jours.map((j) => this.evts().filter((e) => e.evt === t && e.ts.startsWith(j)).length) })) };
  });
}
