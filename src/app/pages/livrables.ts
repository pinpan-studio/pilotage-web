import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { projetsDocument, projetsDocuments } from '../../api/genere/functions';
import { DocumentDetailDto, DocumentDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { Statut, tonDeCouleur } from '../noyau/statut';
import { Chargement } from '../noyau/chargement';
import { GraphiquesService } from '../noyau/graphiques.service';
import { GroupeLecteur, Lecteur, ancrer } from '../noyau/lecteur';
import { marked } from 'marked';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { NoteGridComponent, PlanningFilter, PlanningItem, PlanningTone } from '../shared/components/planning';
import { ProjetCourant } from './projet';

/** Livrables : grille de notes du ui-kit (une note par document du projet). */
@Component({
  selector: 'app-livrables',
  imports: [MatIconModule, NoteGridComponent, Chargement, ...PIPES],
  styles: [`.card.plan { padding: var(--space-4); }`],
  template: `
  @if (p.indicateurs(); as m) {
    <div class="kpis">@for (ph of m.documents_par_phase.slice(0, 4); track ph.code) {
      <div class="card kpi"><span class="k-label"><mat-icon>folder_open</mat-icon>{{ ph.titre }}</span><span class="k-val">{{ ph.avancement | pct }}</span><span class="k-foot">{{ ph.finalises }} / {{ ph.nb }} finalisé(s)</span></div> }
    </div>
  }
  @if (charge()) {
    <section class="card plan"><app-note-grid [items]="notes()" [minWidth]="250" [descriptionLines]="2" [searchable]="true" [lateToggle]="true" [filters]="filtres()" emptyLabel="Aucun document" (itemClick)="ouvrir($event)" /></section>
  } @else { <app-chargement forme="planning" /> }`,
})
export class Livrables {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly router = inject(Router);
  readonly docs = signal<DocumentDto[]>([]);
  readonly charge = signal(false);
  private poids(statut: string) { return this.ref.donnees()?.statuts_document.find((s) => s.code === statut)?.poids ?? 0; }
  readonly notes = computed<PlanningItem[]>(() => this.docs().map((d) => {
    const ton = tonDeCouleur(this.ref.couleur(d.statut)) as PlanningTone;
    return { id: d.id, ref: d.code, title: d.titre, tone: ton, badge: { label: this.ref.libelle(d.statut), tone: ton },
      description: [this.ref.phase(d.phase), this.ref.libelle(d.producteur), d.version && `v${d.version}`].filter(Boolean).join(' · '),
      due: d.echeance_effective ?? undefined, done: ['valide', 'signe', 'sans_objet'].includes(d.statut), progress: Math.round(this.poids(d.statut) * 100),
      assignee: d.responsable || undefined, tags: [d.livrable ? 'Livrable' : '', d.signature ? (d.nb_scans ? 'Signé ✓' : 'À signer') : ''].filter(Boolean),
      fields: { phase: d.phase, statut: d.statut }, data: d.code };
  }));
  readonly filtres = computed<PlanningFilter[]>(() => [
    { key: 'phase', label: 'Phase', allLabel: 'Toutes', options: (this.ref.donnees()?.phases ?? []).map((x) => ({ value: x.code, label: x.libelle })) },
    { key: 'statut', label: 'Statut', allLabel: 'Tous', options: (this.ref.donnees()?.statuts_document ?? []).map((x) => ({ value: x.code, label: x.libelle })) },
  ]);
  constructor() { effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsDocuments, { code: c }).then((l) => { this.docs.set(l); this.charge.set(true); }); }); }
  ouvrir(i: PlanningItem) { this.router.navigate(['/projets', this.p.code(), 'livrables', i.data]); }
}

/** Contenu d'un livrable — gabarit de documentation du ui-kit (examples/app/docs). */
@Component({
  selector: 'app-document',
  imports: [RouterLink, MatIconModule, Statut, Lecteur, Chargement, EmptyStateComponent, ...PIPES],
  template: `
  @if (d(); as d) {
    <app-lecteur [groupes]="arbre()" [courant]="d.code" [titre]="d.titre" [fil]="['Livrables', phase(d.phase), d.code]" [sommaire]="rendu().sommaire" titreArbre="Livrables">
      <ng-container meta>
        <app-statut [code]="d.statut" />@if (d.version) { <code>v{{ d.version }}</code> }<span>{{ d.producteur | libelle }}</span>
        @if (d.echeance_effective) { <span>Échéance {{ d.echeance_effective | dateFr }}</span> }
        @if (d.date_validation) { <span>Validé le {{ d.date_validation | dateFr }}</span> }
        @if (d.signature) { <span>{{ d.nb_scans ? 'Scan signé ✓' : 'Signature attendue' }}</span> }
      </ng-container>
      @if (d.version_courante) { <div class="prose" [innerHTML]="rendu().html"></div> }
      @else {
        <app-empty-state icon="draft" title="Aucun contenu" [subtitle]="d.lien_externe ? 'Ce document est conservé hors de Pilotage.' : 'Ce document n’a pas encore été rédigé (l’agent peut le produire avec /document ' + d.code + ').'" />
        @if (d.lien_externe) { <p style="text-align:center"><a [href]="d.lien_externe" target="_blank" rel="noopener">Ouvrir le document externe</a></p> }
      }
      <div droite>
        <span class="text-overline">Versions</span>
        <div class="bloc-droit">
          @for (v of d.versions; track v.id) {
            <a [routerLink]="[]" [queryParams]="{ version: v.numero }" [style.fontWeight]="v.id === d.version_courante?.id ? 600 : 400">
              <mat-icon>{{ v.figee ? 'lock' : v.auteur_type === 'agent' ? 'smart_toy' : 'history_edu' }}</mat-icon>v{{ v.numero }} · {{ v.cree_le | dateFr }}</a>
          } @empty { <span class="muted" style="font-size: 12px">Aucune version</span> }
        </div>
        @if (d.description) { <hr /><span class="text-overline">À propos</span><p class="muted" style="font-size: 12px; margin: 4px 0 0">{{ d.description }}</p> }
      </div>
    </app-lecteur>
  } @else { <app-chargement forme="document" /> }`,
})
export class Document {
  private readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly g = inject(GraphiquesService);
  readonly doc = input.required<string>();
  readonly version = input<string>();
  readonly d = signal<DocumentDetailDto | null>(null);
  readonly docs = signal<DocumentDto[]>([]);
  readonly rendu = computed(() => ancrer(marked.parse(this.d()?.version_courante?.contenu ?? '', { async: false }) as string));
  readonly arbre = computed<GroupeLecteur[]>(() => (this.ref.donnees()?.phases ?? []).map((ph) => ({ libelle: ph.libelle, icone: 'folder',
    feuilles: this.docs().filter((x) => x.phase === ph.code).map((x) => ({ id: x.code, libelle: x.titre, lien: ['/projets', this.p.code(), 'livrables', x.code], couleur: this.g.ton(tonDeCouleur(this.ref.couleur(x.statut))) })) }))
    .filter((g) => g.feuilles.length));
  phase = (c: string) => this.ref.phase(c);
  constructor() {
    effect(() => { const c = this.p.code(); if (c) this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)); });
    effect(() => { const c = this.p.code(), doc = this.doc(), v = this.version(); if (c && doc) this.api.invoke(projetsDocument, { code: c, doc, version: v }).then((x) => this.d.set(x)); });
  }
}
