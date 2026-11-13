import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ApiConfiguration } from '../api/genere/api-configuration';
import { routes } from './app.routes';
import { chargerConfig } from './noyau/config';
import { intercepteurAuth } from './noyau/intercepteur';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([intercepteurAuth])),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideAppInitializer(async () => { const api = inject(ApiConfiguration); api.rootUrl = (await chargerConfig()).apiUrl; }),
  ],
};
