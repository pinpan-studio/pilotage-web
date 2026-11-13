import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Remplace les `XxxDrawerService` de chaque module d'origine (Produit, Finance, ASSAC…).
 * Pur état UI : une page émet `toggle$.next()` pour ouvrir / fermer la sous-navigation
 * latérale du module courant (le "module shell" s'y abonne).
 */
@Injectable({ providedIn: 'root' })
export class ModuleDrawerService {
  readonly toggle$ = new Subject<void>();

  toggle(): void {
    this.toggle$.next();
  }
}
