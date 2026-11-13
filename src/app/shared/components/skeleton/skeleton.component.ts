import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonVariant = 'line' | 'card' | 'table-row' | 'avatar';

/**
 * Placeholder de chargement générique (effet "shimmer"), à afficher à la place du
 * contenu réel tant qu'un signal `loading` est actif. Pas de dépendance externe.
 *
 * Usage :
 * ```html
 * @if (loading()) { <app-skeleton variant="card" [count]="3" /> } @else { ... }
 * ```
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (variant) {
      @case ('card') {
        <div class="skeleton-grid">
          @for (i of items(); track i) {
            <div class="skeleton-block skeleton-card"></div>
          }
        </div>
      }
      @case ('table-row') {
        <div class="skeleton-rows">
          @for (i of items(); track i) {
            <div class="skeleton-block skeleton-table-row"></div>
          }
        </div>
      }
      @case ('avatar') {
        <div class="skeleton-rows">
          @for (i of items(); track i) {
            <div class="skeleton-avatar-row">
              <div class="skeleton-block skeleton-avatar"></div>
              <div class="skeleton-avatar-lines">
                <div class="skeleton-block skeleton-line" style="width: 60%"></div>
                <div class="skeleton-block skeleton-line" style="width: 35%"></div>
              </div>
            </div>
          }
        </div>
      }
      @default {
        <div class="skeleton-rows">
          @for (i of items(); track i) {
            <div class="skeleton-block skeleton-line"></div>
          }
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; }

    .skeleton-block {
      position: relative;
      overflow: hidden;
      background: var(--mat-sys-surface-container-high, #e2e8f0);
      border-radius: var(--r-m, 8px);

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--mat-sys-surface, #fff) 55%, transparent), transparent);
        animation: skeleton-shimmer 1.4s ease-in-out infinite;
      }
    }

    @keyframes skeleton-shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .skeleton-rows {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .skeleton-line {
      height: 14px;
      width: 100%;
    }

    .skeleton-table-row {
      height: 44px;
      width: 100%;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: var(--space-l, 16px);
    }

    .skeleton-card {
      height: 140px;
      width: 100%;
    }

    .skeleton-avatar-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .skeleton-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .skeleton-avatar-lines {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
  `],
})
export class SkeletonComponent {
  @Input() variant: SkeletonVariant = 'line';
  @Input() count = 3;

  items(): number[] {
    return Array.from({ length: Math.max(1, this.count) }, (_, i) => i);
  }
}
