import { Component, Injectable, effect, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ONGLETS_PROJET } from '../noyau/navigation.service';
import { Api } from '../../api/genere/api';
import { projetsDetail, projetsIndicateurs } from '../../api/genere/functions';
import { IndicateursDto, ProjetDetailDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { Statut } from '../noyau/statut';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatButtonModule, Statut, EmptyStateComponent, ...PIPES],
  providers: [ProjetCourant],
  template: `
  <div class="pl-page">
    @if (p.erreur()) { <app-empty-state icon="folder_off" title="Projet indisponible" [subtitle]="p.erreur()" /> }
    @else if (p.detail(); as d) {
      <div class="page-head">
        <div class="titles"><span class="eyebrow">{{ d.client }} · {{ d.code }}</span><h1>{{ d.nom }}</h1>
          <p>Chef de projet : {{ d.chef_projet ?? '—' }} · du {{ d.date_debut | dateFr }} au {{ d.date_livraison_prevue | dateFr }}
            @if (p.indicateurs(); as m) { · calculé le {{ m.date_calcul | dateFr }} }</p></div>
        <div class="actions">
          <app-statut [code]="d.statut" />
          <button mat-stroked-button (click)="p.charger(d.code)"><mat-icon>refresh</mat-icon>Actualiser</button>
        </div>
      </div>
      <nav class="tabs" aria-label="Sections du projet">
        @for (o of onglets; track o.seg) { <a [routerLink]="o.seg" routerLinkActive="on"><mat-icon>{{ o.icon }}</mat-icon>{{ o.label }}</a> }
      </nav>
      <router-outlet />
    } @else { <div class="loading">Chargement du projet…</div> }
  </div>`,
})
export class Projet {
  readonly p = inject(ProjetCourant);
  readonly code = input.required<string>();
  readonly onglets = ONGLETS_PROJET;
  constructor() { effect(() => { const c = this.code(); if (c !== this.p.code()) this.p.charger(c); }); }
}
