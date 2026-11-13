import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Api } from '../../api/genere/api';
import { compteMajProfil, compteProfil } from '../../api/genere/functions';
import { ProfilDto } from '../../api/genere/models';
import { AuthService } from '../noyau/auth.service';
import { PIPES } from '../noyau/pipes';
import { ThemeSettingsComponent } from '../shared/components/theme-picker/theme-picker.component';

import { Chargement } from '../noyau/chargement';
@Component({
  selector: 'app-compte',
  imports: [Chargement, FormsModule, MatButtonModule, MatIconModule, ThemeSettingsComponent, ...PIPES],
  styleUrl: './parametres.scss',
  host: { style: 'display: contents' },
  template: `
  @if (p(); as p) {
    <section class="card pane">
      <header><h2>Profil</h2><p>Visible par les membres de votre équipe.</p></header>
      <div class="set">
        <div class="s-lbl"><strong>Photo</strong><small>Celle de votre compte Google.</small></div>
        <div class="s-ctl avatar-row">@if (p.photo_url) { <img [src]="p.photo_url" alt="" class="ava lg" referrerpolicy="no-referrer" style="object-fit: cover" /> } @else { <span class="ava lg">{{ initiales(p.nom) }}</span> }</div>
      </div>
      <div class="set">
        <div class="s-lbl"><strong>Nom affiché</strong></div>
        <div class="s-ctl"><div class="form-field"><div class="field-box"><input [(ngModel)]="nom" aria-label="Nom" maxlength="120" /></div></div></div>
      </div>
      <div class="set">
        <div class="s-lbl"><strong>Adresse e-mail</strong><small>Sert à la connexion ; non modifiable.</small></div>
        <div class="s-ctl"><div class="form-field"><div class="field-box"><mat-icon>mail</mat-icon><input [value]="p.email" disabled aria-label="E-mail" /></div></div></div>
      </div>
      <div class="set">
        <div class="s-lbl"><strong>Équipe et rôle</strong></div>
        <div class="s-ctl">{{ p.organisation?.nom ?? '—' }} · {{ p.role | libelle }}</div>
      </div>
      <footer><button mat-button (click)="nom = p.nom" [disabled]="nom === p.nom">Annuler</button>
        <button mat-flat-button color="primary" (click)="enregistrer()" [disabled]="nom.trim().length < 2 || nom === p.nom">Enregistrer</button></footer>
    </section>
    <section class="card pane">
      <header><h2>Connexion</h2><p>Méthodes de connexion liées à votre compte.</p></header>
      <div class="set inline"><span class="ic-tile"><mat-icon>account_circle</mat-icon></span><div class="s-lbl"><strong>Google</strong><small>{{ p.google_lie ? 'Compte Google lié' : 'Pas encore lié : connectez-vous une fois avec Google' }}</small></div>
        <span [class]="'ref ' + (p.google_lie ? 'tone-success' : 'tone-neutral')">{{ p.google_lie ? 'Actif' : 'Inactif' }}</span></div>
      <div class="set inline"><span class="ic-tile"><mat-icon>password</mat-icon></span><div class="s-lbl"><strong>Mot de passe</strong><small>Connexion de secours</small></div>
        <span [class]="'ref ' + (p.mot_de_passe ? 'tone-success' : 'tone-neutral')">{{ p.mot_de_passe ? 'Défini' : 'Aucun' }}</span></div>
      <div class="set inline"><span class="ic-tile"><mat-icon>schedule</mat-icon></span><div class="s-lbl"><strong>Dernière connexion</strong><small>{{ p.derniere_connexion | dateFr: true }}</small></div></div>
    </section>
    <section class="card pane"><header><h2>Apparence</h2><p>Thème de l'interface, mémorisé sur cet appareil.</p></header><app-theme-settings /></section>
  } @else { <app-chargement forme="parametres" [lignes]="5" /> }`,
})
export class Compte {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  readonly p = signal<ProfilDto | null>(null);
  nom = '';
  constructor() { this.api.invoke(compteProfil).then((p) => { this.p.set(p); this.nom = p.nom; }); }
  initiales = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  async enregistrer() {
    try {
      const p = await this.api.invoke(compteMajProfil, { body: { nom: this.nom.trim() } });
      this.p.set(p); this.nom = p.nom; this.auth.majUtilisateur({ nom: p.nom });
      this.snack.open('Profil enregistré', undefined, { duration: 2500 });
    } catch (e: any) { this.snack.open(e?.error?.message ?? 'Enregistrement impossible', 'Fermer', { duration: 5000 }); }
  }
}
