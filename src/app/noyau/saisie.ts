import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Retour utilisateur des saisies : succès bref, erreur de l'API en clair (messages « Refusé : … » en français). */
@Injectable({ providedIn: 'root' })
export class Saisie {
  private readonly snack = inject(MatSnackBar);
  ok(m: string) { this.snack.open(m, undefined, { duration: 2500 }); }
  erreur(e: any) {
    const m = e?.error?.message;
    this.snack.open(Array.isArray(m) ? m.join(' · ') : m ?? 'Opération impossible', 'Fermer', { duration: 6000 });
  }
  /** Demande confirmation puis exécute une suppression. */
  async confirmer(question: string, fn: () => Promise<unknown>, succes = 'Supprimé'): Promise<boolean> {
    if (!confirm(question)) return false;
    return (await this.faire(fn, succes)) !== null;
  }
  /** Exécute une écriture et signale le résultat ; renvoie la réponse ou null. */
  async faire<T>(fn: () => Promise<T>, succes: string): Promise<T | null> {
    try { const r = await fn(); this.ok(succes); return (r ?? true) as T; } catch (e) { this.erreur(e); return null; }
  }
}
