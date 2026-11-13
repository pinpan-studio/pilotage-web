import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Api } from '../../api/genere/api';
import { exportDiff, fichiersLister, fichiersStatut, gestionEcrireDocument, projetsDocument, projetsDocuments } from '../../api/genere/functions';
import { DiffDocumentDto, Fichier } from '../../api/genere/models';
import { Fichiers } from '../noyau/fichiers';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Saisie } from '../noyau/saisie';
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
  imports: [RouterLink, MatIconModule, Statut, Lecteur, Chargement, EmptyStateComponent, FormsModule, MatButtonModule, ...PIPES],
  styles: [`.boutons { display: flex; flex-direction: column; gap: 6px; margin: 6px 0 12px; } .boutons button { justify-content: flex-start; }
    .editeur { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); } .editeur textarea { font-family: ui-monospace, monospace; font-size: 13px; min-height: 420px; }
    .diff { white-space: pre-wrap; font: 12px/1.5 ui-monospace, monospace; margin: 0; max-height: 640px; overflow: auto; } .d-ajout { background: color-mix(in srgb, #2e7d32 18%, transparent); display: block; } .d-retrait { background: color-mix(in srgb, #c62828 16%, transparent); text-decoration: line-through; display: block; } .d-commun { color: var(--mat-sys-on-surface-variant); display: block; }
    .apercu { border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; padding: var(--space-3); overflow: auto; max-height: 520px; }
    @media (max-width: 900px) { .editeur { grid-template-columns: 1fr; } }`],
  template: `
  @if (d(); as d) {
    <app-lecteur [groupes]="arbre()" [courant]="d.code" [titre]="d.titre" [fil]="['Livrables', phase(d.phase), d.code]" [sommaire]="rendu().sommaire" titreArbre="Livrables">
      <ng-container meta>
        <app-statut [code]="d.statut" />@if (d.version) { <code>v{{ d.version }}</code> }<span>{{ d.producteur | libelle }}</span>
        @if (d.echeance_effective) { <span>Échéance {{ d.echeance_effective | dateFr }}</span> }
        @if (d.date_validation) { <span>Validé le {{ d.date_validation | dateFr }}</span> }
        @if (d.signature) { <span>{{ d.nb_scans ? 'Scan signé ✓' : 'Signature attendue' }}</span> }
      </ng-container>
      @if (edition() !== null) {
        <form class="card pane" (ngSubmit)="enregistrer()">
          <div class="editeur">
            <div class="form-field"><div class="field-box textarea-box"><textarea name="c" [(ngModel)]="contenu" (ngModelChange)="edition.set($event)"></textarea></div></div>
            <div class="apercu prose" [innerHTML]="apercu()"></div>
          </div>
          <div class="grille-form" style="margin-top: 12px">
            <div class="large"><label>Résumé de la modification</label><div class="form-field"><div class="field-box"><input name="r" [(ngModel)]="resume" placeholder="Mise à jour du chapitre 3" /></div></div></div>
          </div>
          <div class="actions-form"><button mat-button type="button" (click)="edition.set(null)">Annuler</button>
            <button mat-stroked-button type="button" (click)="enregistrer('en_cours')" [disabled]="resume.trim().length < 2">Enregistrer (en cours)</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="resume.trim().length < 2"><mat-icon>rate_review</mat-icon>Enregistrer et soumettre en revue</button></div>
          <p class="mini">Chaque enregistrement crée une nouvelle version ; un document validé ou signé repasse en revue.</p>
        </form>
      }
      @else if (diff(); as df) {
        <section class="card pane">
          <div class="tete" style="margin-bottom: 8px"><strong>Comparaison v{{ df.de }} → v{{ df.a }}</strong><span class="mini">+{{ df.ajouts }} ligne(s) · −{{ df.retraits }} ligne(s)</span><span class="esp"></span>
            <button mat-button (click)="diff.set(null)"><mat-icon>close</mat-icon>Fermer</button></div>
          <pre class="diff">@for (b of df.blocs; track $index) {<span [class]="'d-' + b.type">{{ b.texte }}</span>}</pre>
        </section>
      }
      @else if (d.version_courante) { <div class="prose" [innerHTML]="rendu().html"></div> }
      @else {
        <app-empty-state icon="draft" title="Aucun contenu" [subtitle]="d.lien_externe ? 'Ce document est conservé hors de Pilotage.' : 'Ce document n’a pas encore été rédigé (l’agent peut le produire avec /document ' + d.code + ').'" />
        @if (d.lien_externe) { <p style="text-align:center"><a [href]="d.lien_externe" target="_blank" rel="noopener">Ouvrir le document externe</a></p> }
      }
      <div droite>
        @if (p.peutEcrire()) {
          <span class="text-overline">Actions</span>
          <div class="boutons">
            @if (d.producteur !== 'humain') { <button mat-stroked-button (click)="editer()"><mat-icon>edit_note</mat-icon>{{ d.version_courante ? 'Modifier' : 'Rédiger' }}</button> }
            @if (d.statut === 'en_cours') { <button mat-button (click)="statut('en_revue')"><mat-icon>rate_review</mat-icon>Soumettre en revue</button> }
            @if (p.estChef() && ['en_revue', 'en_cours'].includes(d.statut)) { <button mat-button (click)="statut('valide')"><mat-icon>verified</mat-icon>Valider</button> }
            @if (p.estChef() && d.statut === 'valide') { <button mat-button (click)="statut('signe')"><mat-icon>draw</mat-icon>Marquer signé</button> }
            @if (p.estChef() && d.statut === 'a_produire') { <button mat-button (click)="statut('sans_objet')"><mat-icon>do_not_disturb_on</mat-icon>Sans objet</button> }
          </div>
        }
        @if (d.version_courante) {
          <span class="text-overline">Exporter</span>
          <div class="boutons">
            <button mat-stroked-button (click)="exporter('pdf')"><mat-icon>picture_as_pdf</mat-icon>PDF</button>
            <button mat-stroked-button (click)="exporter('docx')"><mat-icon>description</mat-icon>Word (.docx)</button>
            @if (d.versions.length > 1) { <button mat-button (click)="comparer()"><mat-icon>difference</mat-icon>Comparer à la version précédente</button> }
          </div>
        }
        @if (d.signature || scans().length) {
          <span class="text-overline">Scan signé</span>
          <div class="bloc-droit">
            @for (s of scans(); track s.id) { <a href="javascript:void(0)" (click)="telechargerScan(s)"><mat-icon>verified</mat-icon>{{ s.nom }} · {{ s.cree_le | dateFr }}</a> }
            @empty { <span class="mini">Aucun scan déposé.</span> }
          </div>
          @if (p.peutEcrire()) {
            <input #scan type="file" accept="application/pdf,image/*" hidden (change)="deposerScan(scan)" />
            <div class="boutons"><button mat-button (click)="scan.click()" [disabled]="depot()"><mat-icon>upload_file</mat-icon>{{ depot() ? 'Envoi…' : 'Déposer le scan signé' }}</button></div>
          }
        }
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
  readonly p = inject(ProjetCourant);
  private readonly s = inject(Saisie);
  readonly edition = signal<string | null>(null);
  private readonly fichiers = inject(Fichiers);
  readonly diff = signal<DiffDocumentDto | null>(null);
  readonly scans = signal<Fichier[]>([]);
  readonly depot = signal(false);
  exporter(format: 'pdf' | 'docx') {
    const d = this.d()!; const v = this.version();
    this.fichiers.telecharger(`/projets/${this.p.code()}/documents/${d.code}/export?format=${format}${v ? '&version=' + encodeURIComponent(v) : ''}`, `${d.code}.${format}`).catch((e) => this.s.erreur(e));
  }
  async comparer() {
    try { this.diff.set(await this.api.invoke(exportDiff, { code: this.p.code(), doc: this.doc(), a: this.version() || undefined })); } catch (e) { this.s.erreur(e); }
  }
  chargerScans() {
    const id = this.d()?.id; if (!id) return;
    this.api.invoke(fichiersLister, { code: this.p.code() }).then((l) => this.scans.set(l.filter((f) => f.document_id === id && f.categorie === 'scan_signe'))).catch(() => this.scans.set([]));
  }
  telechargerScan(f: Fichier) { this.fichiers.telecharger(`/projets/${this.p.code()}/fichiers/${f.id}/contenu`, f.nom).catch((e) => this.s.erreur(e)); }
  async deposerScan(input: HTMLInputElement) {
    const f = input.files?.[0]; input.value = ''; if (!f) return;
    this.depot.set(true);
    if (await this.s.faire(() => this.fichiers.deposer(this.p.code(), f, 'scan_signe', this.doc()), 'Scan signé déposé')) this.recharger();
    this.depot.set(false);
  }
  contenu = ''; resume = '';
  readonly apercu = computed(() => marked.parse(this.edition() ?? '', { async: false }) as string);
  editer() { this.contenu = this.d()?.version_courante?.contenu ?? ''; this.resume = ''; this.edition.set(this.contenu); }
  private recharger() { const c = this.p.code(); this.api.invoke(projetsDocument, { code: c, doc: this.doc() }).then((x) => { this.d.set(x); this.chargerScans(); }); this.api.invoke(projetsDocuments, { code: c }).then((l) => this.docs.set(l)); this.p.rafraichir(); }
  async enregistrer(statut: 'en_cours' | 'en_revue' = 'en_revue') {
    if (await this.s.faire(() => this.api.invoke(gestionEcrireDocument, { code: this.p.code(), doc: this.doc(), body: { contenu_md: this.contenu, resume_modif: this.resume.trim(), statut } }), 'Nouvelle version enregistrée')) { this.edition.set(null); this.recharger(); }
  }
  async statut(statut: 'en_revue' | 'valide' | 'signe' | 'sans_objet') {
    if (await this.s.faire(() => this.api.invoke(fichiersStatut, { code: this.p.code(), doc: this.doc(), body: { statut } }), 'Statut du document mis à jour')) this.recharger();
  }
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
    effect(() => { const c = this.p.code(), doc = this.doc(), v = this.version(); this.diff.set(null); if (c && doc) this.api.invoke(projetsDocument, { code: c, doc, version: v }).then((x) => { this.d.set(x); this.chargerScans(); }); });
  }
}
