import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../api/genere/api';
import { authConnexion, authDeconnexion, authGoogle, authRafraichir } from '../../api/genere/functions';
import { GoogleService } from './google.service';

interface Utilisateur { id: string; email: string; nom: string; role: string; photo_url?: string | null }
const CLE = 'pilotage.session';

/**
 * Jeton d'accès (15 min) en mémoire ; jeton de rafraîchissement conservé dans le navigateur
 * (l'API et l'interface n'ont pas de domaine commun : pas de cookie partagé possible).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly google = inject(GoogleService);
  private jetonAcces: string | null = null;
  private enCours: Promise<boolean> | null = null;
  readonly utilisateur = signal<Utilisateur | null>(null);
  readonly connecte = computed(() => this.utilisateur() !== null);

  constructor() {
    try { const s = JSON.parse(localStorage.getItem(CLE) ?? 'null'); if (s?.utilisateur) this.utilisateur.set(s.utilisateur); } catch { /* ignore */ }
  }

  get acces() { return this.jetonAcces; }
  private get refresh(): string | null { try { return JSON.parse(localStorage.getItem(CLE) ?? 'null')?.refresh ?? null; } catch { return null; } }

  private memoriser(r: { jeton_acces: string; jeton_rafraichissement: string; utilisateur: Utilisateur }) {
    this.jetonAcces = r.jeton_acces;
    this.utilisateur.set(r.utilisateur);
    localStorage.setItem(CLE, JSON.stringify({ refresh: r.jeton_rafraichissement, utilisateur: r.utilisateur }));
  }

  async connexionGoogle(credential: string) {
    this.memoriser(await this.api.invoke(authGoogle, { body: { credential } }));
  }

  /** Met à jour le nom affiché après une modification du profil. */
  majUtilisateur(u: Partial<Utilisateur>) {
    const x = this.utilisateur(); if (!x) return;
    const n = { ...x, ...u }; this.utilisateur.set(n);
    try { const s = JSON.parse(localStorage.getItem(CLE) ?? 'null'); if (s) localStorage.setItem(CLE, JSON.stringify({ ...s, utilisateur: n })); } catch { /* ignore */ }
  }

  async connexion(email: string, mot_de_passe: string) {
    this.memoriser(await this.api.invoke(authConnexion, { body: { email, mot_de_passe } }));
  }

  /** Renouvelle le jeton d'accès ; un seul appel à la fois. */
  rafraichir(): Promise<boolean> {
    const r = this.refresh;
    if (!r) return Promise.resolve(false);
    this.enCours ??= this.api.invoke(authRafraichir, { body: { jeton_rafraichissement: r } })
      .then((x) => { this.memoriser(x); return true; })
      .catch(() => { this.oublier(); return false; })
      .finally(() => (this.enCours = null));
    return this.enCours;
  }

  async deconnexion() {
    const r = this.refresh;
    this.oublier();
    this.google.oublier();
    if (r) await this.api.invoke(authDeconnexion, { body: { jeton_rafraichissement: r } }).catch(() => undefined);
    this.router.navigateByUrl('/connexion');
  }

  oublier() { this.jetonAcces = null; this.utilisateur.set(null); localStorage.removeItem(CLE); }
}
