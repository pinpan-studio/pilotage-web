import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { registerLocaleData } from '@angular/common';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import localeFr from '@angular/common/locales/fr';
import { ApiConfiguration } from '../api/genere/api-configuration';
import { routes } from './app.routes';
import { chargerConfig } from './noyau/config';
import { intercepteurAuth } from './noyau/intercepteur';
import { ThemeService } from './core/services/theme.service';
import { GoogleService } from './noyau/google.service';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    provideHttpClient(withInterceptors([intercepteurAuth])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideAppInitializer(async () => {
      inject(ThemeService); // applique le thème mémorisé (clair / sombre / couleur) dès le démarrage
      const api = inject(ApiConfiguration);
      const google = inject(GoogleService); // inject() avant tout await
      api.rootUrl = (await chargerConfig()).apiUrl;
      // Configuration publique de l'API (ID client Google) ; hors ligne, l'interface démarre quand même.
      await fetch(`${api.rootUrl}/api/v1/config`).then((r) => r.json()).then((c) => google.clientId.set(c.google_client_id ?? null)).catch(() => undefined);
    }),
  ],
};
