import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { marked } from 'marked';
import { Api } from '../../api/genere/api';
import { gestionCreerExigence, gestionEcrireTdr, gestionMajExigence, gestionRevision, projetsExigences, projetsTdr } from '../../api/genere/functions';
import { Exigence } from '../../api/genere/models';
import { Chargement } from '../noyau/chargement';
import { Http } from '../noyau/http';
import { Saisie } from '../noyau/saisie';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { ProjetCourant } from './projet';

/** Cadrage : texte du TDR (Markdown), révision de périmètre, exigences. */
@Component({
  selector: 'app-cadrage',
  imports: [FormsModule, MatButtonModule, MatIconModule, Chargement, SearchableSelectComponent, EmptyStateComponent],
  styles: [`.editeur { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); } .editeur textarea { font: 13px/1.5 ui-monospace, monospace; min-height: 460px; }
    .apercu { border: 1px solid var(--mat-sys-outline-variant); border-radius: 12px; padding: var(--space-3); overflow: auto; max-height: 560px; }
    .revision { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; margin-bottom: var(--space-4); background: var(--mat-sys-surface-container); }
    .revision.on { background: var(--mat-sys-tertiary-container); color: var(--mat-sys-on-tertiary-container); }
    .prio { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--mat-sys-surface-container-high); }
    .prio.must { background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
    @media (max-width: 900px) { .editeur { grid-template-columns: 1fr; } }`],
  template: `
  <div class="tete">
    <div class="m3-filter-toggle" role="tablist" aria-label="Cadrage">
      <button type="button" role="tab" [class.active]="vue() === 'tdr'" (click)="vue.set('tdr')"><mat-icon>article</mat-icon>TDR</button>
      <button type="button" role="tab" [class.active]="vue() === 'exigences'" (click)="vue.set('exigences')"><mat-icon>rule</mat-icon>Exigences<span class="mini">&nbsp;{{ exigences().length }}</span></button>
    </div>
    <span class="esp"></span>
    @if (vue() === 'tdr' && peutCadrer() && edition() === null) { <button mat-flat-button color="primary" (click)="editer()"><mat-icon>edit_note</mat-icon>Modifier le TDR</button> }
    @if (vue() === 'exigences' && peutCadrer()) { <button mat-flat-button color="primary" (click)="ouvrirExigence(null)"><mat-icon>add</mat-icon>Nouvelle exigence</button> }
  </div>
  <div class="revision" [class.on]="p.detail()?.revision_perimetre">
    <mat-icon>{{ p.detail()?.revision_perimetre ? 'lock_open' : 'lock' }}</mat-icon>
    <div style="flex: 1"><strong>{{ p.detail()?.revision_perimetre ? 'Révision de périmètre ouverte' : 'Périmètre figé' }}</strong>
      <div class="mini">{{ p.detail()?.revision_perimetre ? 'L’agent peut proposer des modifications du TDR et des exigences jusqu’à la fermeture.' : 'Seul le chef de projet modifie le TDR et les exigences.' }}</div></div>
    @if (p.estChef()) { <button mat-stroked-button (click)="basculerRevision()">{{ p.detail()?.revision_perimetre ? 'Fermer la révision' : 'Ouvrir une révision' }}</button> }
  </div>

  @if (!charge()) { <app-chargement forme="document" /> }
  @else if (vue() === 'tdr') {
    @if (edition() !== null) {
      <section class="card pane">
        <div class="editeur">
          <div class="form-field"><div class="field-box textarea-box"><textarea [(ngModel)]="texte" (ngModelChange)="edition.set($event)" name="tdr"></textarea></div></div>
          <div class="apercu prose" [innerHTML]="apercu()"></div>
        </div>
        <div class="actions-form"><button mat-button (click)="edition.set(null)">Annuler</button><button mat-flat-button color="primary" (click)="enregistrerTdr()"><mat-icon>save</mat-icon>Enregistrer</button></div>
      </section>
    } @else if (tdr()) { <section class="card pane prose" [innerHTML]="rendu()"></section> }
    @else { <app-empty-state icon="article" title="TDR non saisi" subtitle="Collez ici le cahier des charges du client (Markdown) ; le scan signé se dépose dans Livrables → TDR." /> }
  } @else {
    @if (formE(); as e) {
      <form class="card pane" (ngSubmit)="enregistrerExigence()">
        <div class="grille-form">
          <div class="large"><label>Exigence</label><div class="form-field"><div class="field-box"><input name="t" [(ngModel)]="e.titre" /></div></div></div>
          <div><label>Priorité</label><app-searchable-select name="p" [(ngModel)]="e.priorite" [options]="oPrio" /></div>
          <div><label>Section du TDR</label><div class="form-field"><div class="field-box"><input name="s" [(ngModel)]="e.section_tdr" placeholder="§3.2" /></div></div></div>
          <div class="large"><label>Description</label><div class="form-field"><div class="field-box textarea-box"><textarea name="d" rows="3" [(ngModel)]="e.description"></textarea></div></div></div>
        </div>
        <div class="actions-form"><button mat-button type="button" (click)="formE.set(null)">Annuler</button><button mat-flat-button color="primary" type="submit" [disabled]="e.titre.trim().length < 2"><mat-icon>save</mat-icon>Enregistrer</button></div>
      </form>
    }
    <section class="card pane"><div class="defile"><table class="tab"><thead><tr><th>Réf.</th><th>Exigence</th><th>Priorité</th><th>Section</th><th></th></tr></thead><tbody>
      @for (e of exigences(); track e.id) {
        <tr><td><code>{{ e.ref }}</code></td><td>{{ e.titre }}@if (e.description) { <div class="mini">{{ e.description }}</div> }</td>
          <td><span class="prio" [class.must]="e.priorite === 'must'">{{ e.priorite.toUpperCase() }}</span></td><td>{{ e.section_tdr }}</td>
          <td style="white-space: nowrap">@if (peutCadrer()) { <button mat-icon-button (click)="ouvrirExigence(e)" aria-label="Modifier"><mat-icon>edit</mat-icon></button> }
            @if (p.estChef()) { <button mat-icon-button (click)="supprimerExigence(e)" aria-label="Supprimer"><mat-icon>delete</mat-icon></button> }</td></tr>
      } @empty { <tr><td colspan="5" class="mini">Aucune exigence. Elles alimentent la matrice de traçabilité (onglet Recette).</td></tr> }
    </tbody></table></div></section>
  }`,
})
export class Cadrage {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  private readonly s = inject(Saisie);
  private readonly http = inject(Http);
  readonly vue = signal<'tdr' | 'exigences'>('tdr');
  readonly charge = signal(false);
  readonly tdr = signal('');
  readonly exigences = signal<Exigence[]>([]);
  readonly edition = signal<string | null>(null);
  readonly formE = signal<{ ref: string | null; titre: string; priorite: string; section_tdr: string; description: string } | null>(null);
  texte = '';
  readonly oPrio = [{ value: 'must', label: 'MUST — indispensable' }, { value: 'should', label: 'SHOULD — souhaitable' }, { value: 'could', label: 'COULD — optionnelle' }];
  readonly peutCadrer = computed(() => this.p.estChef());
  readonly rendu = computed(() => marked.parse(this.tdr(), { async: false }) as string);
  readonly apercu = computed(() => marked.parse(this.edition() ?? '', { async: false }) as string);
  constructor() { effect(() => { if (this.p.code()) this.charger(); }); }
  async charger() {
    const code = this.p.code();
    const [t, e] = await Promise.all([this.api.invoke(projetsTdr, { code }), this.api.invoke(projetsExigences, { code })]);
    this.tdr.set(t.contenu ?? ''); this.exigences.set(e); this.charge.set(true);
  }
  editer() { this.texte = this.tdr(); this.edition.set(this.texte); }
  async enregistrerTdr() {
    if (await this.s.faire(() => this.api.invoke(gestionEcrireTdr, { code: this.p.code(), body: { contenu: this.texte } }), 'TDR enregistré')) { this.edition.set(null); this.charger(); }
  }
  async basculerRevision() {
    const ouverte = !this.p.detail()?.revision_perimetre;
    if (await this.s.faire(() => this.api.invoke(gestionRevision, { code: this.p.code(), body: { ouverte } }), ouverte ? 'Révision ouverte' : 'Révision fermée')) this.p.charger(this.p.code());
  }
  ouvrirExigence(e: Exigence | null) {
    this.formE.set(e ? { ref: e.ref, titre: e.titre, priorite: e.priorite, section_tdr: e.section_tdr, description: e.description } : { ref: null, titre: '', priorite: 'should', section_tdr: '', description: '' });
  }
  async enregistrerExigence() {
    const e = this.formE()!; const body = { titre: e.titre.trim(), priorite: e.priorite as any, section_tdr: e.section_tdr, description: e.description };
    const r = await this.s.faire(() => e.ref ? this.api.invoke(gestionMajExigence, { code: this.p.code(), ref: e.ref, body }) : this.api.invoke(gestionCreerExigence, { code: this.p.code(), body }), 'Exigence enregistrée');
    if (r) { this.formE.set(null); this.charger(); this.p.rafraichir(); }
  }
  async supprimerExigence(e: Exigence) {
    if (await this.s.confirmer(`Supprimer l’exigence ${e.ref} ?`, () => this.http.supprimer(this.p.code(), 'exigences', e.ref))) { this.charger(); this.p.rafraichir(); }
  }
}
