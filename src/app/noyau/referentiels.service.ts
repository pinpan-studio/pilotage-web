import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../../api/genere/api';
import { referentielsReferentiels } from '../../api/genere/functions';
import { ReferentielsDto } from '../../api/genere/models';

/** Libellés, couleurs et poids fournis par l'API (le frontend ne définit aucun statut). */
@Injectable({ providedIn: 'root' })
export class ReferentielsService {
  private readonly api = inject(Api);
  readonly donnees = signal<ReferentielsDto | null>(null);
  async charger() { if (!this.donnees()) this.donnees.set(await this.api.invoke(referentielsReferentiels)); }
  libelle(code: string | null | undefined) { return code ? (this.donnees()?.libelles?.[code] ?? code) : '—'; }
  /** Couleur (variable CSS) d'un code, quel que soit le référentiel. */
  couleur(code: string | null | undefined): string | undefined {
    const d = this.donnees(); if (!d || !code) return undefined;
    for (const v of Object.values(d)) if (Array.isArray(v)) { const e = (v as any[]).find((x) => x?.code === code); if (e) return e.couleur; }
    return undefined;
  }
  phase(code: string) { return this.donnees()?.phases.find((p) => p.code === code)?.libelle ?? code; }
}
