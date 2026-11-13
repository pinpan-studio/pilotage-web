import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { Api } from '../../api/genere/api';
import { gestionCreerCasTest, gestionResultats, projetsCampagne, projetsCampagnes, projetsCasTest, projetsFonctionnalites, projetsTracabilite } from '../../api/genere/functions';
import { RouterLink } from '@angular/router';
import { CampagneDetailDto, CasTest, FonctionnaliteDto, TracabiliteDto } from '../../api/genere/models';
import { versIso } from '../noyau/dates';
import { PIPES } from '../noyau/pipes';
import { Statut } from '../noyau/statut';
import { Chargement } from '../noyau/chargement';
import { Saisie } from '../noyau/saisie';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { ProjetCourant } from './projet';

type Res = 'ok' | 'ko' | 'reserve' | 'non_teste';

/** Recette : cahier de recette (cas de test par fonctionnalité) et campagnes avec saisie des résultats en grille. */
@Component({
  selector: 'app-recette',
  styles: [`.tuiles-trace { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
    .tuile { display: flex; flex-direction: column; gap: 4px; margin: 0 !important; } .tuile strong { font-size: 26px; }
    .t-non_couvertes, .t-ko { color: var(--mat-sys-error); } .t-recettees { color: #2e7d32; }
    .etat { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
    .e-non_couverte, .e-ko { background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
    .puce { display: inline-flex; align-items: center; gap: 4px; margin: 0 8px 4px 0; white-space: nowrap; }
    .e-recettee { background: color-mix(in srgb, #2e7d32 18%, transparent); } .e-sans_test, .e-en_recette { background: var(--mat-sys-surface-container-high); }`],
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, MatDatepickerModule, Statut, Chargement, SearchableSelectComponent, EmptyStateComponent, ...PIPES],
  template: `
  <div class="tete">
    <div class="m3-filter-toggle" role="tablist" aria-label="Vue">
      <button type="button" role="tab" [class.active]="vue() === 'cahier'" (click)="vue.set('cahier')"><mat-icon>checklist</mat-icon>Cahier de recette</button>
      <button type="button" role="tab" [class.active]="vue() === 'campagnes'" (click)="vue.set('campagnes')"><mat-icon>playlist_add_check</mat-icon>Campagnes</button>
      <button type="button" role="tab" [class.active]="vue() === 'tracabilite'" (click)="vue.set('tracabilite')"><mat-icon>account_tree</mat-icon>Traçabilité</button>
    </div>
    <span class="esp"></span>
    @if (p.peutEcrire() && vue() !== 'tracabilite') {
      @if (vue() === 'cahier') { <button mat-flat-button color="primary" (click)="formCas.set(!formCas())"><mat-icon>add</mat-icon>Nouveau cas de test</button> }
      @else { <button mat-flat-button color="primary" (click)="ouvrirCampagne()" [disabled]="!cas().length"><mat-icon>add</mat-icon>Saisir une campagne</button> }
    }
  </div>

  @if (!charge()) { <app-chargement forme="table" [lignes]="8" /> }
  @else if (vue() === 'tracabilite') {
    @if (trace(); as t) {
      <div class="tuiles-trace">
        @for (k of tuiles; track k.cle) { <div class="card pane tuile"><span class="mini">{{ k.libelle }}</span><strong [class]="'t-' + k.cle">{{ $any(t.synthese)[k.cle] }}</strong></div> }
      </div>
      <section class="card pane"><div class="defile"><table class="tab"><thead><tr><th>Exigence</th><th>Priorité</th><th>Fonctionnalités</th><th>Tests</th><th>Retours</th><th>État</th></tr></thead><tbody>
        @for (e of t.exigences; track e.ref) {
          <tr><td><code>{{ e.ref }}</code> {{ e.titre }}@if (e.section_tdr) { <div class="mini">TDR {{ e.section_tdr.startsWith('§') ? '' : '§ ' }}{{ e.section_tdr }}</div> }</td><td>{{ e.priorite.toUpperCase() }}</td>
            <td>@for (f of e.fonctionnalites; track f.ref) { <div><a [routerLink]="['/projets', p.code(), 'fonctionnalites', f.ref]"><code>{{ f.ref }}</code></a> {{ f.titre }} <app-statut [code]="f.statut" /></div> } @empty { <span class="err-text">Aucune</span> }</td>
            <td>@for (f of e.fonctionnalites; track f.ref) { @for (x of f.tests; track x.ref) { <span class="puce"><code>{{ x.ref }}</code> <app-statut [code]="x.resultat" /></span> } } </td>
            <td>@for (f of e.fonctionnalites; track f.ref) { @for (r of f.retours; track r.ref) { <span class="puce"><code>{{ r.ref }}</code>&nbsp;<span class="mini">{{ r.statut | libelle }}</span></span> } }</td>
            <td><span [class]="'etat e-' + e.etat">{{ etats[e.etat] }}</span></td></tr>
        } @empty { <tr><td colspan="6" class="mini">Aucune exigence saisie (TDR). Le chef de projet peut les ajouter.</td></tr> }
      </tbody></table></div></section>
      @if (t.hors_tdr.length) { <section class="card pane"><h3 style="margin: 0 0 8px">Fonctionnalités sans exigence du TDR</h3>
        @for (f of t.hors_tdr; track f.ref) { <div><a [routerLink]="['/projets', p.code(), 'fonctionnalites', f.ref]"><code>{{ f.ref }}</code></a> {{ f.titre }} <app-statut [code]="f.statut" /> <span class="mini">{{ f.tests.length }} test(s)</span></div> }</section> }
    } @else { <app-chargement forme="table" [lignes]="6" /> }
  }
  @else if (vue() === 'cahier') {
    @if (formCas()) {
      <form class="card pane" (ngSubmit)="creerCas()">
        <div class="grille-form">
          <div><label>Fonctionnalité</label><app-searchable-select name="f" [(ngModel)]="nc.fonctionnalite" [options]="optionsF()" icon="checklist" placeholder="Choisir" /></div>
          <div><label>Titre</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="nc.titre" placeholder="Demande valide enregistrée" /></div></div></div>
          <div class="large"><label>Préconditions</label><div class="form-field"><div class="field-box"><input name="pc" [(ngModel)]="nc.preconditions" placeholder="Utilisateur connecté…" /></div></div></div>
          <div><label>Étapes (une par ligne)</label><div class="form-field"><div class="field-box textarea-box"><textarea name="e" rows="4" [(ngModel)]="nc.etapes"></textarea></div></div></div>
          <div><label>Résultat attendu</label><div class="form-field"><div class="field-box textarea-box"><textarea name="a" rows="4" [(ngModel)]="nc.attendu"></textarea></div></div></div>
        </div>
        <div class="actions-form"><button mat-button type="button" (click)="formCas.set(false)">Annuler</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="nc.titre.trim().length < 2 || enCours()"><mat-icon>save</mat-icon>Créer</button></div>
      </form>
    }
    @for (g of groupes(); track g.ref) {
      <section class="card pane">
        <h3 style="margin: 0 0 8px">{{ g.ref }} — {{ g.titre }} <app-statut [code]="g.statut" /></h3>
        <div class="defile"><table class="tab"><thead><tr><th>Cas</th><th>Titre</th><th>Étapes</th><th>Attendu</th><th>Dernier résultat</th></tr></thead><tbody>
          @for (c of g.cas; track c.id) {
            <tr><td><code>{{ c.ref }}</code></td><td>{{ c.titre }}@if (c.preconditions) { <div class="mini">{{ c.preconditions }}</div> }</td>
              <td><ol style="margin: 0; padding-left: 18px">@for (e of c.etapes; track $index) { <li>{{ e }}</li> }</ol></td><td>{{ c.attendu }}</td>
              <td>@if (dernier(c.ref); as d) { <app-statut [code]="d.resultat" /> <span class="mini">{{ d.campagne }}</span> } @else { <app-statut code="non_teste" /> }</td></tr>
          }</tbody></table></div>
      </section>
    } @empty { <app-empty-state icon="fact_check" title="Cahier de recette vide" subtitle="Ajoutez des cas de test, ou demandez à l'agent : /recette cas" /> }
  } @else {
    @if (grille(); as gr) {
      <form class="card pane" (ngSubmit)="enregistrer()">
        <div class="grille-form">
          <div><label>Référence</label><div class="form-field"><div class="field-box"><input name="r" [(ngModel)]="gr.ref" /></div></div></div>
          <div><label>Titre</label><div class="form-field"><div class="field-box"><input name="ti" [(ngModel)]="gr.titre" placeholder="Recette interne Lot 1" /></div></div></div>
          <div><label>Type</label><app-searchable-select name="ty" [(ngModel)]="gr.type" [options]="optionsType" icon="groups" /></div>
          <div><label>Date</label><div class="form-field"><div class="field-box"><input name="d" [matDatepicker]="dp" [(ngModel)]="gr.date" placeholder="jj/mm/aaaa" /><mat-datepicker-toggle [for]="dp" /><mat-datepicker #dp /></div></div></div>
          <div class="large"><label>Environnement</label><div class="form-field"><div class="field-box"><input name="env" [(ngModel)]="gr.environnement" placeholder="recette, préproduction…" /></div></div></div>
        </div>
        <div class="defile" style="margin-top: 12px"><table class="tab"><thead><tr><th>Cas</th><th>Titre</th><th>Résultat</th><th>Commentaire</th></tr></thead><tbody>
          @for (l of gr.lignes; track l.ref) {
            <tr><td><code>{{ l.ref }}</code></td><td>{{ l.titre }}</td>
              <td><select class="choix" [name]="'r' + l.ref" [(ngModel)]="l.resultat">@for (o of optionsRes; track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select></td>
              <td><input class="choix" style="width: 100%" [name]="'c' + l.ref" [(ngModel)]="l.commentaire" /></td></tr>
          }</tbody></table></div>
        <div class="actions-form"><span class="mini" style="margin-right: auto">Tout mettre à :
          @for (o of optionsRes; track o.value) { <button mat-button type="button" (click)="toutA(o.value)">{{ o.label }}</button> }</span>
          <button mat-button type="button" (click)="grille.set(null)">Annuler</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="enCours() || !gr.ref.trim()"><mat-icon>save</mat-icon>Enregistrer les résultats</button></div>
      </form>
    }
    @for (c of campagnes(); track c.id) {
      <section class="card pane">
        <h3 style="margin: 0 0 4px">{{ c.ref }} — {{ c.titre }} <span class="mini">{{ c.type === 'client' ? 'Recette client' : 'Recette interne' }} · {{ c.date | dateFr }}{{ c.environnement ? ' · ' + c.environnement : '' }}</span></h3>
        <p class="mini" style="margin: 0 0 8px">{{ bilan(c) }}</p>
        <div class="defile"><table class="tab"><thead><tr><th>Cas</th><th>Résultat</th><th>Commentaire</th></tr></thead><tbody>
          @for (r of c.resultats; track r.test) { <tr><td><code>{{ r.test }}</code> {{ titreCas(r.test) }}</td><td><app-statut [code]="r.resultat" /></td><td>{{ r.commentaire }}</td></tr> }
        </tbody></table></div>
        @if (p.peutEcrire()) { <div class="actions-form"><button mat-stroked-button (click)="reprendre(c)"><mat-icon>edit</mat-icon>Compléter / corriger</button></div> }
      </section>
    } @empty { <app-empty-state icon="playlist_add_check" title="Aucune campagne" subtitle="Saisissez les résultats d'une première campagne de recette." /> }
  }`,
})
export class Recette {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly s = inject(Saisie);
  readonly vue = signal<'cahier' | 'campagnes' | 'tracabilite'>('cahier');
  readonly trace = signal<TracabiliteDto | null>(null);
  readonly tuiles = [{ cle: 'total', libelle: 'Exigences' }, { cle: 'recettees', libelle: 'Recettées' }, { cle: 'en_recette', libelle: 'En recette' }, { cle: 'ko', libelle: 'Tests KO' },
    { cle: 'sans_test', libelle: 'Sans test' }, { cle: 'non_couvertes', libelle: 'Non couvertes' }];
  readonly etats: Record<string, string> = { non_couverte: 'Non couverte', sans_test: 'Sans test', en_recette: 'En recette', ko: 'KO', recettee: 'Recettée' };
  readonly charge = signal(false);
  readonly enCours = signal(false);
  readonly cas = signal<CasTest[]>([]);
  readonly foncs = signal<FonctionnaliteDto[]>([]);
  readonly campagnes = signal<CampagneDetailDto[]>([]);
  readonly formCas = signal(false);
  nc = { fonctionnalite: '', titre: '', preconditions: '', etapes: '', attendu: '' };
  readonly grille = signal<{ ref: string; titre: string; type: 'interne' | 'client'; date: Date | null; environnement: string; lignes: { ref: string; titre: string; resultat: Res; commentaire: string }[] } | null>(null);
  readonly optionsType = [{ value: 'interne', label: 'Recette interne', icon: 'engineering' }, { value: 'client', label: 'Recette client', icon: 'handshake' }];
  readonly optionsRes: { value: Res; label: string }[] = [{ value: 'ok', label: 'OK' }, { value: 'ko', label: 'KO' }, { value: 'reserve', label: 'Réserve' }, { value: 'non_teste', label: 'Non testé' }];
  readonly optionsF = computed(() => this.foncs().map((f) => ({ value: f.ref, label: `${f.ref} — ${f.titre}`, description: f.jalon, icon: 'checklist' })));
  readonly groupes = computed(() => {
    const parId = new Map(this.foncs().map((f) => [f.id, f]));
    const g = new Map<string, { ref: string; titre: string; statut: string; cas: CasTest[] }>();
    for (const c of this.cas()) {
      const f = c.fonctionnalite_id ? parId.get(c.fonctionnalite_id) : undefined;
      const k = f?.ref ?? '—';
      if (!g.has(k)) g.set(k, { ref: k, titre: f?.titre ?? 'Sans fonctionnalité', statut: f?.statut_effectif ?? 'a_faire', cas: [] });
      g.get(k)!.cas.push(c);
    }
    return [...g.values()].sort((a, b) => a.ref.localeCompare(b.ref, 'fr', { numeric: true }));
  });
  /** Dernier résultat de chaque cas (campagnes triées par date). */
  readonly derniers = computed(() => {
    const m = new Map<string, { resultat: string; campagne: string }>();
    for (const c of [...this.campagnes()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.ref.localeCompare(b.ref, 'fr', { numeric: true })))
      for (const r of c.resultats) m.set(r.test, { resultat: r.resultat, campagne: c.ref });
    return m;
  });
  dernier = (ref: string) => this.derniers().get(ref);
  titreCas = (ref: string) => this.cas().find((c) => c.ref === ref)?.titre ?? '';
  bilan(c: CampagneDetailDto) {
    const n = (r: string) => c.resultats.filter((x) => x.resultat === r).length;
    return `${n('ok')} OK · ${n('ko')} KO · ${n('reserve')} réserve(s) · ${n('non_teste')} non testé(s) — ${c.resultats.length} cas`;
  }

  constructor() { effect(() => { if (this.p.code()) this.charger(); }); }
  async charger() {
    const code = this.p.code();
    const [cas, foncs, camps] = await Promise.all([this.api.invoke(projetsCasTest, { code }), this.api.invoke(projetsFonctionnalites, { code }), this.api.invoke(projetsCampagnes, { code })]);
    this.cas.set(cas); this.foncs.set(foncs);
    this.api.invoke(projetsTracabilite, { code }).then((t) => this.trace.set(t)).catch(() => undefined);
    this.campagnes.set(await Promise.all(camps.map((c) => this.api.invoke(projetsCampagne, { code, ref: c.ref }))));
    this.charge.set(true);
  }
  async creerCas() {
    this.enCours.set(true);
    const r = await this.s.faire(() => this.api.invoke(gestionCreerCasTest, { code: this.p.code(), body: { titre: this.nc.titre.trim(), fonctionnalite: this.nc.fonctionnalite || undefined,
      preconditions: this.nc.preconditions, attendu: this.nc.attendu, etapes: this.nc.etapes.split('\n').map((x) => x.trim()).filter(Boolean) } }), 'Cas de test créé');
    this.enCours.set(false);
    if (r) { this.nc = { fonctionnalite: this.nc.fonctionnalite, titre: '', preconditions: '', etapes: '', attendu: '' }; await this.charger(); }
  }
  private prochaineRef() { const n = Math.max(0, ...this.campagnes().map((c) => Number(c.ref.replace(/\D/g, '')) || 0)); return `R${n + 1}`; }
  ouvrirCampagne() {
    this.grille.set({ ref: this.prochaineRef(), titre: '', type: 'interne', date: new Date(), environnement: '',
      lignes: this.cas().map((c) => ({ ref: c.ref, titre: c.titre, resultat: 'non_teste' as Res, commentaire: '' })) });
    window.scrollTo({ top: 0 });
  }
  reprendre(c: CampagneDetailDto) {
    const parRef = new Map(c.resultats.map((r) => [r.test, r]));
    this.grille.set({ ref: c.ref, titre: c.titre, type: c.type, date: c.date ? new Date(c.date) : null, environnement: c.environnement,
      lignes: this.cas().map((x) => ({ ref: x.ref, titre: x.titre, resultat: (parRef.get(x.ref)?.resultat ?? 'non_teste') as Res, commentaire: parRef.get(x.ref)?.commentaire ?? '' })) });
    window.scrollTo({ top: 0 });
  }
  toutA(v: Res) { const g = this.grille(); if (g) { g.lignes.forEach((l) => (l.resultat = v)); this.grille.set({ ...g }); } }
  async enregistrer() {
    const g = this.grille()!; this.enCours.set(true);
    const r = await this.s.faire(() => this.api.invoke(gestionResultats, { code: this.p.code(), ref: g.ref.trim(), body: { titre: g.titre || undefined, type: g.type,
      date: versIso(g.date) ?? undefined, environnement: g.environnement, resultats: g.lignes.map((l) => ({ cas_test: l.ref, resultat: l.resultat, commentaire: l.commentaire || undefined })) } }), 'Résultats enregistrés');
    this.enCours.set(false);
    if (r) { this.grille.set(null); await this.charger(); this.p.rafraichir(); }
  }
}
