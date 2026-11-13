import { Component, computed, inject, signal, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Api } from '../../api/genere/api';
import { projetsSessions } from '../../api/genere/functions';
import { SessionDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { ProjetCourant } from './projet';

@Component({
  selector: 'app-synthese',
  imports: [DecimalPipe, ...PIPES],
  template: `
  @if (p.indicateurs(); as m) {
    <div class="tuiles">
      <div class="tuile principale"><div class="valeur">{{ m.avancement | pct }}</div><div class="libelle">Avancement global</div><div class="detail">{{ m.nb_fonctionnalites }} fonctionnalités</div></div>
      <div class="tuile"><div class="valeur">{{ m.couverture | pct }}</div><div class="libelle">Couverture du TDR</div><div class="detail">{{ m.exigences_non_couvertes.length }} exigence(s) non couverte(s)</div></div>
      <div class="tuile"><div class="valeur">{{ m.taux_recette | pct }}</div><div class="libelle">Recette OK</div><div class="detail">{{ m.recette.ok }} OK · {{ m.recette.ko }} KO · {{ m.recette.reserve }} réserve(s) · {{ m.recette.non_teste }} non testé(s)</div></div>
      <div class="tuile" [class.attention]="m.retours_ouverts.length"><div class="valeur">{{ m.retours_ouverts.length }}</div><div class="libelle">Retours clients ouverts</div><div class="detail">Délai moyen de résolution : {{ m.delai_moyen_resolution != null ? ((m.delai_moyen_resolution | number: '1.0-1') + ' j') : '—' }}</div></div>
      <div class="tuile"><div class="valeur">{{ m.avancement_documents | pct }}</div><div class="libelle">Livrables documentaires</div></div>
      <div class="tuile texte"><div class="valeur">{{ m.prochain_jalon?.nom ?? '—' }}</div><div class="libelle">Prochain jalon{{ m.prochain_jalon ? ' — ' + (m.prochain_jalon.date_prevue | dateFr) : '' }}</div></div>
    </div>
    <div class="grille">
      <section class="carte large"><h2>Alertes ({{ m.alertes.length }})</h2>
        @if (!m.alertes.length) { <p class="vide">Aucune alerte.</p> }
        <ul class="alertes">@for (a of m.alertes; track $index) { <li [class]="'n-' + a.niveau"><b>{{ a.niveau | libelle }}</b>{{ a.texte }}</li> }</ul>
      </section>
      <section class="carte"><h2>Répartition des statuts</h2>
        <div class="repartition">@for (s of statuts(); track s.code) { <span class="seg" [class]="'seg s-' + s.code" [style.flex]="s.nb" [title]="s.libelle + ' : ' + s.nb"></span> }</div>
        <ul class="legende">@for (s of statuts(); track s.code) { <li><span class="pastille" [class]="'pastille s-' + s.code"></span>{{ s.libelle }} <b>{{ s.nb }}</b></li> }</ul>
      </section>
      <section class="carte"><h2>Avancement par lot</h2>
        @for (l of m.par_lot; track l.nom) { <div class="ligne-barre"><span>{{ l.nom }} <small>({{ l.nb }})</small></span><div class="barre"><span [style.width.%]="l.avancement * 100"></span></div><b>{{ l.avancement | pct }}</b></div> }
      </section>
      <section class="carte"><h2>Développement par dépôt</h2>
        @for (d of m.par_depot; track d.nom) { <div class="ligne-barre"><span>{{ d.nom }} <small>({{ d.nb }})</small></span><div class="barre dev"><span [style.width.%]="d.avancement * 100"></span></div><b>{{ d.avancement | pct }}</b></div> }
        <p class="note">Dernière synchronisation : @for (s of m.synchronisation; track s.depot) { {{ s.depot }} {{ s.derniere_synchro | dateFr: true }}{{ $last ? '' : ' · ' }} }</p>
      </section>
      <section class="carte"><h2>Activité (30 jours)</h2>
        <figure class="activite">
          <svg viewBox="0 0 300 64" preserveAspectRatio="none">
            @for (j of activite(); track j.jour; let i = $index) { <rect [attr.x]="i * 10 + 1" [attr.width]="8" [attr.y]="64 - j.h" [attr.height]="j.h || 2" [attr.class]="j.nb ? 'act' : 'vide'"><title>{{ j.jour | dateFr }} : {{ j.nb }}</title></rect> }
          </svg>
          <figcaption><span>{{ activite()[0]?.jour | dateFr }}</span><span>{{ m.nb_commits }} commit(s) au total</span><span>{{ m.date_calcul | dateFr }}</span></figcaption>
        </figure>
      </section>
      <section class="carte large"><h2>Dernières sessions</h2>
        <ul class="sessions">@for (s of sessions().slice(0, 5); track s.id) { <li><b>{{ s.debut | dateFr }}</b> · {{ s.depot ?? '—' }} · {{ s.auteur }} <div class="extrait">{{ extrait(s.resume) }}</div></li> }</ul>
        @if (!sessions().length) { <p class="vide">Aucune session.</p> }
      </section>
    </div>
  }`,
})
export class Synthese {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  readonly sessions = signal<SessionDto[]>([]);
  readonly statuts = computed(() => {
    const ps = this.p.indicateurs()?.par_statut ?? {};
    return (this.ref.donnees()?.statuts_fonctionnalite ?? []).filter((s) => ps[s.code]).map((s) => ({ code: s.code, libelle: s.libelle, nb: ps[s.code] }));
  });
  readonly activite = computed(() => {
    const m = this.p.indicateurs(); if (!m) return [];
    const par = new Map(m.activite_par_jour.map((a) => [a.jour, a.nb]));
    const fin = new Date(`${m.date_calcul}T00:00:00Z`);
    const jours = Array.from({ length: 30 }, (_, i) => { const d = new Date(fin.getTime() - (29 - i) * 86400000).toISOString().slice(0, 10); return { jour: d, nb: par.get(d) ?? 0 }; });
    const max = Math.max(1, ...jours.map((j) => j.nb));
    return jours.map((j) => ({ ...j, h: Math.round((j.nb / max) * 60) }));
  });
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsSessions, { code: c }).then((s) => this.sessions.set(s)).catch(() => undefined); }); }
  extrait(md: string) { return md.replace(/^---[\s\S]*?---/, '').replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220); }
}
