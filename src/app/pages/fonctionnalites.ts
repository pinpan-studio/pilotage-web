import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { marked } from 'marked';
import { Saisie } from '../noyau/saisie';
import { Http } from '../noyau/http';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { ecritureStatutFonctionnalite, gestionCreerFonctionnalite, gestionMajFonctionnalite } from '../../api/genere/functions';
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
  imports: [GroupedBoardComponent, Chargement, FormsModule, MatButtonModule, MatIconModule, SearchableSelectComponent],
  styles: [`.card.plan { padding: var(--space-4); }`],
  template: `
  @if (p.peutEcrire()) { <div class="tete"><span class="esp"></span><button mat-flat-button color="primary" (click)="form.set(!form())"><mat-icon>add</mat-icon>Nouvelle fonctionnalité</button></div> }
  @if (form()) {
    <form class="card pane" (ngSubmit)="creer()">
      <div class="grille-form">
        <div class="large"><label>Titre</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="n.titre" placeholder="Export des déclarations en PDF" /></div></div></div>
        <div><label>Lot</label><div class="form-field"><div class="field-box"><input name="l" list="lots-connus" [(ngModel)]="n.lot" placeholder="Lot 1" /><datalist id="lots-connus">@for (o of oLots(); track o.value) { <option [value]="o.value"></option> }</datalist></div></div></div>
        <div><label>Poids (effort)</label><app-searchable-select name="p" [(ngModel)]="n.poids" [options]="oPoids" /></div>
        <div class="large"><label>Dépôts concernés</label><div style="display: flex; gap: 8px; flex-wrap: wrap">@for (d of p.detail()?.depots ?? []; track d.nom) {
          <button type="button" class="chip-filter" [class.on]="n.depots.includes(d.nom)" (click)="basculer(d.nom)"><mat-icon>{{ n.depots.includes(d.nom) ? 'check' : 'folder' }}</mat-icon>{{ d.nom }}</button> }</div></div>
        <div class="large"><label>Description et critères d'acceptation (Markdown)</label><div class="form-field"><div class="field-box textarea-box"><textarea name="d" rows="5" [(ngModel)]="n.description" placeholder="## Critères d'acceptation&#10;- …"></textarea></div></div></div>
      </div>
      <div class="actions-form"><button mat-button type="button" (click)="form.set(false)">Annuler</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="n.titre.trim().length < 2 || enCours()"><mat-icon>save</mat-icon>Créer</button></div>
    </form>
  }
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
  private readonly s = inject(Saisie);
  readonly form = signal(false);
  readonly enCours = signal(false);
  n = { titre: '', lot: '', poids: 3, depots: [] as string[], description: '' };
  readonly oPoids = [1, 2, 3, 5, 8].map((v) => ({ value: v, label: `${v}`, description: ({ 1: 'Très petit', 2: 'Petit', 3: 'Moyen', 5: 'Grand', 8: 'Très grand' } as any)[v] }));
  readonly oLots = computed(() => [...new Set(this.liste().map((f) => f.jalon).filter(Boolean))].map((l) => ({ value: l, label: l, icon: 'inventory_2' })));
  basculer(d: string) { this.n.depots = this.n.depots.includes(d) ? this.n.depots.filter((x) => x !== d) : [...this.n.depots, d]; }
  charger() { const c = this.p.code(); if (c) this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => { this.liste.set(l); this.charge.set(true); }); }
  async creer() {
    this.enCours.set(true);
    const r = await this.s.faire(() => this.api.invoke(gestionCreerFonctionnalite, { code: this.p.code(), body: { titre: this.n.titre.trim(), lot: this.n.lot || undefined, poids: +this.n.poids as 1 | 2 | 3 | 5 | 8,
      depots: this.n.depots, description: this.n.description } }), 'Fonctionnalité créée');
    this.enCours.set(false);
    if (r) { this.form.set(false); this.n = { titre: '', lot: this.n.lot, poids: 3, depots: [], description: '' }; this.charger(); this.p.rafraichir(); this.router.navigate(['/projets', this.p.code(), 'fonctionnalites', r.ref]); }
  }
  constructor() { effect(() => { if (this.p.code()) this.charger(); }); }
  ouvrir(i: PlanningItem) { this.router.navigate(['/projets', this.p.code(), 'fonctionnalites', i.data]); }
}

/** Fiche d'une fonctionnalité — gabarit de documentation du ui-kit (examples/app/docs). */
@Component({
  selector: 'app-fonctionnalite',
  imports: [MatIconModule, MatProgressBarModule, Statut, Lecteur, Chargement, FormsModule, MatButtonModule, SearchableSelectComponent, ...PIPES],
  styles: [`.boutons { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; } .boutons button { justify-content: flex-start; }`],
  template: `
  @if (f(); as f) {
    <app-lecteur [groupes]="arbre()" [courant]="f.ref" [titre]="f.ref + ' — ' + f.titre" [fil]="['Fonctionnalités', f.jalon || 'Sans lot', f.ref]" [sommaire]="sommaire" titreArbre="Fonctionnalités">
      <ng-container meta><app-statut [code]="f.statut_effectif" /><code>poids {{ f.poids }}</code><span>Origine {{ f.origine }}</span><span>Dernière activité {{ f.derniere_activite | dateFr: true }}</span></ng-container>
      @if (edition(); as e) {
        <form class="card pane" (ngSubmit)="enregistrer()">
          <div class="grille-form">
            <div class="large"><label>Titre</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="e.titre" /></div></div></div>
            <div><label>Lot</label><div class="form-field"><div class="field-box"><input name="l" [(ngModel)]="e.lot" /></div></div></div>
            <div><label>Poids</label><app-searchable-select name="p" [(ngModel)]="e.poids" [options]="oPoids" /></div>
            <div class="large"><label>Description et critères d'acceptation (Markdown)</label><div class="form-field"><div class="field-box textarea-box"><textarea name="d" rows="8" [(ngModel)]="e.description"></textarea></div></div></div>
          </div>
          <div class="actions-form"><button mat-button type="button" (click)="edition.set(null)">Annuler</button><button mat-flat-button color="primary" type="submit"><mat-icon>save</mat-icon>Enregistrer</button></div>
        </form>
      }
      <div class="prose">
        <h2 id="description">Description</h2>
        @if (f.description) { <div [innerHTML]="descriptionHtml()"></div> } @else { <p class="muted">Aucune description ni critère d'acceptation.</p> }
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
      <div droite>
        @if (p.peutEcrire()) {
          <span class="text-overline">Actions</span>
          <div class="boutons">
            <button mat-stroked-button (click)="modifier(f)"><mat-icon>edit</mat-icon>Modifier</button>
            @for (s of transitions(f.statut_effectif, f.depots.length > 0); track s.code) { <button mat-button (click)="statut(s.code)"><mat-icon>{{ s.icone }}</mat-icon>{{ s.label }}</button> }
            @if (p.estChef() && f.statut !== 'abandonne' && f.statut !== 'valide') { <button mat-button (click)="abandonner()"><mat-icon>do_not_disturb_on</mat-icon>Abandonner</button> }
            @if (p.estChef() && f.statut === 'abandonne') { <button mat-button (click)="statut('a_faire')"><mat-icon>restart_alt</mat-icon>Reprendre</button> }
            @if (p.estChef()) { <button mat-button color="warn" (click)="supprimer()"><mat-icon>delete</mat-icon>Supprimer</button> }
          </div>
          @if (f.depots.length) { <hr /><span class="text-overline">Avancement par dépôt</span><p class="mini" style="margin: 4px 0 0">Le statut de la fonctionnalité découle de ses dépôts.</p>
            @for (d of f.depots; track d.depot) { <div style="margin-top: 6px"><span class="mini">{{ d.depot }}</span>
              <select class="choix" style="width: 100%" [ngModel]="d.statut" (ngModelChange)="statut($event, d.depot)" [name]="'d' + d.depot">@for (o of oDepot; track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select></div> } }
        }
      </div>
    </app-lecteur>
  } @else { <app-chargement forme="document" /> }`,
})
export class Fonctionnalite {
  private readonly s = inject(Saisie);
  readonly edition = signal<{ titre: string; lot: string; poids: number; description: string } | null>(null);
  readonly oPoids = [1, 2, 3, 5, 8].map((v) => ({ value: v, label: String(v) }));
  readonly oDepot = [['a_faire', 'À faire'], ['en_cours', 'En cours'], ['bloque', 'Bloqué'], ['developpe', 'Développé']].map(([value, label]) => ({ value, label }));
  readonly descriptionHtml = computed(() => marked.parse(this.f()?.description ?? '', { async: false }) as string);
  /** Avec des dépôts, l'avancement se règle par dépôt (le statut effectif en découle) ; seuls recette et validation restent globales. */
  transitions(st: string, parDepot: boolean) {
    const t: { code: string; label: string; icone: string }[] = [];
    if (parDepot) {
      if (st === 'developpe') t.push({ code: 'recette', label: 'Passer en recette', icone: 'fact_check' });
      if (['recette', 'developpe'].includes(st) && this.p.estChef()) t.push({ code: 'valide', label: 'Valider', icone: 'verified' });
      return t;
    }
    if (['a_faire', 'bloque'].includes(st)) t.push({ code: 'en_cours', label: 'Démarrer', icone: 'play_arrow' });
    if (['a_faire', 'en_cours'].includes(st)) t.push({ code: 'bloque', label: 'Signaler un blocage', icone: 'block' });
    if (['en_cours', 'a_faire'].includes(st)) t.push({ code: 'developpe', label: 'Marquer développée', icone: 'code' });
    if (st === 'developpe') t.push({ code: 'recette', label: 'Passer en recette', icone: 'fact_check' });
    if (['recette', 'developpe'].includes(st) && this.p.estChef()) t.push({ code: 'valide', label: 'Valider', icone: 'verified' });
    return t;
  }
  modifier(f: FonctionnaliteDetailDto) { this.edition.set({ titre: f.titre, lot: f.jalon, poids: f.poids, description: f.description }); window.scrollTo({ top: 0 }); }
  recharger() { const c = this.p.code(), r = this.refF(); this.api.invoke(projetsFonctionnalite, { code: c, ref: r }).then((x) => this.f.set(x)); this.api.invoke(projetsFonctionnalites, { code: c }).then((l) => this.liste.set(l)); this.p.rafraichir(); }
  async enregistrer() {
    const e = this.edition()!;
    if (await this.s.faire(() => this.api.invoke(gestionMajFonctionnalite, { code: this.p.code(), ref: this.refF(), body: { titre: e.titre.trim(), lot: e.lot, poids: +e.poids as 1 | 2 | 3 | 5 | 8, description: e.description } }), 'Fonctionnalité mise à jour')) { this.edition.set(null); this.recharger(); }
  }
  private readonly http = inject(Http);
  private readonly router2 = inject(Router);
  async abandonner() {
    const notes = prompt('Motif de l’abandon (conservé dans la fiche)'); if (notes === null) return;
    if (await this.s.faire(() => this.api.invoke(ecritureStatutFonctionnalite, { code: this.p.code(), ref: this.refF(), body: { statut: 'abandonne', notes: notes || undefined } }), 'Fonctionnalité abandonnée')) this.recharger();
  }
  async supprimer() {
    if (await this.s.confirmer(`Supprimer définitivement ${this.refF()} ? Préférez « Abandonner » pour garder la trace dans les indicateurs.`, () => this.http.supprimer(this.p.code(), 'fonctionnalites', this.refF()))) {
      this.p.rafraichir(); this.router2.navigate(['/projets', this.p.code(), 'fonctionnalites']);
    }
  }
  async statut(statut: string, depot?: string) {
    const notes = statut === 'bloque' ? (prompt('Cause du blocage') ?? undefined) : undefined;
    if (await this.s.faire(() => this.api.invoke(ecritureStatutFonctionnalite, { code: this.p.code(), ref: this.refF(), body: { statut, depot, notes } }), 'Statut mis à jour')) this.recharger();
  }
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly ref = inject(ReferentielsService);
  private readonly g = inject(GraphiquesService);
  readonly refF = input.required<string>({ alias: 'ref' });
  readonly f = signal<FonctionnaliteDetailDto | null>(null);
  readonly liste = signal<FonctionnaliteDto[]>([]);
  readonly sommaire = [{ id: 'description', texte: 'Description', niveau: 2 as const }, { id: 'avancement', texte: 'Avancement', niveau: 2 as const }, { id: 'perimetre', texte: 'Périmètre', niveau: 2 as const }, { id: 'recette', texte: 'Recette', niveau: 2 as const },
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
