import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Api } from '../api/genere/api';
import { santeSante } from '../api/genere/functions';
import { VERSION_API_ATTENDUE } from './noyau/config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  styles: [`:host { display: flex; flex-direction: column; height: 100vh; height: 100dvh; } .zone { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }`],
  template: `
  @if (alerteVersion()) { <div class="banner-line tone-error">{{ alerteVersion() }}</div> }
  @if (horsLigne()) { <div class="banner-line tone-warning">API injoignable : vérifiez la connexion internet. Les données affichées peuvent être anciennes.</div> }
  <div class="zone"><router-outlet /></div>`,
})
export class App {
  private readonly api = inject(Api);
  readonly alerteVersion = signal('');
  readonly horsLigne = signal(false);
  constructor() {
    this.api.invoke(santeSante).then((s) => {
      if (s?.version_api !== VERSION_API_ATTENDUE) this.alerteVersion.set(`Version d'API inattendue (${s?.version_api ?? '?'} au lieu de ${VERSION_API_ATTENDUE}) : rechargez la page ou prévenez l'administrateur.`);
    }).catch(() => this.horsLigne.set(true));
  }
}
