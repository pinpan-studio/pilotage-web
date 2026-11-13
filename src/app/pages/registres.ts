import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { Api } from '../../api/genere/api';
import {
  gestionCompteRendu, gestionCreerJalon, gestionCreerRetour, gestionCreerRisque, gestionDecider, gestionMajJalon, gestionMajRetour, gestionMajRisque, gestionProposerChangement,
  projetsChangements, projetsFonctionnalites, projetsJalons, projetsRetours, projetsReunions, projetsRisques,
} from '../../api/genere/functions';
import { Changement, FonctionnaliteDto, Jalon, RetourClient, Reunion, Risque } from '../../api/genere/models';
import { versIso } from '../noyau/dates';
import { PIPES } from '../noyau/pipes';
import { Statut } from '../noyau/statut';
import { Chargement } from '../noyau/chargement';
import { Saisie } from '../noyau/saisie';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { ProjetCourant } from './projet';

type Vue = 'retours' | 'risques' | 'changements' | 'reunions' | 'jalons';
const opts = (l: [string, string][], icon?: string) => l.map(([value, label]) => ({ value, label, icon }));

/** Registres de gestion : retours clients, risques, demandes de changement, comptes rendus, jalons — saisie et suivi. */
@Component({
  selector: 'app-registres',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatDatepickerModule, Statut, Chargement, SearchableSelectComponent, EmptyStateComponent, ...PIPES],
  styles: [`.crit { display: inline-block; min-width: 28px; text-align: center; border-radius: 999px; padding: 1px 8px; font-weight: 600; font-size: 12px; }
    .crit.h { background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); } .crit.m { background: var(--mat-sys-tertiary-container); color: var(--mat-sys-on-tertiary-container); }
    .crit.b { background: var(--mat-sys-surface-container-high); } .prose-cr { white-space: pre-wrap; font-size: 13px; margin: 8px 0 0; }`],
  template: `
  <div class="tete">
    <div class="m3-filter-toggle" role="tablist" aria-label="Registre">
      @for (o of vues; track o.id) { <button type="button" role="tab" [class.active]="vue() === o.id" (click)="changer(o.id)"><mat-icon>{{ o.icone }}</mat-icon>{{ o.nom }}<span class="mini">&nbsp;{{ compte(o.id) }}</span></button> }
    </div>
    <span class="esp"></span>
    @if (p.peutEcrire() || vue() === 'retours') { <button mat-flat-button color="primary" (click)="form.set(!form())"><mat-icon>add</mat-icon>{{ p.peutEcrire() ? libelleAjout() : 'Signaler un retour' }}</button> }
  </div>

  @if (form()) {
    <form class="card pane" (ngSubmit)="creer()">
      @switch (vue()) {
        @case ('retours') { <div class="grille-form">
          <div class="large"><label>Retour du client</label><div class="form-field"><div class="field-box textarea-box"><textarea name="m" rows="3" [(ngModel)]="n.retour_md"></textarea></div></div></div>
          <div><label>Type</label><app-searchable-select name="t" [(ngModel)]="n.type" [options]="oTypeRetour" /></div>
          <div><label>Priorité</label><app-searchable-select name="p" [(ngModel)]="n.priorite" [options]="oPrio" /></div>
          <div><label>Source</label><div class="form-field"><div class="field-box"><input name="s" [(ngModel)]="n.source" placeholder="réunion, e-mail, recette…" /></div></div></div>
          <div><label>Contact client</label><div class="form-field"><div class="field-box"><input name="c" [(ngModel)]="n.contact_client" /></div></div></div>
          <div class="large"><label>Fonctionnalité concernée</label><app-searchable-select name="f" [(ngModel)]="n.fonctionnalite" [options]="oFoncs()" icon="checklist" placeholder="Aucune" /></div></div> }
        @case ('risques') { <div class="grille-form">
          <div class="large"><label>Risque</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="n.titre" /></div></div></div>
          <div><label>Probabilité (1 à 4)</label><app-searchable-select name="pr" [(ngModel)]="n.probabilite" [options]="o14" /></div>
          <div><label>Impact (1 à 4)</label><app-searchable-select name="im" [(ngModel)]="n.impact" [options]="o14" /></div>
          <div><label>Catégorie</label><div class="form-field"><div class="field-box"><input name="ca" [(ngModel)]="n.categorie" placeholder="technique, client, planning…" /></div></div></div>
          <div><label>Responsable</label><div class="form-field"><div class="field-box"><input name="re" [(ngModel)]="n.responsable" /></div></div></div>
          <div class="large"><label>Parade</label><div class="form-field"><div class="field-box textarea-box"><textarea name="pa" rows="2" [(ngModel)]="n.parade"></textarea></div></div></div></div> }
        @case ('changements') { <div class="grille-form">
          <div class="large"><label>Demande</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="n.titre" /></div></div></div>
          <div class="large"><label>Description</label><div class="form-field"><div class="field-box textarea-box"><textarea name="d" rows="3" [(ngModel)]="n.description"></textarea></div></div></div>
          <div><label>Demandeur</label><div class="form-field"><div class="field-box"><input name="de" [(ngModel)]="n.demandeur" /></div></div></div>
          <div><label>Impact délai (jours)</label><div class="form-field"><div class="field-box"><input name="j" type="number" [(ngModel)]="n.impact_delai_jours" /></div></div></div>
          <div><label>Impact coût</label><div class="form-field"><div class="field-box"><input name="co" [(ngModel)]="n.impact_cout" /></div></div></div>
          <div><label>Fonctionnalité concernée</label><app-searchable-select name="f" [(ngModel)]="n.fonctionnalite" [options]="oFoncs()" icon="checklist" placeholder="Aucune" /></div></div> }
        @case ('reunions') { <div class="grille-form">
          <div><label>Date</label><div class="form-field"><div class="field-box"><input name="d" [matDatepicker]="dp" [(ngModel)]="n.date" placeholder="jj/mm/aaaa" /><mat-datepicker-toggle [for]="dp" /><mat-datepicker #dp /></div></div></div>
          <div><label>Type</label><app-searchable-select name="ty" [(ngModel)]="n.type" [options]="oTypeReunion" /></div>
          <div class="large"><label>Titre</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="n.titre" placeholder="Comité de pilotage n°2" /></div></div></div>
          <div class="large"><label>Participants (séparés par des virgules)</label><div class="form-field"><div class="field-box"><input name="pa" [(ngModel)]="n.participants" /></div></div></div>
          <div class="large"><label>Compte rendu</label><div class="form-field"><div class="field-box textarea-box"><textarea name="c" rows="5" [(ngModel)]="n.contenu_md" placeholder="Points abordés…"></textarea></div></div></div>
          <div><label>Décisions (une par ligne)</label><div class="form-field"><div class="field-box textarea-box"><textarea name="de" rows="3" [(ngModel)]="n.decisions"></textarea></div></div></div>
          <div><label>Actions (une par ligne : action ; responsable ; AAAA-MM-JJ)</label><div class="form-field"><div class="field-box textarea-box"><textarea name="ac" rows="3" [(ngModel)]="n.actions"></textarea></div></div></div>
          <div class="large mini">Les actions sont ajoutées au plan d'actions (onglet Tâches) dans la même opération.</div></div> }
        @case ('jalons') { <div class="grille-form">
          <div><label>Jalon</label><div class="form-field"><div class="field-box"><input name="no" [(ngModel)]="n.nom" placeholder="Recette du Lot 1" /></div></div></div>
          <div><label>Date prévue</label><div class="form-field"><div class="field-box"><input name="d" [matDatepicker]="dpj" [(ngModel)]="n.date" placeholder="jj/mm/aaaa" /><mat-datepicker-toggle [for]="dpj" /><mat-datepicker #dpj /></div></div></div>
          <div><label>Lot</label><div class="form-field"><div class="field-box"><input name="l" [(ngModel)]="n.lot" /></div></div></div>
          <div><label>Facturation</label><div class="form-field"><div class="field-box"><input name="fa" [(ngModel)]="n.facturation" placeholder="30 %" /></div></div></div>
          <div class="large"><label>Documents attendus (codes séparés par des virgules)</label><div class="form-field"><div class="field-box"><input name="do" [(ngModel)]="n.documents" placeholder="PV-RECETTE, CAHIER-RECETTE" /></div></div></div></div> }
      }
      <div class="actions-form"><button mat-button type="button" (click)="form.set(false)">Annuler</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="enCours() || !valide()"><mat-icon>save</mat-icon>Enregistrer</button></div>
    </form>
  }

  @if (!charge()) { <app-chargement forme="table" [lignes]="8" /> }
  @else {
    <section class="card pane"><div class="defile">
    @switch (vue()) {
      @case ('retours') {
        @if (retours().length) { <table class="tab"><thead><tr><th>Réf.</th><th>Retour</th><th>Type</th><th>Priorité</th><th>Date</th><th>Statut</th></tr></thead><tbody>
          @for (r of retours(); track r.id) { <tr><td><code>{{ r.ref }}</code></td><td>{{ (r.retour || r.contenu).slice(0, 220) }}@if (r.action) { <div class="mini">→ {{ r.action }}</div> }</td>
            <td>{{ r.type | libelle }}</td><td>{{ r.priorite | libelle }}</td><td>{{ r.date | dateFr }}</td>
            <td>@if (p.peutEcrire()) { <select class="choix" [ngModel]="r.statut" (ngModelChange)="majRetour(r, $event)" [name]="'s' + r.ref">@for (o of oStatutRetour; track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select> } @else { <app-statut [code]="r.statut" /> }</td></tr> }
        </tbody></table> } @else { <app-empty-state icon="forum" title="Aucun retour client" /> } }
      @case ('risques') {
        @if (risques().length) { <table class="tab"><thead><tr><th>Réf.</th><th>Risque</th><th>P × I</th><th>Parade</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>
          @for (r of risques(); track r.id) { <tr><td><code>{{ r.ref }}</code></td><td>{{ r.titre }}<div class="mini">{{ r.categorie }}</div></td>
            <td><span class="crit" [class.h]="r.probabilite * r.impact >= 9" [class.m]="r.probabilite * r.impact >= 4 && r.probabilite * r.impact < 9" [class.b]="r.probabilite * r.impact < 4">{{ r.probabilite * r.impact }}</span> <span class="mini">{{ r.probabilite }}×{{ r.impact }}</span></td>
            <td>{{ r.parade }}</td><td>{{ r.responsable }}</td>
            <td>@if (p.peutEcrire()) { <select class="choix" [ngModel]="r.statut" (ngModelChange)="majRisque(r, $event)" [name]="'s' + r.ref">@for (o of oStatutRisque; track o.value) { <option [value]="o.value">{{ o.label }}</option> }</select> } @else { <app-statut [code]="r.statut" /> }</td></tr> }
        </tbody></table> } @else { <app-empty-state icon="warning" title="Aucun risque" /> } }
      @case ('changements') {
        @if (changements().length) { <table class="tab"><thead><tr><th>Réf.</th><th>Demande</th><th>Impact</th><th>Décision</th><th></th></tr></thead><tbody>
          @for (c of changements(); track c.id) { <tr><td><code>{{ c.ref }}</code></td><td>{{ c.titre }}<div class="mini">{{ c.description }}{{ c.demandeur ? ' — ' + c.demandeur : '' }}</div></td>
            <td class="mini">{{ c.impact_delai_jours ? c.impact_delai_jours + ' j' : '' }} {{ c.impact_cout }}</td>
            <td><app-statut [code]="c.decision" />@if (c.date_decision) { <div class="mini">le {{ c.date_decision | dateFr }}{{ c.avenant ? ' · ' + c.avenant : '' }}</div> }</td>
            <td style="white-space: nowrap">@if (p.estChef() && c.decision === 'en_analyse') {
              <button mat-stroked-button (click)="decider(c, 'accepte')"><mat-icon>check</mat-icon>Accepter</button>
              <button mat-button (click)="decider(c, 'reporte')">Reporter</button>
              <button mat-button color="warn" (click)="decider(c, 'refuse')">Refuser</button> }</td></tr> }
        </tbody></table> @if (!p.estChef()) { <p class="mini">Seul un chef de projet peut décider d'une demande de changement.</p> } } @else { <app-empty-state icon="change_circle" title="Aucune demande de changement" /> } }
      @case ('reunions') {
        @for (r of reunions(); track r.id) { <article style="padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant)">
          <strong>{{ r.date | dateFr }} — {{ r.titre || (r.type | libelle) }}</strong> <span class="mini">{{ r.participants.join(', ') }}</span>
          <p class="prose-cr">{{ r.contenu }}</p></article> } @empty { <app-empty-state icon="groups" title="Aucun compte rendu" /> } }
      @case ('jalons') {
        @if (jalons().length) { <table class="tab"><thead><tr><th>Réf.</th><th>Jalon</th><th>Lot</th><th>Prévu</th><th>Atteint</th><th>Facturation</th></tr></thead><tbody>
          @for (j of jalons(); track j.id) { <tr><td><code>{{ j.ref }}</code></td><td>{{ j.nom }}</td><td>{{ j.lot }}</td><td>{{ j.date_prevue | dateFr }}</td>
            <td>@if (j.date_reelle) { {{ j.date_reelle | dateFr }} } @else if (p.peutEcrire()) { <button mat-stroked-button (click)="atteint(j)"><mat-icon>flag</mat-icon>Marquer atteint</button> } @else { — }</td><td>{{ j.facturation }}</td></tr> }
        </tbody></table> } @else { <app-empty-state icon="flag" title="Aucun jalon" subtitle="Ajoutez les jalons du planning pour suivre les échéances." /> } }
    }
    </div></section>
  }`,
})
export class Registres {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly s = inject(Saisie);
  readonly vues: { id: Vue; nom: string; icone: string }[] = [{ id: 'retours', nom: 'Retours clients', icone: 'forum' }, { id: 'risques', nom: 'Risques', icone: 'warning' },
    { id: 'changements', nom: 'Changements', icone: 'change_circle' }, { id: 'reunions', nom: 'Réunions', icone: 'groups' }, { id: 'jalons', nom: 'Jalons', icone: 'flag' }];
  readonly vue = signal<Vue>('retours');
  readonly form = signal(false);
  readonly charge = signal(false);
  readonly enCours = signal(false);
  readonly retours = signal<RetourClient[]>([]);
  readonly risques = signal<Risque[]>([]);
  readonly changements = signal<Changement[]>([]);
  readonly reunions = signal<Reunion[]>([]);
  readonly jalons = signal<Jalon[]>([]);
  readonly foncs = signal<FonctionnaliteDto[]>([]);
  n: any = this.vierge();
  readonly oFoncs = computed(() => this.foncs().map((f) => ({ value: f.ref, label: `${f.ref} — ${f.titre}`, icon: 'checklist' })));
  readonly oTypeRetour = opts([['bug', 'Bug'], ['evolution', 'Évolution'], ['question', 'Question'], ['remarque', 'Remarque']]);
  readonly oPrio = opts([['haute', 'Haute'], ['moyenne', 'Moyenne'], ['basse', 'Basse']]);
  readonly o14 = [1, 2, 3, 4].map((v) => ({ value: v, label: String(v) }));
  readonly oTypeReunion = opts([['comite', 'Comité de pilotage'], ['atelier', 'Atelier'], ['point', 'Point d’avancement'], ['recette', 'Recette'], ['autre', 'Autre']]);
  readonly oStatutRetour = opts([['nouveau', 'Nouveau'], ['en_cours', 'En cours'], ['resolu', 'Résolu'], ['rejete', 'Rejeté']]);
  readonly oStatutRisque = opts([['ouvert', 'Ouvert'], ['surveille', 'Surveillé'], ['survenu', 'Survenu'], ['clos', 'Clos']]);
  readonly libelleAjout = computed(() => ({ retours: 'Nouveau retour', risques: 'Nouveau risque', changements: 'Nouvelle demande', reunions: 'Nouveau compte rendu', jalons: 'Nouveau jalon' })[this.vue()]);

  constructor() { effect(() => { if (this.p.code()) this.charger(); }); }
  private vierge() { return { type: 'remarque', priorite: 'moyenne', probabilite: 2, impact: 2, date: new Date(), participants: '', decisions: '', actions: '', documents: '' } as any; }
  changer(v: Vue) { this.vue.set(v); this.form.set(false); this.n = this.vierge(); if (v === 'reunions') this.n.type = 'comite'; }
  compte(v: Vue) { return { retours: this.retours, risques: this.risques, changements: this.changements, reunions: this.reunions, jalons: this.jalons }[v]().length; }
  async charger() {
    const code = this.p.code();
    const [r, q, c, m, j, f] = await Promise.all([projetsRetours, projetsRisques, projetsChangements, projetsReunions, projetsJalons, projetsFonctionnalites].map((fn: any) => this.api.invoke(fn, { code }) as Promise<any>));
    this.retours.set([...r].sort((a: any, b: any) => b.ref.localeCompare(a.ref, 'fr', { numeric: true }))); this.risques.set(q); this.changements.set(c);
    this.reunions.set([...m].sort((a: any, b: any) => (b.date ?? '').localeCompare(a.date ?? ''))); this.jalons.set(j); this.foncs.set(f); this.charge.set(true);
  }
  valide() {
    const n = this.n;
    return ({ retours: (n.retour_md ?? '').trim().length > 1, risques: (n.titre ?? '').trim().length > 1, changements: (n.titre ?? '').trim().length > 1,
      reunions: !!n.date && (n.contenu_md ?? '').trim().length > 0, jalons: (n.nom ?? '').trim().length > 1 })[this.vue()];
  }
  private liste = (s: string) => (s ?? '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  async creer() {
    const code = this.p.code(), n = this.n; this.enCours.set(true);
    const f = n.fonctionnalite ? [n.fonctionnalite] : undefined;
    const appel = ({
      retours: () => this.api.invoke(gestionCreerRetour, { code, body: { retour_md: n.retour_md.trim(), type: n.type, priorite: n.priorite, source: n.source, contact_client: n.contact_client, fonctionnalites: f } }),
      risques: () => this.api.invoke(gestionCreerRisque, { code, body: { titre: n.titre.trim(), probabilite: +n.probabilite, impact: +n.impact, categorie: n.categorie, parade: n.parade, responsable: n.responsable } }),
      changements: () => this.api.invoke(gestionProposerChangement, { code, body: { titre: n.titre.trim(), description: n.description, demandeur: n.demandeur, impact_delai_jours: n.impact_delai_jours ? +n.impact_delai_jours : undefined, impact_cout: n.impact_cout, fonctionnalites: f } }),
      reunions: () => this.api.invoke(gestionCompteRendu, { code, body: { date: versIso(n.date)!, type: n.type, titre: n.titre, participants: this.liste(n.participants), contenu_md: n.contenu_md,
        decisions: (n.decisions ?? '').split('\n').map((x: string) => x.trim()).filter(Boolean),
        actions: (n.actions ?? '').split('\n').map((x: string) => x.trim()).filter(Boolean).map((l: string) => { const [action, responsable, echeance] = l.split(';').map((x) => x.trim()); return { action, responsable: responsable || undefined, echeance: /^\d{4}-\d{2}-\d{2}$/.test(echeance ?? '') ? echeance : undefined }; }) } }),
      jalons: () => this.api.invoke(gestionCreerJalon, { code, body: { nom: n.nom.trim(), date_prevue: versIso(n.date) ?? undefined, lot: n.lot, facturation: n.facturation, documents: this.liste(n.documents) } }),
    } as Record<Vue, () => Promise<unknown>>)[this.vue()];
    const r = await this.s.faire(appel, 'Enregistré');
    this.enCours.set(false);
    if (r) { this.form.set(false); this.n = this.vierge(); await this.charger(); this.p.rafraichir(); }
  }
  async majRetour(r: RetourClient, statut: string) {
    if (await this.s.faire(() => this.api.invoke(gestionMajRetour, { code: this.p.code(), ref: r.ref, body: { statut: statut as any } }), `${r.ref} : statut mis à jour`)) { await this.charger(); this.p.rafraichir(); }
  }
  async majRisque(r: Risque, statut: string) {
    if (await this.s.faire(() => this.api.invoke(gestionMajRisque, { code: this.p.code(), ref: r.ref, body: { statut: statut as any } }), `${r.ref} : statut mis à jour`)) { await this.charger(); this.p.rafraichir(); }
  }
  async decider(c: Changement, decision: 'accepte' | 'refuse' | 'reporte') {
    const avenant = decision === 'accepte' ? (prompt('Référence de l’avenant (facultatif)') ?? '') : '';
    if (await this.s.faire(() => this.api.invoke(gestionDecider, { code: this.p.code(), ref: c.ref, body: { decision, avenant: avenant || undefined } }), `${c.ref} : décision enregistrée`)) { await this.charger(); this.p.rafraichir(); }
  }
  async atteint(j: Jalon) {
    if (await this.s.faire(() => this.api.invoke(gestionMajJalon, { code: this.p.code(), ref: j.ref, body: { date_reelle: new Date().toISOString().slice(0, 10) } }), `${j.ref} atteint`)) { await this.charger(); this.p.rafraichir(); }
  }
}
