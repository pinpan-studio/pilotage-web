import { Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeModePreference, ThemeService } from '../../../core/services/theme.service';

/**
 * Réglages d'apparence : mode (clair / sombre / système, bouton segmenté M3) et thème de
 * couleur (pastilles primary / secondary / tertiary de chaque palette M3). Utilisable seul,
 * par exemple dans une page de réglages ; voir aussi `<app-theme-picker>` (bouton de barre d'outils).
 */
@Component({
  selector: 'app-theme-settings',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatIconModule, MatTooltipModule],
  template: `
    <section class="ts-section" aria-labelledby="ts-mode">
      <h3 id="ts-mode" class="ts-title">Mode</h3>
      <mat-button-toggle-group class="ts-modes" hideSingleSelectionIndicator [value]="theme.preference()" (change)="setMode($event.value)" aria-labelledby="ts-mode">
        @for (m of modes; track m.value) {
          <mat-button-toggle [value]="m.value"><mat-icon>{{ m.icon }}</mat-icon> {{ m.label }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
    </section>

    <section class="ts-section" aria-labelledby="ts-color">
      <h3 id="ts-color" class="ts-title">Couleur <span class="ts-current">{{ theme.label() }}</span></h3>
      <div class="ts-swatches" role="radiogroup" aria-labelledby="ts-color">
        @if (theme.customSwatch(); as cs) {
          @let s = theme.mode() === 'dark' ? cs.dark : cs.light;
          @let selected = theme.isCustom();
          <button type="button" class="ts-swatch ts-swatch--custom" role="radio" [attr.aria-checked]="selected" aria-label="Personnalisé"
                  [class.selected]="selected" matTooltip="Personnalisé" (click)="theme.useCustom()">
            <span class="ts-dot" [style.--sw-primary]="s.primary" [style.--sw-secondary]="s.secondary" [style.--sw-tertiary]="s.tertiary">
              <mat-icon class="ts-check">{{ selected ? 'check' : 'tune' }}</mat-icon>
            </span>
          </button>
        }
        @for (p of theme.palettes; track p.id) {
          @let s = theme.mode() === 'dark' ? p.dark : p.light;
          @let selected = !theme.isCustom() && p.id === theme.paletteId();
          <button type="button" class="ts-swatch" role="radio" [attr.aria-checked]="selected" [attr.aria-label]="p.label"
                  [class.selected]="selected" [matTooltip]="p.label" (click)="theme.setPalette(p.id)">
            <span class="ts-dot" [style.--sw-primary]="s.primary" [style.--sw-secondary]="s.secondary" [style.--sw-tertiary]="s.tertiary">
              @if (selected) { <mat-icon class="ts-check">check</mat-icon> }
            </span>
          </button>
        }
      </div>
    </section>

    @if (showStudioLink()) {
      <a matButton="tonal" class="ts-studio" routerLink="/theme-studio" (click)="studio.emit()">
        <mat-icon>tune</mat-icon> Studio de thème : couleurs, styles, nuances
      </a>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 20px; }
    .ts-section { display: flex; flex-direction: column; gap: 10px; }
    .ts-title {
      margin: 0; display: flex; align-items: baseline; gap: 8px;
      font: var(--mat-sys-title-small); color: var(--mat-sys-on-surface);
    }
    .ts-current { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .ts-modes { width: 100%; }
    .ts-modes mat-button-toggle { flex: 1; min-width: 0; }
    .ts-modes ::ng-deep .mat-button-toggle-label-content { padding: 0 8px; }
    .ts-modes mat-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: -4px; margin-right: 2px; }
    .ts-swatches { display: grid; grid-template-columns: repeat(auto-fill, 48px); gap: 4px; justify-content: space-between; }
    /* Cible tactile 48 px (Material), pastille 40 px. */
    .ts-swatch {
      width: 48px; height: 48px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer;
      display: grid; place-items: center; position: relative;
    }
    .ts-swatch::before {
      content: ''; position: absolute; inset: 2px; border-radius: 50%;
      background: var(--mat-sys-on-surface); opacity: 0; transition: opacity 150ms;
    }
    .ts-swatch:hover::before { opacity: var(--mat-sys-hover-state-layer-opacity, 0.08); }
    .ts-swatch:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: 0; }
    .ts-dot {
      position: relative; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
      background: conic-gradient(from 90deg, var(--sw-tertiary) 0 25%, var(--sw-secondary) 0 50%, var(--sw-primary) 0 100%);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
      transition: transform 150ms;
    }
    .ts-swatch.selected .ts-dot {
      transform: scale(0.85);
      box-shadow: 0 0 0 3px var(--mat-sys-surface-container), 0 0 0 5px var(--sw-primary);
    }
    .ts-studio { align-self: stretch; }
    .ts-check {
      font-size: 20px; width: 20px; height: 20px; border-radius: 50%;
      background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface);
    }
  `],
})
export class ThemeSettingsComponent {
  readonly theme = inject(ThemeService);
  /** Affiche le lien vers le studio de thème (masqué dans le studio lui-même). */
  readonly showStudioLink = input(true);
  /** Émis au clic sur le lien du studio (le panneau flottant se ferme). */
  readonly studio = output<void>();

  readonly modes: { value: ThemeModePreference; label: string; icon: string }[] = [
    { value: 'light', label: 'Clair', icon: 'light_mode' },
    { value: 'dark', label: 'Sombre', icon: 'dark_mode' },
    { value: 'system', label: 'Système', icon: 'brightness_auto' },
  ];

  setMode(mode: ThemeModePreference): void {
    this.theme.setMode(mode);
  }
}

/** Bouton « Apparence » de barre d'outils : ouvre les réglages de thème dans un panneau flottant. */
@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [OverlayModule, MatButtonModule, MatIconModule, MatTooltipModule, ThemeSettingsComponent],
  template: `
    <button mat-icon-button cdkOverlayOrigin #origin="cdkOverlayOrigin"
            matTooltip="Apparence : mode et couleur" aria-label="Apparence : mode et couleur" aria-haspopup="dialog" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <mat-icon>palette</mat-icon>
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open()"
                 [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayHasBackdrop]="true"
                 cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                 (backdropClick)="open.set(false)" (detach)="open.set(false)" (overlayKeydown)="onKey($event)">
      <div class="tp-panel" role="dialog" aria-label="Apparence">
        <app-theme-settings (studio)="open.set(false)" />
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: inline-flex; }
    .tp-panel {
      width: min(380px, calc(100vw - 32px)); box-sizing: border-box; padding: 20px;
      max-height: calc(100vh - 96px); overflow-y: auto; overscroll-behavior: contain;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface);
      border-radius: var(--mat-sys-corner-large, 16px); box-shadow: var(--mat-sys-level2);
    }
  `],
})
export class ThemePickerComponent {
  readonly open = signal(false);
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
  ];

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.open.set(false);
  }
}
