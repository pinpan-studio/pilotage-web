import { Component, Injectable, booleanAttribute, computed, effect, inject, input, output, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type BannerTone = 'info' | 'success' | 'warning' | 'error' | 'maintenance' | 'offline' | 'promo';

const TONE_ICON: Record<BannerTone, string> = {
  info: 'info', success: 'check_circle', warning: 'warning', error: 'error', maintenance: 'engineering', offline: 'wifi_off', promo: 'campaign',
};

/**
 * Bannière pleine largeur pour un message global (maintenance planifiée, mode hors ligne, incident,
 * nouveauté) : ton coloré, action, fermeture mémorisable (`dismissKey`), variante compacte.
 *
 * ```html
 * <app-banner tone="maintenance" title="Maintenance dimanche 2 h – 4 h" actionLabel="En savoir plus" dismissKey="maint-2026-10" />
 * ```
 */
@Component({
  selector: 'app-banner',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (!dismissed()) {
      <div class="bn" [class]="'bn bn--' + tone()" [class.compact]="compact()" [attr.role]="tone() === 'error' || tone() === 'offline' ? 'alert' : 'status'">
        <mat-icon class="bn-ic" [class.spin]="spin()">{{ icon() || toneIcon() }}</mat-icon>
        <div class="bn-text">
          @if (title()) { <strong>{{ title() }}</strong> }
          <span><ng-content /></span>
        </div>
        @if (actionLabel()) { <button type="button" class="bn-action" (click)="action.emit()">{{ actionLabel() }}</button> }
        @if (dismissible()) { <button type="button" class="bn-close" (click)="dismiss()" aria-label="Fermer"><mat-icon>close</mat-icon></button> }
      </div>
    }
  `,
  styleUrls: ['./banner.component.scss'],
})
export class BannerComponent {
  tone = input<BannerTone>('info');
  title = input('');
  icon = input('');
  spin = input(false, { transform: booleanAttribute });
  actionLabel = input('');
  dismissible = input(true, { transform: booleanAttribute });
  compact = input(false, { transform: booleanAttribute });
  /** Mémorise la fermeture (localStorage) sous cette clé. */
  dismissKey = input('');
  action = output<void>();
  closed = output<void>();

  private closedNow = signal(false);
  toneIcon = computed(() => TONE_ICON[this.tone()]);
  dismissed = computed(() => {
    if (this.closedNow()) return true;
    const k = this.dismissKey();
    try { return !!k && localStorage.getItem('kit-banner-' + k) === '1'; } catch { return false; }
  });

  dismiss(): void {
    this.closedNow.set(true);
    const k = this.dismissKey();
    if (k) try { localStorage.setItem('kit-banner-' + k, '1'); } catch { /* stockage indisponible */ }
    this.closed.emit();
  }
  /** Réaffiche une bannière fermée (oublie la mémorisation). */
  reset(): void {
    this.closedNow.set(false);
    const k = this.dismissKey();
    if (k) try { localStorage.removeItem('kit-banner-' + k); } catch { /* stockage indisponible */ }
  }
}

/** État de la connexion réseau (événements online / offline du navigateur). */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private win = inject(DOCUMENT).defaultView;
  readonly online = signal(this.win?.navigator.onLine ?? true);
  /** Instant du dernier retour en ligne (pour un message « connexion rétablie » temporaire). */
  readonly restoredAt = signal<number | null>(null);

  constructor() {
    this.win?.addEventListener('online', () => { this.online.set(true); this.restoredAt.set(Date.now()); });
    this.win?.addEventListener('offline', () => this.online.set(false));
  }
  /** Simulation (démo) : force l'état. */
  simulate(online: boolean): void {
    if (online && !this.online()) this.restoredAt.set(Date.now());
    this.online.set(online);
  }
}

/**
 * Indicateur hors ligne automatique : bannière rouge tant que la connexion est perdue, puis
 * « Connexion rétablie » pendant quelques secondes. À placer une fois dans le layout.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [BannerComponent],
  template: `
    @if (!net.online()) {
      <app-banner tone="offline" title="Vous êtes hors ligne" [dismissible]="false" [compact]="compact()">
        Les modifications seront synchronisées au retour de la connexion.
      </app-banner>
    } @else if (showRestored()) {
      <app-banner tone="success" title="Connexion rétablie" [dismissible]="false" [compact]="compact()" icon="wifi">Vos données sont à jour.</app-banner>
    }
  `,
  styles: [`:host { display: block; }`],
})
export class OfflineBannerComponent {
  readonly net = inject(NetworkStatusService);
  compact = input(true, { transform: booleanAttribute });
  showRestored = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.net.restoredAt()) return;
      this.showRestored.set(true);
      const t = setTimeout(() => this.showRestored.set(false), 3500);
      onCleanup(() => clearTimeout(t));
    });
  }
}
