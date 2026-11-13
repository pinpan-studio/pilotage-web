import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/genere/api';
import { projetsFonctionnalite, projetsFonctionnalites } from '../../api/genere/functions';
import { FonctionnaliteDetailDto, FonctionnaliteDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { ProjetCourant } from './projet';

@Component({
  selector: 'app-fonctionnalites',
  imports: [FormsModule, RouterLink, ...PIPES],
  template: `
  <div class="filtres">
    <input class="filtre" placeholder="Rechercher…" [(ngModel)]="texte">
    <select class="filtre" [(ngModel)]="statut"><option value="">Tous les statuts</option>@for (s of ref.donnees()?.statuts_fonctionnalite ?? []; track s.code) { <option [value]="s.code">{{ s.libelle }}</option> }</select>
    <select class="filtre" [(ngModel)]="lot"><option value="">Tous les lots</option>@for (l of lots(); track l) { <option [value]="l">{{ l }}</option> }</select>
    <select class="filtre" [(ngModel)]="depot"><option value="">Tous les dépôts</option>@for (d of p.detail()?.depots ?? []; track d.id) { <option [value]="d.nom">{{ d.nom }}</option> }</select>
  </div>
  <div class="carte defile">
    <table class="tableau">
      <thead><tr><th>Réf.</th><th>Fonctionnalité</th><th>Lot</th><th class="num">Poids</th><th>Statut</th><th>Dépôts</th><th class="avc">Avancement</th><th>Tests</th><th>Dernière activité</th></tr></thead>
      <tbody>
      @for (f of filtrees(); track f.id) {
        <tr [class.alerte-ligne]="f.statut_effectif === 'bloque'" [class.barre-texte]="f.statut === 'abandonne'">
          <td class="id"><a [routerLink]="[f.ref]">{{ f.ref }}</a></td>
          <td>{{ f.titre }}@if (f.notes) { <div class="note">{{ f.notes }}</div> }</td>
          <td>{{ f.jalon }}</td><td class="num">{{ f.poids }}</td>
          <td><span [class]="'badge b-' + f.statut_effectif">{{ f.statut_effectif | libelle }}</span></td>
          <td>@for (d of f.depots; track d.depot) { <div><small>{{ d.depot }}</small> <span [class]="'badge petit b-' + d.statut">{{ d.statut | libelle }}</span></div> }</td>
          <td class="avc"><div class="barre"><span [style.width.%]="f.avancement * 100"></span></div><small>{{ f.avancement | pct }}</small></td>
          <td>@for (t of f.cas_test; track t) { <span class="ref">{{ t }}</span> } @empty { <span class="mute">—</span> }</td>
          <td><small>{{ f.derniere_activite | dateFr }}</small></td>
        </tr>
      } @empty { <tr><td colspan="9" class="vide">Aucune fonctionnalité.</td></tr> }
      </tbody>
    </table>
  </div>`,
})
export class Fonctionnalites {
  readonly p = inject(ProjetCourant);
  readonly ref = inject(ReferentielsService);
  private readonly api = inject(Api);
  readonly liste = signal<FonctionnaliteDto[]>([]);
  texte = ''; statut = ''; lot = ''; depot = '';
  readonly lots = computed(() => [...new Set(this.liste().map((f) => f.jalon).filter(Boolean))]);
  filtrees() {
    const t = this.texte.toLowerCase();
    return this.liste().filter((f) => (!t || `${f.ref} ${f.titre}`.toLowerCase().includes(t)) && (!this.statut || f.statut_effectif === this.statut)
      && (!this.lot || f.jalon === this.lot) && (!this.depot || f.depots.some((d) => d.depot === this.depot)));
  }
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.liste.set(l)); }); }
}

@Component({
  selector: 'app-fonctionnalite',
  imports: [RouterLink, ...PIPES],
  template: `
  <p><a routerLink="..">← Toutes les fonctionnalités</a></p>
  @if (f(); as f) {
    <div class="grille">
      <section class="carte fiche large"><h2>{{ f.ref }} — {{ f.titre }}</h2>
        <dl>
          <dt>Statut</dt><dd><span [class]="'badge b-' + f.statut_effectif">{{ f.statut_effectif | libelle }}</span> <small>(global : {{ f.statut | libelle }})</small></dd>
          <dt>Avancement</dt><dd>{{ f.avancement | pct }}</dd>
          <dt>Lot · poids</dt><dd>{{ f.jalon || '—' }} · {{ f.poids }}</dd>
          <dt>Origine</dt><dd>{{ f.origine }}</dd>
          <dt>Exigences</dt><dd>@for (e of f.exigences; track e) { <span class="ref">{{ e }}</span> } @empty { — }</dd>
          <dt>Dépôts</dt><dd>@for (d of f.depots; track d.depot) { {{ d.depot }} <span [class]="'badge petit b-' + d.statut">{{ d.statut | libelle }}</span>&nbsp; } @empty { — }</dd>
          <dt>Retours clients</dt><dd>@for (r of f.retours; track r) { <span class="ref">{{ r }}</span> } @empty { — }</dd>
          @if (f.notes) { <dt>Notes</dt><dd>{{ f.notes }}</dd> }
        </dl>
      </section>
      <section class="carte"><h2>Cas de test</h2>
        <table class="tableau compact"><tbody>@for (t of f.tests; track t.ref) { <tr><td class="id">{{ t.ref }}</td><td>{{ t.titre }}</td><td><span [class]="'ref r-' + t.resultat">{{ t.resultat | libelle }}</span> <small>{{ t.campagne }}</small></td></tr> } @empty { <tr><td class="vide">Aucun cas de test.</td></tr> }</tbody></table>
      </section>
      <section class="carte"><h2>Commits</h2>
        <table class="tableau compact"><tbody>@for (c of f.commits; track c.id) { <tr><td><small>{{ c.ts | dateFr }}</small></td><td class="id">{{ c.hash }}</td><td>{{ c.message }}</td></tr> } @empty { <tr><td class="vide">Aucun commit.</td></tr> }</tbody></table>
      </section>
      <section class="carte large"><h2>Journal lié</h2>
        <table class="tableau compact"><tbody>@for (e of f.journal; track e.id) { <tr><td><small>{{ e.ts | dateFr: true }}</small></td><td><span [class]="'evt e-' + e.evt">{{ e.evt }}</span></td><td>{{ e.depot }}</td><td>{{ e.auteur }}</td><td class="code">{{ e.fichier || e.commande || e.message }}</td></tr> } @empty { <tr><td class="vide">Aucune activité.</td></tr> }</tbody></table>
      </section>
    </div>
  } @else { <p class="chargement">Chargement…</p> }`,
})
export class Fonctionnalite {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly refF = input.required<string>({ alias: 'ref' });
  readonly f = signal<FonctionnaliteDetailDto | null>(null);
  constructor() { effect(() => { const c = this.p.code(), r = this.refF(); if (c && r) this.api.invoke(projetsFonctionnalite, { code: c, ref: r }).then((x) => this.f.set(x)); }); }
}
