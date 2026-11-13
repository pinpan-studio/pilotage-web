import { AfterViewInit, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../noyau/auth.service';
import { GoogleService } from '../../noyau/google.service';
import { ThemeService } from '../../core/services/theme.service';

/** Connexion — disposition « split-right » de la page d'authentification du UI-Kit. */
@Component({
  selector: 'app-connexion',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  styleUrl: './connexion.scss',
  styles: [`.google-zone { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 44px; margin: 8px 0; }
    .google-btn { width: 100%; max-width: 400px; display: flex; justify-content: center; }
    .lien-btn { background: none; border: 0; cursor: pointer; font: inherit; padding: 0; }`],
  template: `
  <div class="auth layout-split-right screen-login">
    <aside class="visual">
      <div class="brand light"><mat-icon>insights</mat-icon><span>Pilotage</span></div>
      <div class="pitch">
        <h2>Tous vos projets, du TDR à la recette, au même endroit.</h2>
        <p>Avancement calculé, documentation rédigée au fil du développement, retours clients et livrables suivis par toute l'équipe.</p>
        <ul>
          <li><mat-icon>bolt</mat-icon>Journal automatique des agents IA</li>
          <li><mat-icon>shield</mat-icon>Espaces d'équipe cloisonnés</li>
          <li><mat-icon>wifi_off</mat-icon>Pensé pour les connexions instables</li>
        </ul>
      </div>
    </aside>
    <main class="panel side">
      <div class="brand compact"><mat-icon>insights</mat-icon><span>Pilotage</span></div>
      <div class="form">
        <div class="head"><h1>Bon retour !</h1><p>Connectez-vous pour accéder à votre espace.</p></div>
        @if (google.clientId()) {
          <div class="google-zone"><div #boutonGoogle class="google-btn"></div>@if (enCours()) { <mat-spinner diameter="22" /> }</div>
          @if (!emailVisible()) { <p class="alt"><button type="button" class="link lien-btn" (click)="emailVisible.set(true)">Connexion par e-mail et mot de passe</button></p> }
          @else { <div class="divider"><span>ou avec votre e-mail</span></div> }
        }
        @if (erreur() && !emailVisible()) { <p class="error"><mat-icon>error</mat-icon>{{ erreur() }}</p> }
        @if (emailVisible() || !google.clientId()) {
        <form (ngSubmit)="valider()" class="fields">
          <div class="form-field">
            <label class="field-label" for="email">Adresse e-mail</label>
            <div class="field-box"><mat-icon>mail</mat-icon><input id="email" name="email" type="email" autocomplete="username" [(ngModel)]="email" placeholder="nom@entreprise.ci" required /></div>
          </div>
          <div class="form-field">
            <label class="field-label" for="mdp">Mot de passe</label>
            <div class="field-box"><mat-icon>lock</mat-icon>
              <input id="mdp" name="mdp" [type]="voir() ? 'text' : 'password'" autocomplete="current-password" [(ngModel)]="mdp" required />
              <button mat-icon-button type="button" (click)="voir.set(!voir())" [attr.aria-label]="voir() ? 'Masquer' : 'Afficher'"><mat-icon>{{ voir() ? 'visibility_off' : 'visibility' }}</mat-icon></button>
            </div>
          </div>
          @if (erreur()) { <p class="error"><mat-icon>error</mat-icon>{{ erreur() }}</p> }
          <button mat-flat-button color="primary" class="submit" type="submit" [disabled]="enCours()">
            @if (enCours()) { <mat-spinner diameter="18" /> } @else { Se connecter }
          </button>
        </form>
        }
      </div>
      <footer class="legal">© {{ annee }} Pilotage · données hébergées de façon sécurisée</footer>
    </main>
  </div>`,
})
export class Connexion implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly google = inject(GoogleService);
  private readonly theme = inject(ThemeService);
  private readonly boutonGoogle = viewChild<ElementRef<HTMLElement>>('boutonGoogle');
  readonly emailVisible = signal(false);

  ngAfterViewInit() {
    const hote = this.boutonGoogle()?.nativeElement;
    if (hote) this.google.afficherBouton(hote, (c) => this.validerGoogle(c), this.theme.mode() === 'dark')
      .catch(() => { this.erreur.set('Google est injoignable : vérifiez la connexion, ou utilisez la connexion par e-mail.'); this.emailVisible.set(true); });
  }

  async validerGoogle(credential: string) {
    this.erreur.set(''); this.enCours.set(true);
    try { await this.auth.connexionGoogle(credential); this.router.navigateByUrl('/'); }
    catch (e: any) { this.erreur.set(e?.error?.message ?? (e?.status === 0 ? 'API injoignable : vérifiez la connexion internet.' : 'Connexion Google refusée.')); }
    finally { this.enCours.set(false); }
  }
  readonly annee = new Date().getFullYear();
  email = ''; mdp = '';
  readonly erreur = signal(''); readonly enCours = signal(false); readonly voir = signal(false);
  async valider() {
    this.erreur.set(''); this.enCours.set(true);
    try { await this.auth.connexion(this.email, this.mdp); this.router.navigateByUrl('/'); }
    catch (e: any) { this.erreur.set(e?.status === 401 ? 'Identifiants incorrects.' : e?.status === 0 ? 'API injoignable : vérifiez la connexion internet.' : 'Erreur de connexion.'); }
    finally { this.enCours.set(false); }
  }
}
