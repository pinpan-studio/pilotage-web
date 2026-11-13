import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../noyau/auth.service';

@Component({
  selector: 'app-connexion',
  imports: [FormsModule],
  template: `
  <div class="connexion carte">
    <h1><span class="logo">◆</span>Pilotage</h1>
    <form (ngSubmit)="valider()">
      <label class="champ">Adresse e-mail<input name="email" type="email" [(ngModel)]="email" autocomplete="username" required></label>
      <label class="champ">Mot de passe<input name="mdp" type="password" [(ngModel)]="mdp" autocomplete="current-password" required></label>
      @if (erreur()) { <p class="erreur-texte">{{ erreur() }}</p> }
      <button class="bouton" [disabled]="enCours()">{{ enCours() ? 'Connexion…' : 'Se connecter' }}</button>
    </form>
  </div>`,
})
export class Connexion {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  email = ''; mdp = '';
  readonly erreur = signal(''); readonly enCours = signal(false);
  async valider() {
    this.erreur.set(''); this.enCours.set(true);
    try { await this.auth.connexion(this.email, this.mdp); this.router.navigateByUrl('/'); }
    catch (e: any) { this.erreur.set(e?.status === 401 ? 'Identifiants incorrects.' : e?.status === 0 ? 'API injoignable : vérifiez la connexion internet.' : 'Erreur de connexion.'); }
    finally { this.enCours.set(false); }
  }
}
