import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, switchMap, throwError, catchError } from 'rxjs';
import { AuthService } from './auth.service';

const PUBLIC = /\/api\/v1\/(auth\/(connexion|rafraichir|deconnexion)|sante)$/;

/** Ajoute le jeton ; sur 401, rafraîchit une fois puis rejoue la requête. */
export const intercepteurAuth: HttpInterceptorFn = (req, next) => {
  if (PUBLIC.test(req.url)) return next(req);
  const auth = inject(AuthService);
  const router = inject(Router);
  const avec = (j: string | null) => (j ? req.clone({ setHeaders: { Authorization: `Bearer ${j}` } }) : req);
  const preparer = auth.acces ? Promise.resolve(true) : auth.rafraichir();
  return from(preparer).pipe(
    switchMap(() => next(avec(auth.acces))),
    catchError((e: HttpErrorResponse) => {
      if (e.status !== 401) return throwError(() => e);
      return from(auth.rafraichir()).pipe(switchMap((ok) => {
        if (!ok) { router.navigateByUrl('/connexion'); return throwError(() => e); }
        return next(avec(auth.acces));
      }));
    }),
  );
};
