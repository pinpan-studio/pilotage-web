import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Api } from '../../api/genere/api';
import { projetsFonctionnalite, projetsFonctionnalites } from '../../api/genere/functions';
import { FonctionnaliteDetailDto, FonctionnaliteDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Statut, tonDeCouleur } from '../noyau/statut';
import { Chargement } from '../noyau/chargement';
import { GraphiquesService } from '../noyau/graphiques.service';
import { GroupeLecteur, Lecteur } from '../noyau/lecteur';
import { GroupedBoardComponent, PlanningFilter, PlanningGroup, PlanningItem, PlanningTone } from '../shared/components/planning';
import { ProjetCourant } from './projet';

/** Fonctionnalités : vue groupée du ui-kit en liste (layout="list"), un groupe par lot. */
@Component({
  selector: 'app-fonctionnalites',
  imports: [GroupedBoardComponent, Chargement],
  styles: [`.card.plan { padding: var(--space-4); }`],
  template: `
  @if (charge()) {
    <section class="card plan">
      <app-grouped-board [items]="items()" [groups]="lots()" layout="list" [showProgress]="true" [searchable]="true" [lateToggle]="false" [filters]="filtres()" ungroupedLabel="Sans lot" (itemClick)="ouvrir($event)" />
    </section>
  } @else { <app-chargement forme="table" [lignes]="9" /> }`,
})
export class Fonctionnalites {
  readonly p = inject(ProjetCourant);
  private readonly ref = inject(ReferentielsService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly liste = signal<FonctionnaliteDto[]>([]);
  readonly charge = signal(false);
  readonly lots = computed<PlanningGroup[]>(() => (this.p.indicateurs()?.par_lot ?? []).map((l) => ({ key: l.nom, label: l.nom, subtitle: `${l.nb} fonctionnalité(s) · avancement ${Math.round(l.avancement * 100)} %`, icon: 'inventory_2' })));
  readonly items = computed<PlanningItem[]>(() => this.liste().map((f) => {
    const ton = tonDeCouleur(this.ref.couleur(f.statut_effectif)) as PlanningTone;
    return { id: f.id, ref: f.ref, title: f.titre, group: f.jalon || undefined, status: f.statut_effectif, progress: Math.round(f.avancement * 100),
      done: ['valide', 'abandonne'].includes(f.statut_effectif), tone: ton, badge: { label: this.ref.libelle(f.statut_effectif), tone: ton },
      description: f.depots.map((d) => `${d.depot} : ${this.ref.libelle(d.statut)}`).join(' · ') || f.notes,
      tags: [`Poids ${f.poids}`, ...f.exigences, ...(f.cas_test.length ? [`${f.cas_test.length} test(s)`] : [])],
      fields: { statut: f.statut_effectif, depot: f.depots.map((d) => d.depot) }, data: f.ref };
  }));
  readonly filtres = computed<PlanningFilter[]>(() => [
    { key: 'statut', label: 'Statut', allLabel: 'Tous', options: (this.ref.donnees()?.statuts_fonctionnalite ?? []).map((s) => ({ value: s.code, label: s.libelle })) },
    { key: 'depot', label: 'Dépôt', allLabel: 'Tous', options: (this.p.detail()?.depots ?? []).map((d) => ({ value: d.nom, label: d.nom })) },
  ]);
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => { this.liste.set(l); this.charge.set(true); }); }); }
  ouvrir(i: PlanningItem) { this.router.navigate(['/projets', this.p.code(), 'fonctionnalites', i.data]); }
}

/** Fiche d'une fonctionnalité — gabarit de documentation du ui-kit (examples/app/docs). */
@Component({
  selector: 'app-fonctionnalite',
  imports: [MatIconModule, MatProgressBarModule, Statut, Lecteur, Chargement, ...PIPES],
  template: `
  @if (f(); as f) {
    <app-lecteur [groupes]="arbre()" [courant]="f.ref" [titre]="f.ref + ' — ' + f.titre" [fil]="['Fonctionnalités', f.jalon || 'Sans lot', f.ref]" [sommaire]="sommaire" titreArbre="Fonctionnalités">
      <ng-container meta><app-statut [code]="f.statut_effectif" /><code>poids {{ f.poids }}</code><span>Origine {{ f.origine }}</span><span>Dernière activité {{ f.derniere_activite | dateFr: true }}</span></ng-container>
      <div class="prose">
        <h2 id="avancement">Avancement</h2>
        <div class="goals" style="padding-top: 0"><div class="goal"><div class="g-top"><span>Global</span><strong>{{ f.avancement | pct }}</strong></div><mat-progress-bar mode="determinate" [value]="f.avancement * 100" /></div>
          @for (d of f.depots; track d.depot) { <div class="goal"><div class="g-top"><span>{{ d.depot }}</span><app-statut [code]="d.statut" /></div></div> }</div>
        @if (f.notes) { <blockquote>{{ f.notes }}</blockquote> }
        <h2 id="perimetre">Périmètre</h2>
        <p>Exigences couvertes : @for (e of f.exigences; track e) { <span class="ref">{{ e }}</span> } @empty { aucune }</p>
        <p>Retours clients liés : @for (r of f.retours; track r) { <span class="ref">{{ r }}</span> } @empty { aucun }</p>
        <h2 id="recette">Recette</h2>
        @if (f.tests.length) { <table><thead><tr><th>Cas</th><th>Titre</th><th>Résultat</th></tr></thead><tbody>
          @for (t of f.tests; track t.ref) { <tr><td><code>{{ t.ref }}</code></td><td>{{ t.titre }}</td><td><app-statut [code]="t.resultat" /> {{ t.campagne ?? '' }}</td></tr> }</tbody></table> }
        @else { <p class="muted">Aucun cas de test : à ajouter au cahier de recette.</p> }
        <h2 id="commits">Commits</h2>
        @if (f.commits.length) { <ul>@for (c of f.commits; track c.id) { <li><code>{{ c.hash }}</code> {{ c.message }} — <small class="muted">{{ c.auteur }}, {{ c.ts | dateFr }}</small></li> }</ul> }
        @else { <p class="muted">Aucun commit référencé ([{{ f.ref }}] dans le message).</p> }
        <h2 id="activite">Activité</h2>
        <ul>@for (e of f.journal.slice(0, 15); track e.id) { <li><small class="muted">{{ e.ts | dateFr: true }}</small> — {{ e.evt }} · {{ e.fichier || e.commande || e.message }} <small class="muted">({{ e.depot }})</small></li> } @empty { <li class="muted">Aucune activité.</li> }</ul>
      </div>
    </app-lecteur>
  } @else { <app-chargement forme="document" /> }`,
})
export class Fonctionnalite {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly g = inject(GraphiquesService);
  readonly refF = input.required<string>({ alias: 'ref' });
  readonly f = signal<FonctionnaliteDetailDto | null>(null);
  readonly liste = signal<FonctionnaliteDto[]>([]);
  readonly sommaire = [{ id: 'avancement', texte: 'Avancement', niveau: 2 as const }, { id: 'perimetre', texte: 'Périmètre', niveau: 2 as const }, { id: 'recette', texte: 'Recette', niveau: 2 as const },
    { id: 'commits', texte: 'Commits', niveau: 2 as const }, { id: 'activite', texte: 'Activité', niveau: 2 as const }];
  readonly arbre = computed<GroupeLecteur[]>(() => {
    const lots = [...new Set(this.liste().map((x) => x.jalon || 'Sans lot'))];
    return lots.map((l) => ({ libelle: l, icone: 'inventory_2', feuilles: this.liste().filter((x) => (x.jalon || 'Sans lot') === l)
      .map((x) => ({ id: x.ref, ref: x.ref, libelle: x.titre, lien: ['/projets', this.p.code(), 'fonctionnalites', x.ref], couleur: this.g.ton(tonDeCouleur(this.ref.couleur(x.statut_effectif))) })) }));
  });
  constructor() {
    effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.liste.set(l)); });
    effect(() => { const c = this.p.code(), r = this.refF(); if (c && r) this.api.invoke(projetsFonctionnalite, { code: c, ref: r }).then((x) => this.f.set(x)); });
  }
}
