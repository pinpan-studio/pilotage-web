import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsSessions } from '../../api/genere/functions';
import { SessionDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { StatCounterComponent } from '../shared/components/data/stat-counter.component';
import { tonDeCouleur } from '../noyau/statut';
import { ProjetCourant } from './projet';

const ICONE_ALERTE: Record<string, string> = { haute: 'error', moyenne: 'warning', basse: 'info' };
const TON_ALERTE: Record<string, string> = { haute: 'tone-error', moyenne: 'tone-warning', basse: 'tone-neutral' };

@Component({
  selector: 'app-synthese',
  imports: [DecimalPipe, MatIconModule, StatCounterComponent, ...PIPES],
  template: `
  @if (p.indicateurs(); as m) {
    <div class="kpis">
      <div class="card kpi"><span class="k-label"><mat-icon>trending_up</mat-icon>Avancement global</span>
        <span class="k-val"><app-stat-counter [value]="m.avancement * 100" suffix=" %" /></span><span class="k-foot">{{ m.nb_fonctionnalites }} fonctionnalités actives</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>rule</mat-icon>Couverture du TDR</span>
        <span class="k-val">{{ m.couverture | pct }}</span><span class="k-foot">{{ m.exigences_non_couvertes.length }} exigence(s) non couverte(s)</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>fact_check</mat-icon>Recette OK</span>
        <span class="k-val">{{ m.taux_recette | pct }}</span><span class="k-foot">{{ m.recette.ok }} OK · {{ m.recette.ko }} KO · {{ m.recette.reserve }} réserve(s) · {{ m.recette.non_teste }} non testé(s)</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>forum</mat-icon>Retours clients ouverts</span>
        <span class="k-val">{{ m.retours_ouverts.length }}</span><span class="k-foot">Délai moyen de résolution : {{ m.delai_moyen_resolution != null ? (m.delai_moyen_resolution | number: '1.0-1') + ' j' : '—' }}</span></div>
    </div>
    <div class="kpis k3">
      <div class="card kpi"><span class="k-label"><mat-icon>description</mat-icon>Livrables documentaires</span><span class="k-val">{{ m.avancement_documents | pct }}</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>flag</mat-icon>Prochain jalon</span><span class="k-val" style="font-size: 18px">{{ m.prochain_jalon?.nom ?? '—' }}</span>
        <span class="k-foot">{{ m.prochain_jalon ? (m.prochain_jalon.date_prevue | dateFr) : '' }}</span></div>
      <div class="card kpi"><span class="k-label"><mat-icon>assignment_late</mat-icon>Actions en retard</span><span class="k-val">{{ m.actions_en_retard.length }}</span>
        <span class="k-foot">sur {{ m.actions_ouvertes.length }} ouverte(s) · {{ m.nb_risques_actifs }} risque(s) actif(s)</span></div>
    </div>

    <div class="grid-2">
      <section class="card wide"><div class="card-head"><h2>Alertes</h2><span class="sub">{{ m.alertes.length }}</span></div>
        <div class="card-body">
          @if (!m.alertes.length) { <p class="muted">Aucune alerte.</p> }
          <ul class="alerts">@for (a of m.alertes; track $index) { <li [class]="tonAlerte(a.niveau)"><mat-icon>{{ iconeAlerte(a.niveau) }}</mat-icon><span>{{ a.texte }}</span></li> }</ul>
        </div></section>
      <section class="card"><div class="card-head"><h2>Répartition des statuts</h2></div>
        <div class="card-body">
          <div class="split">@for (s of statuts(); track s.code) { <i [style.flex]="s.nb" [style.background]="s.couleur" [title]="s.libelle + ' : ' + s.nb"></i> }</div>
          <ul class="legend-inline">@for (s of statuts(); track s.code) { <li><i [style.background]="s.couleur"></i>{{ s.libelle }} <b>{{ s.nb }}</b></li> }</ul>
        </div></section>
      <section class="card"><div class="card-head"><h2>Avancement par lot</h2></div>
        <div class="card-body">@for (l of m.par_lot; track l.nom) { <div class="bar-row"><span>{{ l.nom }} <small>({{ l.nb }})</small></span><div class="bar"><i [style.width.%]="l.avancement * 100"></i></div><b>{{ l.avancement | pct }}</b></div> }</div></section>
      <section class="card"><div class="card-head"><h2>Développement par dépôt</h2></div>
        <div class="card-body">
          @for (d of m.par_depot; track d.nom) { <div class="bar-row"><span>{{ d.nom }} <small>({{ d.nb }})</small></span><div class="bar"><i [style.width.%]="d.avancement * 100"></i></div><b>{{ d.avancement | pct }}</b></div> }
          <p class="muted" style="font-size: var(--fs-caption); margin: 12px 0 0">Dernière synchronisation : @for (s of m.synchronisation; track s.depot) { {{ s.depot }} {{ s.derniere_synchro | dateFr: true }}{{ $last ? '' : ' · ' }} }</p>
        </div></section>
      <section class="card"><div class="card-head"><h2>Activité</h2><span class="sub">30 derniers jours · {{ m.nb_commits }} commit(s) au total</span></div>
        <div class="card-body">
          <svg class="activity" viewBox="0 0 300 72" preserveAspectRatio="none">
            @for (j of activite(); track j.jour; let i = $index) { <rect [attr.x]="i * 10 + 1" width="8" [attr.y]="72 - (j.h || 3)" [attr.height]="j.h || 3" [attr.rx]="2" [attr.class]="j.nb ? 'on' : 'off'"><title>{{ j.jour | dateFr }} : {{ j.nb }}</title></rect> }
          </svg>
          <div class="activity-axis"><span>{{ activite()[0]?.jour | dateFr }}</span><span>{{ m.date_calcul | dateFr }}</span></div>
        </div></section>
      <section class="card wide"><div class="card-head"><h2>Dernières sessions</h2></div>
        <div class="rows" style="padding-bottom: 12px">
          @for (s of sessions().slice(0, 5); track s.id) {
            <div class="row"><span class="ava sm">{{ initiales(s.auteur) }}</span>
              <div class="grow"><strong>{{ s.auteur }} · {{ s.depot ?? '—' }}</strong><small>{{ extrait(s.resume) }}</small></div>
              <span class="num">{{ s.debut | dateFr }}</span></div>
          } @empty { <p class="muted" style="padding: 0 20px">Aucune session.</p> }
        </div></section>
    </div>
  } @else { <div class="loading">Chargement…</div> }`,
})
export class Synthese {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  readonly sessions = signal<SessionDto[]>([]);
  readonly statuts = computed(() => {
    const ps = this.p.indicateurs()?.par_statut ?? {};
    return (this.ref.donnees()?.statuts_fonctionnalite ?? []).filter((s) => ps[s.code])
      .map((s) => ({ code: s.code, libelle: s.libelle, nb: ps[s.code], couleur: `var(--${tonDeCouleur(s.couleur)}-color, var(--text-muted))` }));
  });
  readonly activite = computed(() => {
    const m = this.p.indicateurs(); if (!m) return [];
    const par = new Map(m.activite_par_jour.map((a) => [a.jour, a.nb]));
    const fin = new Date(`${m.date_calcul}T00:00:00Z`).getTime();
    const jours = Array.from({ length: 30 }, (_, i) => { const d = new Date(fin - (29 - i) * 86400000).toISOString().slice(0, 10); return { jour: d, nb: par.get(d) ?? 0 }; });
    const max = Math.max(1, ...jours.map((j) => j.nb));
    return jours.map((j) => ({ ...j, h: Math.round((j.nb / max) * 68) }));
  });
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsSessions, { code: c }).then((s) => this.sessions.set(s)).catch(() => undefined); }); }
  iconeAlerte = (n: string) => ICONE_ALERTE[n] ?? 'info';
  tonAlerte = (n: string) => TON_ALERTE[n] ?? 'tone-neutral';
  initiales = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  extrait = (md: string) => md.replace(/^---[\s\S]*?---/, '').replace(/[#*`>|-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
