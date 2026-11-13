import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="empty-state">
      <div class="icon-wrap">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <h3>{{ title() }}</h3>
      <p>{{ subtitle() }}</p>
      @if (actionLabel()) {
        <button mat-flat-button color="primary" (click)="actionClick.emit()">
          <mat-icon>add</mat-icon>
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 64px 32px; text-align: center; gap: 12px;
    }
    .icon-wrap {
      width: 80px; height: 80px; border-radius: 50%;
      background: var(--mat-sys-surface-container-high, var(--hover-bg));
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 8px;
      mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--mat-sys-on-surface-variant, var(--text-secondary)); opacity: 0.5; }
    }
    h3 { font-size: 18px !important; font-weight: 700 !important; }
    p  { color: var(--mat-sys-on-surface-variant, var(--text-secondary)); font-size: 14px; max-width: 300px; }
  `]
})
export class EmptyStateComponent {
  icon        = input<string>('inbox');
  title       = input<string>('Aucun résultat');
  subtitle    = input<string>('Il n\'y a rien à afficher pour le moment.');
  actionLabel = input<string>('');
  actionClick = output<void>();
}
