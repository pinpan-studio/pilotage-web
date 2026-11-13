import { Component, Injectable, computed, inject, input, signal, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Api } from '../../api/genere/api';
import { projetsDetail, projetsIndicateurs } from '../../api/genere/functions';
import { IndicateursDto, ProjetDetailDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';

/** Données du projet courant, partagées par les onglets. */
@Injectable()
export class ProjetCourant {
  private readonly api = inject(Api);
  readonly code = signal('');
  readonly detail = signal<ProjetDetailDto | null>(null);
  readonly indicateurs = signal<IndicateursDto | null>(null);
  readonly erreur = signal('');
  async charger(code: string) {
    this.code.set(code); this.detail.set(null); this.indicateurs.set(null); this.erreur.set('');
    try {
      const [d, i] = await Promise.all([this.api.invoke(projetsDetail, { code }), this.api.invoke(projetsIndicateurs, { code })]);
      this.detail.set(d); this.indicateurs.set(i);
    } catch (e: any) { this.erreur.set(e?.status === 404 ? 'Projet introuvable ou inaccessible.' : 'Erreur de chargement du projet.'); }
  }
}

@Component({
  selector: 'app-projet',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ...PIPES],
  providers: [ProjetCourant],
  template: `
  <p class="ariane"><a routerLink="/">Portefeuille</a><span>›</span>{{ p.detail()?.nom ?? code() }}</p>
  @if (p.erreur()) { <p class="erreur-texte">{{ p.erreur() }}</p> }
  @if (p.detail(); as d) {
    <div class="titre-projet">
      <div><h1>{{ d.nom }}</h1><p class="sous">{{ d.client }} · chef de projet : {{ d.chef_projet ?? '—' }}</p></div>
      <div class="dates"><div><span>Début</span>{{ d.date_debut | dateFr }}</div><div><span>Livraison prévue</span>{{ d.date_livraison_prevue | dateFr }}</div>
        <div><span>Avancement</span>{{ p.indicateurs()?.avancement | pct }}</div></div>
    </div>
    <nav class="onglets">
      <a routerLink="synthese" routerLinkActive="actif">Synthèse</a>
      <a routerLink="fonctionnalites" routerLinkActive="actif">Fonctionnalités</a>
      <a routerLink="livrables" routerLinkActive="actif">Livrables</a>
      <a routerLink="journal" routerLinkActive="actif">Journal</a>
    </nav>
    <router-outlet />
  } @else if (!p.erreur()) { <p class="chargement">Chargement…</p> }`,
})
export class Projet {
  readonly p = inject(ProjetCourant);
  readonly code = input.required<string>();
  constructor() { effect(() => { const c = this.code(); if (c !== this.p.code()) this.p.charger(c); }); }
}
