import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Api } from '../../api/genere/api';
import { equipesMembres, projetsAdminDefinir, projetsAdminMembres, projetsAdminRetirer, projetsAdminVisibilite } from '../../api/genere/functions';
import { MembreEquipeDto, MembreProjetDto } from '../../api/genere/models';
import { PIPES } from '../noyau/pipes';
import { ReferentielsService } from '../noyau/referentiels.service';
import { AuthService } from '../noyau/auth.service';
import { Chargement } from '../noyau/chargement';
import { Statut } from '../noyau/statut';
import { ProjetCourant } from './projet';
import { SearchableSelectComponent } from '../shared/components/searchable-select/searchable-select.component';

/** Équipe du projet : membres et rôle de chacun sur ce projet (chef de projet, développeur, lecteur). */
@Component({
  selector: 'app-projet-equipe',
  imports: [FormsModule, MatButtonModule, MatIconModule, SearchableSelectComponent, Chargement, Statut, ...PIPES],
  styles: [`.ajout { display: grid; grid-template-columns: minmax(0, 1fr) 180px auto; gap: var(--space-3); align-items: end; padding: 0 var(--space-5) var(--space-5); @media (max-width: 700px) { grid-template-columns: 1fr; } }
    .role-sel { width: 180px; flex: 0 0 180px; } @media (max-width: 600px) { .role-sel { width: 100%; flex-basis: 100%; } }
    .vis { all: unset; display: flex; align-items: center; gap: var(--space-3); padding: 10px 20px; cursor: pointer; border-radius: 12px; } .vis:disabled { cursor: default; }
    .vis.on { background: var(--mat-sys-secondary-container); } .vis:not(:disabled):not(.on):hover { background: var(--mat-sys-surface-container-high); }
    .coche { font-size: 16px; width: 16px; height: 16px; vertical-align: -3px; margin-left: 6px; color: var(--mat-sys-primary); }
    .ava-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex: 0 0 36px; }`],
  template: `
  <div class="grid-3">
    <section class="card span-2">
      <div class="card-head"><h2>Membres du projet</h2><span class="sub">{{ membres()?.length ?? '…' }}</span></div>
      @if (!membres()) { <div class="card-body"><app-chargement forme="parametres" [lignes]="3" /></div> }
      @else {
        <div class="rows" style="padding-bottom: 8px">
          @for (m of membres(); track m.utilisateur_id) {
            <div class="row">
              @if (m.photo_url) { <img class="ava-img" [src]="m.photo_url" alt="" referrerpolicy="no-referrer" /> } @else { <span class="ava">{{ initiales(m.nom) }}</span> }
              <div class="grow"><strong>{{ m.nom }}</strong><small>{{ m.email }} · équipe : {{ m.role_equipe | libelle }}</small></div>
              @if (gestion()) {
                <app-searchable-select class="role-sel" [ngModel]="m.role" (ngModelChange)="$event && $event !== m.role && definir(m.utilisateur_id, $event)" [options]="optionsRoles()" placeholder="Rôle" />
                <button mat-icon-button (click)="retirer(m)" [attr.aria-label]="'Retirer ' + m.nom"><mat-icon>person_remove</mat-icon></button>
              } @else { <app-statut [code]="m.role" /> }
            </div>
          }
        </div>
        @if (gestion() && candidats().length) {
          <div class="card-head"><h2>Ajouter un membre de l'équipe</h2></div>
          <form class="ajout" (ngSubmit)="ajouter()">
            <div class="form-field"><label class="field-label">Membre</label><app-searchable-select name="u" [(ngModel)]="ajout.utilisateur_id" [options]="optionsCandidats()" icon="person" placeholder="Choisir un membre" searchPlaceholder="Nom ou e-mail…" /></div>
            <div class="form-field"><label class="field-label">Rôle sur le projet</label><app-searchable-select name="r" [(ngModel)]="ajout.role" [options]="optionsRoles()" icon="badge" placeholder="Rôle" /></div>
            <button mat-flat-button color="primary" type="submit" [disabled]="!ajout.utilisateur_id"><mat-icon>person_add</mat-icon>Ajouter</button>
          </form>
        }
      }
    </section>
    <section class="card">
      <div class="card-head"><h2>Visibilité dans l'équipe</h2></div>
      <div class="rows" style="padding-bottom: 8px">
        @for (v of visibilites; track v.value) {
          <button type="button" class="row vis" [class.on]="p.detail()?.visibilite === v.value" [disabled]="!gestion()" (click)="changerVisibilite(v.value)">
            <span class="ic-tile" [class]="'ic-tile ' + (p.detail()?.visibilite === v.value ? 'tone-info' : 'tone-neutral')"><mat-icon>{{ v.icon }}</mat-icon></span>
            <div class="grow"><strong>{{ v.label }}@if (p.detail()?.visibilite === v.value) { <mat-icon class="coche">check_circle</mat-icon> }</strong><small style="white-space: normal">{{ v.description }}</small></div>
          </button>
        }
      </div>
      <p class="muted" style="padding: 0 20px 12px; font-size: 12.5px">Les clients (lecteurs de l'équipe) ne voient que les projets dont ils sont membres.@if (p.detail() && !p.detail()!.membre) { Vous accédez à ce projet {{ p.estChef() ? 'en tant qu’administrateur' : 'par sa visibilité « équipe »' }}. }</p>
    </section>
    <section class="card">
      <div class="card-head"><h2>Droits sur le projet</h2></div>
      <div class="rows" style="padding-bottom: 12px">
        <div class="row"><span class="ic-tile tone-info"><mat-icon>manage_accounts</mat-icon></span><div class="grow"><strong>Chef de projet</strong><small class="wrap" style="white-space: normal">Gère les membres ; seul à valider et signer.</small></div></div>
        <div class="row"><span class="ic-tile tone-success"><mat-icon>code</mat-icon></span><div class="grow"><strong>Développeur</strong><small style="white-space: normal">Tâches, retours, recette, statuts de développement.</small></div></div>
        <div class="row"><span class="ic-tile tone-neutral"><mat-icon>visibility</mat-icon></span><div class="grow"><strong>Lecteur</strong><small style="white-space: normal">Consultation uniquement.</small></div></div>
        <div class="row"><span class="ic-tile tone-purple"><mat-icon>smart_toy</mat-icon></span><div class="grow"><strong>Agent IA</strong><small style="white-space: normal">Via jeton d'API : jamais de validation, de signature ni de suppression.</small></div></div>
      </div>
      @if (!gestion()) { <p class="muted" style="padding: 0 20px 16px; font-size: 13px">Seuls les chefs de projet et les administrateurs modifient les membres.</p> }
    </section>
  </div>`,
})
export class ProjetEquipe {
  readonly p = inject(ProjetCourant);
  private readonly api = inject(Api);
  readonly ref = inject(ReferentielsService);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  readonly membres = signal<MembreProjetDto[] | null>(null);
  readonly equipe = signal<MembreEquipeDto[]>([]);
  ajout = { utilisateur_id: '', role: 'developpeur' };
  readonly visibilites = [
    { value: 'equipe' as const, label: 'Équipe', icon: 'groups', description: 'Toute l’équipe voit le projet ; les non-membres y contribuent comme développeurs (sans valider ni signer).' },
    { value: 'equipe_lecture' as const, label: 'Équipe, lecture seule', icon: 'visibility', description: 'Toute l’équipe voit le projet ; seuls ses membres le modifient.' },
    { value: 'membres' as const, label: 'Privé', icon: 'lock', description: 'Seuls les membres du projet (et les administrateurs) le voient.' },
  ];
  async changerVisibilite(v: 'equipe' | 'equipe_lecture' | 'membres') {
    if (!this.gestion() || this.p.detail()?.visibilite === v) return;
    try { await this.api.invoke(projetsAdminVisibilite, { code: this.p.code(), body: { visibilite: v } }); await this.p.charger(this.p.code()); this.snack.open('Visibilité mise à jour', undefined, { duration: 2000 }); } catch (e) { this.erreur(e); }
  }
  readonly gestion = computed(() => {
    const u = this.auth.utilisateur(); if (!u) return false;
    return u.role === 'admin' || !!this.membres()?.some((m) => m.utilisateur_id === u.id && m.role === 'chef_projet');
  });
  readonly optionsRoles = computed(() => (this.ref.donnees()?.roles_projet ?? []).map((r) => ({ value: r.code, label: r.libelle })));
  readonly optionsCandidats = computed(() => this.candidats().map((c) => ({ value: c.id, label: c.nom, description: c.email, icon: 'person' })));
  readonly candidats = computed(() => this.equipe().filter((e) => e.actif && !this.membres()?.some((m) => m.utilisateur_id === e.id)));
  constructor() {
    effect(() => { const c = this.p.code(); if (c) { this.charger(); this.api.invoke(equipesMembres).then((l) => this.equipe.set(l)).catch(() => undefined); } });
    effect(() => { const c = this.candidats(); if (c.length && !c.some((x) => x.id === this.ajout.utilisateur_id)) this.ajout.utilisateur_id = c[0].id; });
  }
  charger() { this.api.invoke(projetsAdminMembres, { code: this.p.code() }).then((l) => this.membres.set(l)); }
  initiales = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  private erreur(e: any) { this.snack.open(e?.error?.message ?? 'Opération impossible', 'Fermer', { duration: 5000 }); this.charger(); }
  async definir(utilisateur_id: string, role: string) {
    try { this.membres.set(await this.api.invoke(projetsAdminDefinir, { code: this.p.code(), body: { utilisateur_id, role: role as MembreProjetDto['role'] as any } })); this.snack.open('Rôle mis à jour', undefined, { duration: 2000 }); } catch (e) { this.erreur(e); }
  }
  ajouter() { this.definir(this.ajout.utilisateur_id, this.ajout.role); }
  async retirer(m: MembreProjetDto) {
    try { this.membres.set(await this.api.invoke(projetsAdminRetirer, { code: this.p.code(), id: m.utilisateur_id })); this.snack.open(`${m.nom} retiré du projet`, undefined, { duration: 2000 }); } catch (e) { this.erreur(e); }
  }
}
