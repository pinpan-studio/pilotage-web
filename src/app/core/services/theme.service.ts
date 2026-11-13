import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { DEFAULT_THEME_PALETTE, THEME_PALETTES, ThemePalette, ThemeSwatch } from '../theme/theme-palettes';
import { CUSTOM_THEME_PROPERTIES, CustomThemeConfig, cssVariables, normalizeConfig, schemeColors } from '../theme/custom-theme';

/** Mode effectivement appliqué. */
export type ThemeMode = 'light' | 'dark';

/** Choix de l'utilisateur : un mode fixe, ou suivre le réglage du système (recommandé par Material). */
export type ThemeModePreference = ThemeMode | 'system';

/** Origine des couleurs : une palette prédéfinie ou le thème personnalisé du studio. */
export type ThemeSource = 'preset' | 'custom';

const MODE_KEY = 'ui-kit-theme';
const PALETTE_KEY = 'ui-kit-palette';
const SOURCE_KEY = 'ui-kit-theme-source';
const CUSTOM_KEY = 'ui-kit-custom-theme';

/**
 * Thème purement visuel : mode clair / sombre / système et thème de couleur M3.
 * Pose sur <body> et sur le conteneur d'overlays (dialogs, menus, selects) :
 *  - `light` ou `dark` (color-scheme : ton clair ou sombre des rôles M3) ;
 *  - `theme-<id>` (palettes tonales du thème, voir src/themes/_palettes.scss) ;
 *  - ou `theme-custom` + les variables `--mat-sys-*` calculées par le studio de thème.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private document = inject(DOCUMENT);
  private overlay = inject(OverlayContainer);
  private media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  private systemDark = signal(!!this.media?.matches);

  readonly palettes: readonly ThemePalette[] = THEME_PALETTES;

  readonly preference = signal<ThemeModePreference>(this.read(MODE_KEY, ['light', 'dark', 'system'], 'light'));
  readonly paletteId = signal<string>(this.read(PALETTE_KEY, THEME_PALETTES.map((p) => p.id), DEFAULT_THEME_PALETTE));
  /** Dernier thème personnalisé (conservé même quand une palette prédéfinie est active). */
  readonly custom = signal<CustomThemeConfig | null>(this.readCustom());
  readonly source = signal<ThemeSource>(this.custom() ? this.read(SOURCE_KEY, ['preset', 'custom'], 'preset') : 'preset');

  /** Mode appliqué (résout `system`). */
  readonly mode = computed<ThemeMode>(() => {
    const pref = this.preference();
    return pref === 'system' ? (this.systemDark() ? 'dark' : 'light') : pref;
  });

  readonly palette = computed(() => THEME_PALETTES.find((p) => p.id === this.paletteId()) ?? THEME_PALETTES[0]);

  readonly isCustom = computed(() => this.source() === 'custom' && !!this.custom());

  /** Libellé du thème de couleur courant. */
  readonly label = computed(() => (this.isCustom() ? 'Personnalisé' : this.palette().label));

  /** Pastilles du thème personnalisé (null s'il n'existe pas). */
  readonly customSwatch = computed<{ light: ThemeSwatch; dark: ThemeSwatch } | null>(() => {
    const cfg = this.custom();
    if (!cfg) return null;
    const sw = (dark: boolean): ThemeSwatch => {
      const c = schemeColors(cfg, dark);
      return { primary: c['primary'], secondary: c['secondary'], tertiary: c['tertiary'], container: c['primary-container'] };
    };
    return { light: sw(false), dark: sw(true) };
  });

  constructor() {
    this.media?.addEventListener?.('change', (e) => this.systemDark.set(e.matches));
    // Les aperçus en iframe (/showcases) suivent en direct le thème choisi dans le catalogue.
    this.document.defaultView?.addEventListener('storage', (e) => this.sync(e.key));
    this.apply();
    effect(() => this.apply());
  }

  toggle(): void {
    this.setMode(this.mode() === 'light' ? 'dark' : 'light');
  }

  /** Conservé pour compatibilité : équivaut à `setMode`. */
  set(mode: ThemeModePreference): void {
    this.setMode(mode);
  }

  setMode(mode: ThemeModePreference): void {
    this.preference.set(mode);
    this.write(MODE_KEY, mode);
  }

  /** Active une palette prédéfinie. */
  setPalette(id: string): void {
    if (!THEME_PALETTES.some((p) => p.id === id)) return;
    this.paletteId.set(id);
    this.write(PALETTE_KEY, id);
    this.setSource('preset');
  }

  /** Enregistre et active un thème personnalisé. */
  applyCustom(config: CustomThemeConfig): void {
    const cfg = normalizeConfig(config, this.palette().seed);
    this.custom.set(cfg);
    this.write(CUSTOM_KEY, JSON.stringify(cfg));
    this.setSource('custom');
  }

  /** Réactive le dernier thème personnalisé enregistré. */
  useCustom(): void {
    if (this.custom()) this.setSource('custom');
  }

  private setSource(source: ThemeSource): void {
    this.source.set(source);
    this.write(SOURCE_KEY, source);
  }

  private apply(): void {
    const mode = this.mode();
    const cfg = this.isCustom() ? this.custom() : null;
    const vars = cfg ? cssVariables(cfg) : null;
    const themeClass = cfg ? 'theme-custom' : 'theme-' + this.palette().id;
    for (const el of [this.document.body, this.overlay.getContainerElement()]) {
      el.classList.remove('light', 'dark', 'theme-custom', ...THEME_PALETTES.map((p) => 'theme-' + p.id));
      el.classList.add(mode, themeClass);
      for (const prop of CUSTOM_THEME_PROPERTIES) {
        if (vars) el.style.setProperty(prop, vars[prop]);
        else el.style.removeProperty(prop);
      }
    }
  }

  /** Relit une préférence modifiée par un autre document de même origine (onglet, iframe). */
  private sync(key: string | null): void {
    if (key === null || key === MODE_KEY) this.preference.set(this.read(MODE_KEY, ['light', 'dark', 'system'], 'light'));
    if (key === null || key === PALETTE_KEY) this.paletteId.set(this.read(PALETTE_KEY, THEME_PALETTES.map((p) => p.id), DEFAULT_THEME_PALETTE));
    if (key === null || key === CUSTOM_KEY) this.custom.set(this.readCustom());
    if (key === null || key === SOURCE_KEY) this.source.set(this.custom() ? this.read(SOURCE_KEY, ['preset', 'custom'], 'preset') : 'preset');
  }

  private readCustom(): CustomThemeConfig | null {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY);
      return raw ? normalizeConfig(JSON.parse(raw), THEME_PALETTES[0].seed) : null;
    } catch {
      return null;
    }
  }

  private read<T extends string>(key: string, allowed: readonly string[], fallback: T): T {
    try {
      const saved = localStorage.getItem(key);
      if (saved && allowed.includes(saved)) return saved as T;
    } catch { /* stockage indisponible */ }
    return fallback;
  }

  private write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
  }
}
