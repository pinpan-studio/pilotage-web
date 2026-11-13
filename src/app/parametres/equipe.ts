import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Api } from '../../api/genere/api';
import { equipesInviter, equipesMaj, equipesMajMembre, equipesMembres } from '../../api/genere/functions';
import { InvitationDto, MembreEquipeDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { EquipeService } from '../noyau/equipe.service';
import { Chargement } from '../noyau/chargement';
import { tonDeCouleur } from '../noyau/statut';
import { DataColumn, DataTableComponent, CellEditEvent } from '../shared/components/data/data-table.component';
import { CopyFieldComponent } from '../shared/components/fields';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';

interface Ligne { id: string; nom: string; email: string; role: string; role_code: string; etat: string; actif: boolean; projets: number; derniere: string; moi: boolean }

/** Équipe courante : nom, membres et rôles (édition en ligne), invitations par lien. */
@Component({
  selector: 'app-param-equipe',
  imports: [FormsModule, MatButtonModule, MatIconModule, DataTableComponent, CopyFieldComponent, SearchableSelectComponent, Chargement, ...PIPES],
  styleUrl: './parametres.scss',
  host: { style: 'display: contents' },
  styles: [`.invit { display: grid; grid-template-columns: minmax(0, 1fr) 180px auto; gap: var(--space-3); align-items: end; @media (max-width: 700px) { grid-template-columns: 1fr; } }`],
  template: `
  @if (eq.courante(); as e) {
    <section class="card pane">
      <header><h2>Équipe</h2><p>Espace de travail cloisonné : ses projets, ses membres, ses documents.</p></header>
      <div class="set"><div class="s-lbl"><strong>Nom</strong><small>Code : {{ e.code }}</small></div>
        <div class="s-ctl"><div class="form-field"><div class="field-box"><input [(ngModel)]="nom" [disabled]="!eq.estAdmin()" aria-label="Nom de l'équipe" /></div></div></div></div>
      <div class="set inline"><span class="ic-tile"><mat-icon>badge</mat-icon></span><div class="s-lbl"><strong>Votre rôle</strong><small>{{ e.role | libelle }} · {{ e.nb_membres }} membre(s) · {{ e.nb_projets }} projet(s)</small></div></div>
      @if (eq.estAdmin()) { <footer><button mat-flat-button color="primary" [disabled]="nom.trim().length < 2 || nom === e.nom" (click)="renommer()">Enregistrer</button></footer> }
    </section>
    @if (eq.estAdmin()) {
      <section class="card pane">
        <header><h2>Inviter un membre</h2><p>La personne se connecte avec son compte Google, à l'adresse indiquée.</p></header>
        <form class="set" (ngSubmit)="inviter()" style="display: block">
          <div class="invit">
            <div class="form-field"><label class="field-label">Adresse e-mail Google</label><div class="field-box"><mat-icon>mail</mat-icon><input name="email" type="email" [(ngModel)]="invite.email" placeholder="prenom.nom@gmail.com" required /></div></div>
            <div class="form-field"><label class="field-label">Rôle</label><app-searchable-select name="role" [(ngModel)]="invite.role" [options]="optionsRoles()" icon="badge" placeholder="Rôle" /></div>
            <button mat-flat-button color="primary" type="submit" [disabled]="!invite.email.includes('@') || enCours()"><mat-icon>person_add</mat-icon>Inviter</button>
          </div>
          @if (lien(); as l) { <div style="margin-top: 16px"><p class="muted" style="font-size: 13px; margin: 0 0 8px">{{ l.message }}</p><app-copy-field [value]="l.lien" label="Lien d'invitation" /></div> }
        </form>
      </section>
    }
    <section class="card">
      <div class="card-head"><h2>Membres</h2><span class="sub">{{ membres()?.length ?? '…' }} · rôles modifiables par double-clic (administrateurs)</span></div>
      @if (membres()) { <app-data-table [rows]="lignes()" [columns]="colonnes()" rowKey="id" [pageSize]="20" maxHeight="none" (cellEdit)="modifier($event)" /> }
      @else { <div class="card-body"><app-chargement forme="parametres" [lignes]="4" /></div> }
    </section>
    <section class="card pane">
      <header><h2>Rôles</h2><p>Les droits sont appliqués par l'API ; un rôle peut être précisé projet par projet (onglet Équipe du projet).</p></header>
      @for (r of descriptions; track r.code) { <div class="set inline"><span class="ic-tile"><mat-icon>{{ r.icone }}</mat-icon></span><div class="s-lbl"><strong>{{ r.code | libelle }}</strong><small>{{ r.texte }}</small></div></div> }
    </section>
  } @else { <app-chargement forme="parametres" [lignes]="5" /> }`,
})
export class ParamEquipe {
  private readonly api = inject(Api);
  readonly ref = inject(ReferentielsService);
  readonly eq = inject(EquipeService);
  private readonly snack = inject(MatSnackBar);
  readonly membres = signal<MembreEquipeDto[] | null>(null);
  readonly lien = signal<InvitationDto | null>(null);
  readonly enCours = signal(false);
  nom = ''; invite = { email: '', role: 'developpeur' };
  readonly descriptions = [
    { code: 'admin', icone: 'admin_panel_settings', texte: "Tout sur l'équipe : membres, rôles, projets, jetons d'API." },
    { code: 'chef_projet', icone: 'manage_accounts', texte: 'Crée et pilote les projets ; seul à valider et signer documents et fonctionnalités.' },
    { code: 'developpeur', icone: 'code', texte: 'Accède aux projets dont il est membre ; saisit tâches, retours, recette, statuts de développement.' },
    { code: 'client_lecteur', icone: 'visibility', texte: 'Consultation uniquement.' },
    { code: 'agent', icone: 'smart_toy', texte: "Agent IA (jeton d'API) : jamais de validation, de signature ni de suppression." },
  ];
  readonly optionsRoles = computed(() => (this.ref.donnees()?.roles_equipe ?? []).map((r) => ({ value: r.code, label: r.libelle })));
  readonly colonnes = computed<DataColumn<Ligne>[]>(() => [
    { key: 'nom', label: 'Membre', minWidth: 200, sortable: true, required: true },
    { key: 'email', label: 'E-mail', minWidth: 220, sortable: true },
    { key: 'role_code', label: 'Rôle', width: 160, type: 'badge', sortable: true, format: (r) => r.role, tone: (r) => tonDeCouleur(this.ref.couleur(r.role_code)),
      editable: this.eq.estAdmin() ? 'select' : undefined, options: (this.ref.donnees()?.roles_equipe ?? []).map((x) => ({ value: x.code, label: x.libelle })) },
    { key: 'etat', label: 'État', width: 130, type: 'badge', tone: (r) => (r.actif ? (r.etat === 'Invité' ? 'warning' : 'success') : 'neutral'),
      editable: this.eq.estAdmin() ? 'select' : undefined, options: [{ value: 'actif', label: 'Actif' }, { value: 'desactive', label: 'Désactivé' }] },
    { key: 'projets', label: 'Projets', type: 'number', align: 'right', width: 90 },
    { key: 'derniere', label: 'Dernière connexion', width: 170 },
  ]);
  readonly lignes = computed<Ligne[]>(() => (this.membres() ?? []).map((m) => ({ id: m.id, nom: m.nom + (m.moi ? ' (vous)' : ''), email: m.email, role: this.ref.libelle(m.role), role_code: m.role,
    etat: !m.actif ? 'Désactivé' : m.invite ? 'Invité' : 'Actif', actif: m.actif, projets: m.nb_projets,
    derniere: m.derniere_connexion ? new Date(m.derniere_connexion).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' }) : '—', moi: m.moi })));
  constructor() { this.eq.charger().then(() => (this.nom = this.eq.courante()?.nom ?? '')); this.charger(); }
  charger() { this.api.invoke(equipesMembres).then((m) => this.membres.set(m)).catch(() => this.membres.set([])); }
  private erreur(e: any) { this.snack.open(e?.error?.message ?? 'Opération impossible', 'Fermer', { duration: 5000 }); }
  async renommer() { try { await this.api.invoke(equipesMaj, { body: { nom: this.nom.trim() } }); await this.eq.charger(); this.snack.open('Équipe renommée', undefined, { duration: 2000 }); } catch (e) { this.erreur(e); } }
  async inviter() {
    this.enCours.set(true);
    try { const r = await this.api.invoke(equipesInviter, { body: { email: this.invite.email.trim(), role: this.invite.role as any } }); this.lien.set(r); this.invite.email = ''; this.charger(); }
    catch (e) { this.erreur(e); } finally { this.enCours.set(false); }
  }
  async modifier(ev: CellEditEvent<Ligne>) {
    const body: any = ev.key === 'role_code' ? { role: String(ev.value) } : { actif: ev.value === 'actif' };
    try { await this.api.invoke(equipesMajMembre, { id: ev.row.id, body }); this.snack.open('Membre mis à jour', undefined, { duration: 2000 }); }
    catch (e) { this.erreur(e); }
    this.charger();
  }
}
