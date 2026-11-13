import { Component, computed, inject, input } from '@angular/core';
import { StatusBadgeComponent } from '../shared/components/status-badge/status-badge.component';
import { ReferentielsService } from './referentiels.service';

/** Ton du kit (success, warning…) correspondant à la couleur renvoyée par l'API (/referentiels). */
export function tonDeCouleur(couleur: string | undefined): string {
  switch (couleur) {
    case '--ok': case '--s-valide': case '--s-recette': return 'success';
    case '--ko': case '--s-bloque': return 'error';
    case '--warn': return 'warning';
    case '--accent': case '--s-en_cours': case '--s-developpe': return 'info';
    default: return 'neutral';
  }
}

/** Badge de statut du UI-Kit ; libellé et couleur fournis par l'API. */
@Component({
  selector: 'app-statut',
  imports: [StatusBadgeComponent],
  template: `<app-status-badge [label]="ref.libelle(code())" [color]="ton()" />`,
})
export class Statut {
  readonly ref = inject(ReferentielsService);
  readonly code = input.required<string>();
  readonly ton = computed(() => tonDeCouleur(this.ref.couleur(this.code())));
}
