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
  /** Exécute une écriture et signale le résultat ; renvoie la réponse ou null. */
  async faire<T>(fn: () => Promise<T>, succes: string): Promise<T | null> {
    try { const r = await fn(); this.ok(succes); return r; } catch (e) { this.erreur(e); return null; }
  }
}

export const STYLES_SAISIE = `
  .tete { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-4); }
  .tete .m3-filter-toggle { margin: 0; }
  .tete .esp { flex: 1; }
  .card.pane { padding: var(--space-4); margin-bottom: var(--space-4); }
  .grille-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
  .grille-form .large { grid-column: 1 / -1; }
  .grille-form label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--mat-sys-on-surface-variant); }
  .actions-form { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
  table.tab { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.tab th { text-align: left; font-weight: 600; color: var(--mat-sys-on-surface-variant); padding: 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); white-space: nowrap; }
  table.tab td { padding: 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); vertical-align: top; }
  table.tab tr:last-child td { border-bottom: 0; }
  table.tab td code { white-space: nowrap; }
  .defile { overflow-x: auto; }
  .mini { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
  select.choix { font: inherit; padding: 4px 6px; border-radius: 8px; border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface); color: inherit; }
  @media (max-width: 700px) { .grille-form { grid-template-columns: 1fr; } }
`;
