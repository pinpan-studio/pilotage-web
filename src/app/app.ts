import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Api } from '../api/genere/api';
import { santeSante } from '../api/genere/functions';
import { AuthService } from './noyau/auth.service';
import { VERSION_API_ATTENDUE } from './noyau/config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
  @if (alerteVersion()) { <div class="bandeau erreur">{{ alerteVersion() }}</div> }
  @if (horsLigne()) { <div class="bandeau info">API injoignable : vérifiez la connexion internet. Les données affichées peuvent être anciennes.</div> }
  @if (auth.connecte()) {
    <header class="entete"><div class="conteneur">
      <a class="marque" routerLink="/"><span class="logo">◆</span>Pilotage</a>
      <nav><span class="mute">{{ auth.utilisateur()?.nom }}</span><button class="lien-bouton" (click)="auth.deconnexion()">Se déconnecter</button></nav>
    </div></header>
  }
  <main class="conteneur"><router-outlet /></main>
  <footer class="pied conteneur">Pilotage · dates en heure d'Abidjan (UTC+0)</footer>`,
})
export class App {
  readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  readonly alerteVersion = signal('');
  readonly horsLigne = signal(false);
  constructor() {
    this.api.invoke(santeSante).then((s) => {
      if (s?.version_api !== VERSION_API_ATTENDUE) this.alerteVersion.set(`Version d'API inattendue (${s?.version_api ?? '?'} au lieu de ${VERSION_API_ATTENDUE}) : rechargez la page ou prévenez l'administrateur.`);
    }).catch(() => this.horsLigne.set(true));
  }
}
