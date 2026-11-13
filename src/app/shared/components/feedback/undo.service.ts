import { Component, Injectable, OnInit, inject, signal } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

export interface UndoOptions {
  message: string;
  /** Rétablit l'état précédent (appelé si l'utilisateur clique « Annuler »). */
  undo: () => void;
  /** Exécute réellement l'action (appel serveur) une fois le délai écoulé sans annulation. */
  commit?: () => void;
  duration?: number;
  icon?: string;
  actionLabel?: string;
}

interface UndoData extends Required<Omit<UndoOptions, 'commit'>> { }

@Component({
  selector: 'app-undo-snack',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="kit-undo">
      <mat-icon class="u-ic">{{ data.icon }}</mat-icon>
      <span class="u-msg">{{ data.message }}</span>
      <button type="button" class="u-btn" (click)="ref.dismissWithAction()"><mat-icon>undo</mat-icon>{{ data.actionLabel }}</button>
      <span class="u-count">{{ left() }}</span>
      <i class="u-bar" [style.animation-duration.ms]="data.duration"></i>
    </div>
  `,
})
export class UndoSnackComponent implements OnInit {
  readonly ref = inject<MatSnackBarRef<UndoSnackComponent>>(MatSnackBarRef);
  readonly data = inject<UndoData>(MAT_SNACK_BAR_DATA);
  left = signal(Math.ceil(this.data.duration / 1000));
  ngOnInit(): void {
    const t = setInterval(() => this.left.set(Math.max(0, this.left() - 1)), 1000);
    this.ref.afterDismissed().subscribe(() => clearInterval(t));
  }
}

/**
 * Actions annulables (suppression, archivage, envoi) : l'interface applique le changement tout de suite
 * (optimiste), affiche un snackbar « Annuler » avec compte à rebours, puis valide (`commit`) à l'expiration
 * ou rétablit (`undo`) sur demande. Remplace avantageusement une boîte de confirmation.
 *
 * ```ts
 * const before = this.rows();
 * this.rows.set(before.filter((r) => r.id !== id));
 * this.undo.run({ message: 'Client supprimé', undo: () => this.rows.set(before), commit: () => api.delete(id) });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UndoService {
  private snack = inject(MatSnackBar);
  private pending: (() => void) | null = null;

  run(o: UndoOptions): void {
    // Une nouvelle action valide immédiatement la précédente encore en attente.
    this.flush();
    const duration = o.duration ?? 5000;
    let undone = false;
    const mine = () => { if (!undone) o.commit?.(); };
    this.pending = mine;
    const ref = this.snack.openFromComponent(UndoSnackComponent, {
      data: { message: o.message, undo: o.undo, duration, icon: o.icon ?? 'delete', actionLabel: o.actionLabel ?? 'Annuler' } satisfies UndoData,
      duration, panelClass: 'kit-undo-panel', horizontalPosition: 'center', verticalPosition: 'bottom',
    });
    ref.onAction().subscribe(() => { undone = true; if (this.pending === mine) this.pending = null; o.undo(); });
    // Ne valide que sa propre action (une action plus récente a pu remplacer celle-ci).
    ref.afterDismissed().subscribe(() => { if (this.pending === mine) this.flush(); });
  }

  /** Valide sans attendre l'action en attente (ex. avant une navigation). */
  flush(): void { const p = this.pending; this.pending = null; p?.(); }
}
