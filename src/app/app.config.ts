import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ApiConfiguration } from '../api/genere/api-configuration';
import { routes } from './app.routes';
import { chargerConfig } from './noyau/config';
import { intercepteurAuth } from './noyau/intercepteur';
import { ThemeService } from './core/services/theme.service';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    provideHttpClient(withInterceptors([intercepteurAuth])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideAppInitializer(async () => {
      inject(ThemeService); // applique le thème mémorisé (clair / sombre / couleur) dès le démarrage
      const api = inject(ApiConfiguration);
      api.rootUrl = (await chargerConfig()).apiUrl;
    }),
  ],
};
