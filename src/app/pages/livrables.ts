import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../api/genere/api';
import { projetsDocument, projetsDocuments } from '../../api/genere/functions';
import { DocumentDetailDto, DocumentDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { ProjetCourant } from './projet';

@Component({
  selector: 'app-livrables',
  imports: [RouterLink, ...PIPES],
  template: `
  @if (p.indicateurs(); as m) {
    <div class="tuiles">@for (ph of m.documents_par_phase; track ph.code) {
      <div class="tuile"><div class="valeur">{{ ph.avancement | pct }}</div><div class="libelle">{{ ph.titre }}</div><div class="detail">{{ ph.finalises }} / {{ ph.nb }} finalisé(s)</div></div> }
    </div>
  }
  @for (g of parPhase(); track g.code) {
    <h3 class="sous-titre">{{ g.titre }}</h3>
    <div class="carte defile"><table class="tableau">
      <thead><tr><th>Code</th><th>Document</th><th>Statut</th><th>Version</th><th>Échéance</th><th>Responsable</th><th>Producteur</th></tr></thead>
      <tbody>@for (d of g.docs; track d.id) {
        <tr [class.termine]="d.statut === 'sans_objet'">
          <td class="id"><a [routerLink]="[d.code]">{{ d.code }}</a></td>
          <td>{{ d.titre }}@if (d.livrable) { <span class="badge petit">livrable</span> } @if (d.signature) { <span class="badge petit">signature{{ d.nb_scans ? ' ✓' : '' }}</span> }</td>
          <td><span [class]="'badge b-' + d.statut">{{ d.statut | libelle }}</span></td>
          <td>{{ d.version || '—' }}</td>
          <td [class.ko]="enRetard(d)">{{ d.echeance_effective | dateFr }}</td>
          <td>{{ d.responsable || '—' }}</td>
          <td><span [class]="'badge petit b-' + d.producteur">{{ d.producteur | libelle }}</span></td>
        </tr> }</tbody>
    </table></div>
  }`,
})
export class Livrables {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  readonly docs = signal<DocumentDto[]>([]);
  readonly parPhase = computed(() => (this.ref.donnees()?.phases ?? []).map((ph) => ({ code: ph.code, titre: ph.libelle, docs: this.docs().filter((d) => d.phase === ph.code) })).filter((g) => g.docs.length));
  enRetard(d: DocumentDto) { const m = this.p.indicateurs(); return !!d.echeance_effective && !!m && !['valide', 'signe', 'sans_objet'].includes(d.statut) && d.echeance_effective < m.date_calcul; }
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)); }); }
}

@Component({
  selector: 'app-document',
  imports: [RouterLink, ...PIPES],
  template: `
  <p><a routerLink="..">← Tous les livrables</a></p>
  @if (d(); as d) {
    <div class="grille grille-doc">
      <article class="carte doc prose">
        @if (d.version_courante) { <div [innerHTML]="d.version_courante.contenu | md"></div> }
        @else { <p class="vide">Aucun contenu rédigé pour ce document{{ d.lien_externe ? '' : '.' }}</p> @if (d.lien_externe) { <p><a [href]="d.lien_externe" target="_blank" rel="noopener">Ouvrir le document externe</a></p> } }
      </article>
      <aside>
        <section class="carte fiche"><h2>{{ d.code }}</h2><dl>
          <dt>Titre</dt><dd>{{ d.titre }}</dd>
          <dt>Statut</dt><dd><span [class]="'badge b-' + d.statut">{{ d.statut | libelle }}</span></dd>
          <dt>Version</dt><dd>{{ d.version || '—' }}</dd>
          <dt>Échéance</dt><dd>{{ d.echeance_effective | dateFr }}</dd>
          <dt>Producteur</dt><dd>{{ d.producteur | libelle }}</dd>
          <dt>Validé le</dt><dd>{{ d.date_validation | dateFr }}</dd>
          <dt>Scans</dt><dd>{{ d.nb_scans }}</dd>
        </dl>@if (d.description) { <p class="note">{{ d.description }}</p> }</section>
        <section class="carte"><h2>Versions</h2><ul class="versions">
          @for (v of d.versions; track v.id) {
            <li [class.actif]="v.id === d.version_courante?.id"><a [routerLink]="[]" [queryParams]="{ version: v.numero }">v{{ v.numero }}</a>
              @if (v.auteur_type === 'agent') { <span class="badge petit b-agent">Agent</span> } {{ v.auteur }} · <small>{{ v.cree_le | dateFr: true }}</small>
              @if (v.figee) { <small>· figée</small> }<div class="note">{{ v.resume_modif }}</div></li>
          } @empty { <li class="vide">Aucune version.</li> }
        </ul></section>
      </aside>
    </div>
  } @else { <p class="chargement">Chargement…</p> }`,
})
export class Document {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly doc = input.required<string>();
  readonly version = input<string>();
  readonly d = signal<DocumentDetailDto | null>(null);
  constructor() { effect(() => { const c = this.p.code(), doc = this.doc(), v = this.version(); if (c && doc) this.api.invoke(projetsDocument, { code: c, doc, version: v }).then((x) => this.d.set(x)); }); }
}
