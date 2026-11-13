import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Api } from '../../api/genere/api';
import { projetsPortefeuille } from '../../api/genere/functions';
import { ProjetResumeDto } from '../../api/genere/models';

/** Onglets d'un projet (navigation latérale, onglets, palette de commandes). */
export const ONGLETS_PROJET = [
  { seg: 'synthese', label: "Vue d'ensemble", icon: 'space_dashboard' },
  { seg: 'cadrage', label: 'Cadrage', icon: 'article' },
  { seg: 'fonctionnalites', label: 'Fonctionnalités', icon: 'checklist' },
  { seg: 'taches', label: 'Tâches', icon: 'task_alt' },
  { seg: 'livrables', label: 'Livrables', icon: 'description' },
  { seg: 'recette', label: 'Recette', icon: 'fact_check' },
  { seg: 'registres', label: 'Registres', icon: 'inventory' },
  { seg: 'journal', label: 'Journal', icon: 'history' },
  { seg: 'equipe', label: 'Équipe', icon: 'group' },
];

/** État de navigation partagé : liste des projets accessibles et projet courant (d'après l'URL). */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly projets = signal<ProjetResumeDto[] | null>(null);
  readonly projetCourant = signal<string | null>(null);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      const m = /^\/projets\/([^/?#]+)/.exec(this.router.url);
      if (m) this.projetCourant.set(decodeURIComponent(m[1]));
    });
  }

  async chargerProjets(forcer = false) {
    if (this.projets() && !forcer) return this.projets()!;
    const p = await this.api.invoke(projetsPortefeuille).catch(() => [] as ProjetResumeDto[]);
    this.projets.set(p);
    return p;
  }
  projet(code: string | null) { return this.projets()?.find((p) => p.code === code) ?? null; }
}
