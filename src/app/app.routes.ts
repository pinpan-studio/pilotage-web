import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from './noyau/auth.service';
import { ReferentielsService } from './noyau/referentiels.service';

const connecte: CanActivateFn = async () => {
  const auth = inject(AuthService), router = inject(Router), ref = inject(ReferentielsService);
  if (!auth.connecte() && !(await auth.rafraichir())) return router.parseUrl('/connexion');
  await ref.charger().catch(() => undefined);
  return true;
};

export const routes: Routes = [
  { path: 'connexion', title: 'Connexion — Pilotage', loadComponent: () => import('./pages/connexion/connexion').then((m) => m.Connexion) },
  { path: '', canActivate: [connecte], loadComponent: () => import('./coquille/coquille').then((m) => m.Coquille), children: [
    { path: '', title: 'Portefeuille — Pilotage', data: { titre: 'Portefeuille' }, loadComponent: () => import('./pages/portefeuille').then((m) => m.Portefeuille) },
    { path: 'projets/:code', data: { titre: 'Projet' }, loadComponent: () => import('./pages/projet').then((m) => m.Projet), children: [
      { path: '', pathMatch: 'full', redirectTo: 'synthese' },
      { path: 'synthese', data: { titre: "Vue d'ensemble" }, title: 'Synthèse — Pilotage', loadComponent: () => import('./pages/synthese').then((m) => m.Synthese) },
      { path: 'fonctionnalites', data: { titre: "Fonctionnalités" }, title: 'Fonctionnalités — Pilotage', loadComponent: () => import('./pages/fonctionnalites').then((m) => m.Fonctionnalites) },
      { path: 'fonctionnalites/:ref', data: { titre: 'Fiche fonctionnalité' }, title: 'Fonctionnalité — Pilotage', loadComponent: () => import('./pages/fonctionnalites').then((m) => m.Fonctionnalite) },
      { path: 'planning', redirectTo: 'taches' },
      { path: 'taches/:ref', data: { titre: 'Tâche' }, title: 'Tâche — Pilotage', loadComponent: () => import('./pages/tache').then((m) => m.Tache) },
      { path: 'taches', data: { titre: 'Tâches' }, title: 'Tâches — Pilotage', loadComponent: () => import('./pages/taches').then((m) => m.Taches) },
      { path: 'livrables', data: { titre: "Livrables" }, title: 'Livrables — Pilotage', loadComponent: () => import('./pages/livrables').then((m) => m.Livrables) },
      { path: 'livrables/:doc', data: { titre: 'Document' }, title: 'Document — Pilotage', loadComponent: () => import('./pages/livrables').then((m) => m.Document) },
      { path: 'journal', data: { titre: "Journal" }, title: 'Journal — Pilotage', loadComponent: () => import('./pages/journal').then((m) => m.Journal) },
    ] },
    { path: 'parametres', data: { titre: 'Paramètres' }, loadComponent: () => import('./parametres/parametres').then((m) => m.Parametres), children: [
      { path: '', pathMatch: 'full', redirectTo: 'compte' },
      { path: 'compte', data: { titre: 'Mon compte', fil: 'Paramètres' }, title: 'Mon compte — Pilotage', loadComponent: () => import('./parametres/compte').then((m) => m.Compte) },
      { path: 'securite', data: { titre: 'Sécurité', fil: 'Paramètres' }, title: 'Sécurité — Pilotage', loadComponent: () => import('./parametres/securite').then((m) => m.Securite) },
    ] },
  ] },
  { path: '**', redirectTo: '' },
];
