import {
  DynamicScheme, Hct, SchemeContent, SchemeExpressive, SchemeFidelity, SchemeFruitSalad, SchemeMonochrome,
  SchemeNeutral, SchemeRainbow, SchemeTonalSpot, SchemeVibrant, TonalPalette, argbFromHex, hexFromArgb,
} from '@material/material-color-utilities';

/** Styles de schéma Material 3 (variantes de `DynamicScheme`). */
export type SchemeStyle =
  | 'fidelity' | 'tonal-spot' | 'neutral' | 'vibrant' | 'expressive' | 'content' | 'rainbow' | 'fruit-salad' | 'monochrome';

/** Rôles dont la palette peut être imposée (sinon dérivée de la couleur source selon le style). */
export type OverridableRole = 'secondary' | 'tertiary' | 'neutral' | 'neutralVariant' | 'error';

/** Thème personnalisé : couleur source + style + contraste + couleurs imposées par rôle. */
export interface CustomThemeConfig {
  /** Couleur source (#rrggbb) : détermine la palette primary. */
  source: string;
  style: SchemeStyle;
  /** -1 (réduit) → 0 (standard M3) → 1 (contraste élevé). */
  contrast: number;
  overrides: Partial<Record<OverridableRole, string>>;
}

export interface SchemeStyleOption { id: SchemeStyle; label: string; description: string; }

export const SCHEME_STYLES: readonly SchemeStyleOption[] = [
  { id: 'fidelity', label: 'Fidélité', description: 'Primary fidèle à la couleur choisie (même rendu que les thèmes prédéfinis).' },
  { id: 'tonal-spot', label: 'Tonal spot', description: 'Style par défaut d’Android : primary adoucie, ambiance calme.' },
  { id: 'vibrant', label: 'Vibrant', description: 'Couleurs saturées au maximum, pour une interface énergique.' },
  { id: 'expressive', label: 'Expressif', description: 'Teintes décalées et contrastées, volontairement inattendues.' },
  { id: 'content', label: 'Contenu', description: 'Suit fidèlement la couleur source, pensé pour s’accorder à une image.' },
  { id: 'rainbow', label: 'Arc-en-ciel', description: 'Accents colorés sur des surfaces neutres.' },
  { id: 'fruit-salad', label: 'Salade de fruits', description: 'Primary et tertiary de teintes très différentes, ludique.' },
  { id: 'neutral', label: 'Neutre', description: 'Couleurs très désaturées, presque grises.' },
  { id: 'monochrome', label: 'Noir & blanc', description: 'Monochrome : primary noire en clair, blanche en sombre, aucune teinte.' },
];

export const CONTRAST_LEVELS = [
  { value: 0, label: 'Standard' },
  { value: 0.5, label: 'Moyen' },
  { value: 1, label: 'Élevé' },
] as const;

export const OVERRIDABLE_ROLES: readonly { id: OverridableRole; label: string; hint: string }[] = [
  { id: 'secondary', label: 'Secondary', hint: 'Composants moins visibles : chips, indicateur de navigation, boutons tonals.' },
  { id: 'tertiary', label: 'Tertiary', hint: 'Accents contrastés : badges, mises en avant.' },
  { id: 'neutral', label: 'Neutral', hint: 'Surfaces et fonds (teinte légère).' },
  { id: 'neutralVariant', label: 'Neutral variant', hint: 'Contours, textes secondaires, surfaces variantes.' },
  { id: 'error', label: 'Error', hint: 'États d’erreur.' },
];

/** Tons affichés dans les nuanciers (0 = noir, 100 = blanc). */
export const SHOWCASE_TONES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100] as const;

const SCHEMES: Record<SchemeStyle, new (hct: Hct, isDark: boolean, contrast: number) => DynamicScheme> = {
  'fidelity': SchemeFidelity,
  'tonal-spot': SchemeTonalSpot,
  'neutral': SchemeNeutral,
  'vibrant': SchemeVibrant,
  'expressive': SchemeExpressive,
  'content': SchemeContent,
  'rainbow': SchemeRainbow,
  'fruit-salad': SchemeFruitSalad,
  'monochrome': SchemeMonochrome,
};

/** Rôles système Angular Material (`--mat-sys-<role>`) émis par `mat.theme()`. */
const ROLE_GETTERS: Record<string, (s: DynamicScheme) => number> = {
  'background': (s) => s.background,
  'on-background': (s) => s.onBackground,
  'primary': (s) => s.primary,
  'on-primary': (s) => s.onPrimary,
  'primary-container': (s) => s.primaryContainer,
  'on-primary-container': (s) => s.onPrimaryContainer,
  'primary-fixed': (s) => s.primaryFixed,
  'primary-fixed-dim': (s) => s.primaryFixedDim,
  'on-primary-fixed': (s) => s.onPrimaryFixed,
  'on-primary-fixed-variant': (s) => s.onPrimaryFixedVariant,
  'inverse-primary': (s) => s.inversePrimary,
  'secondary': (s) => s.secondary,
  'on-secondary': (s) => s.onSecondary,
  'secondary-container': (s) => s.secondaryContainer,
  'on-secondary-container': (s) => s.onSecondaryContainer,
  'secondary-fixed': (s) => s.secondaryFixed,
  'secondary-fixed-dim': (s) => s.secondaryFixedDim,
  'on-secondary-fixed': (s) => s.onSecondaryFixed,
  'on-secondary-fixed-variant': (s) => s.onSecondaryFixedVariant,
  'tertiary': (s) => s.tertiary,
  'on-tertiary': (s) => s.onTertiary,
  'tertiary-container': (s) => s.tertiaryContainer,
  'on-tertiary-container': (s) => s.onTertiaryContainer,
  'tertiary-fixed': (s) => s.tertiaryFixed,
  'tertiary-fixed-dim': (s) => s.tertiaryFixedDim,
  'on-tertiary-fixed': (s) => s.onTertiaryFixed,
  'on-tertiary-fixed-variant': (s) => s.onTertiaryFixedVariant,
  'error': (s) => s.error,
  'on-error': (s) => s.onError,
  'error-container': (s) => s.errorContainer,
  'on-error-container': (s) => s.onErrorContainer,
  'surface': (s) => s.surface,
  'on-surface': (s) => s.onSurface,
  'surface-variant': (s) => s.surfaceVariant,
  'on-surface-variant': (s) => s.onSurfaceVariant,
  'surface-dim': (s) => s.surfaceDim,
  'surface-bright': (s) => s.surfaceBright,
  'surface-container-lowest': (s) => s.surfaceContainerLowest,
  'surface-container-low': (s) => s.surfaceContainerLow,
  'surface-container': (s) => s.surfaceContainer,
  'surface-container-high': (s) => s.surfaceContainerHigh,
  'surface-container-highest': (s) => s.surfaceContainerHighest,
  'surface-tint': (s) => s.surfaceTint,
  'inverse-surface': (s) => s.inverseSurface,
  'inverse-on-surface': (s) => s.inverseOnSurface,
  'outline': (s) => s.outline,
  'outline-variant': (s) => s.outlineVariant,
  'shadow': (s) => s.shadow,
  'scrim': (s) => s.scrim,
  'neutral10': (s) => s.neutralPalette.tone(10),
  'neutral-variant20': (s) => s.neutralVariantPalette.tone(20),
};

/** Noms des propriétés CSS posées pour un thème personnalisé. */
export const CUSTOM_THEME_PROPERTIES = Object.keys(ROLE_GETTERS).map((r) => '--mat-sys-' + r);

export function isHexColor(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-f]{6}$/i.test(v);
}

export function normalizeConfig(cfg: Partial<CustomThemeConfig> | null | undefined, fallbackSource: string): CustomThemeConfig {
  const overrides: CustomThemeConfig['overrides'] = {};
  for (const r of OVERRIDABLE_ROLES) {
    const v = cfg?.overrides?.[r.id];
    if (isHexColor(v)) overrides[r.id] = v.toLowerCase();
  }
  return {
    source: isHexColor(cfg?.source) ? cfg!.source.toLowerCase() : fallbackSource,
    style: SCHEME_STYLES.some((s) => s.id === cfg?.style) ? cfg!.style! : 'fidelity',
    contrast: typeof cfg?.contrast === 'number' ? Math.max(-1, Math.min(1, cfg.contrast)) : 0,
    overrides,
  };
}

/**
 * Schéma dynamique M3 : palettes du style choisi, remplacées par celles des couleurs imposées.
 * Les rôles (et leurs contrastes) sont ensuite résolus par material-color-utilities.
 */
export function createScheme(cfg: CustomThemeConfig, isDark: boolean): DynamicScheme {
  const source = Hct.fromInt(argbFromHex(cfg.source));
  const base = new SCHEMES[cfg.style](source, isDark, cfg.contrast);
  const pal = (role: OverridableRole, fallback: TonalPalette) => {
    const hex = cfg.overrides[role];
    return hex ? TonalPalette.fromInt(argbFromHex(hex)) : fallback;
  };
  return new DynamicScheme({
    sourceColorHct: source,
    variant: base.variant,
    contrastLevel: cfg.contrast,
    isDark,
    primaryPalette: base.primaryPalette,
    secondaryPalette: pal('secondary', base.secondaryPalette),
    tertiaryPalette: pal('tertiary', base.tertiaryPalette),
    neutralPalette: pal('neutral', base.neutralPalette),
    neutralVariantPalette: pal('neutralVariant', base.neutralVariantPalette),
    errorPalette: pal('error', base.errorPalette),
  });
}

/** Couleurs des rôles M3 (`role` → #hex) pour un mode. */
export function schemeColors(cfg: CustomThemeConfig, isDark: boolean): Record<string, string> {
  const scheme = createScheme(cfg, isDark);
  return Object.fromEntries(Object.entries(ROLE_GETTERS).map(([role, get]) => [role, hexFromArgb(get(scheme))]));
}

/** Variables `--mat-sys-*` en `light-dark(clair, sombre)`, comme `mat.theme()` avec `color-scheme`. */
export function cssVariables(cfg: CustomThemeConfig): Record<string, string> {
  const light = schemeColors(cfg, false);
  const dark = schemeColors(cfg, true);
  return Object.fromEntries(Object.keys(light).map((r) => ['--mat-sys-' + r, `light-dark(${light[r]}, ${dark[r]})`]));
}

/** Variables `--mat-sys-*` d'un seul mode (aperçus côte à côte). */
export function cssVariablesFor(cfg: CustomThemeConfig, isDark: boolean): Record<string, string> {
  const colors = schemeColors(cfg, isDark);
  return Object.fromEntries(Object.entries(colors).map(([r, v]) => ['--mat-sys-' + r, v]));
}

export interface PaletteStrip { key: string; label: string; keyColor: string; tones: { tone: number; hex: string }[]; }

/** Nuanciers : chaque palette tonale du thème, tons 0 → 100. */
export function paletteStrips(cfg: CustomThemeConfig): PaletteStrip[] {
  const s = createScheme(cfg, false);
  const rows: [string, string, TonalPalette, number][] = [
    ['primary', 'Primary', s.primaryPalette, s.primaryPaletteKeyColor],
    ['secondary', 'Secondary', s.secondaryPalette, s.secondaryPaletteKeyColor],
    ['tertiary', 'Tertiary', s.tertiaryPalette, s.tertiaryPaletteKeyColor],
    ['neutral', 'Neutral', s.neutralPalette, s.neutralPaletteKeyColor],
    ['neutralVariant', 'Neutral variant', s.neutralVariantPalette, s.neutralVariantPaletteKeyColor],
    ['error', 'Error', s.errorPalette, s.errorPaletteKeyColor],
  ];
  return rows.map(([key, label, p, keyColor]) => ({
    key, label, keyColor: hexFromArgb(keyColor),
    tones: SHOWCASE_TONES.map((tone) => ({ tone, hex: hexFromArgb(p.tone(tone)) })),
  }));
}

/** Couleur clé de chaque palette dérivée (affichée quand un rôle est en « auto »). */
export function derivedKeyColors(cfg: CustomThemeConfig): Record<OverridableRole | 'primary', string> {
  const s = createScheme({ ...cfg, overrides: {} }, false);
  return {
    primary: hexFromArgb(s.primaryPaletteKeyColor),
    secondary: hexFromArgb(s.secondaryPaletteKeyColor),
    tertiary: hexFromArgb(s.tertiaryPaletteKeyColor),
    neutral: hexFromArgb(s.neutralPaletteKeyColor),
    neutralVariant: hexFromArgb(s.neutralVariantPaletteKeyColor),
    error: hexFromArgb(s.errorPaletteKeyColor),
  };
}

/** Feuille CSS prête à coller (à charger après le thème Angular Material). */
export function exportCss(cfg: CustomThemeConfig, selector = '.theme-custom'): string {
  const vars = cssVariables(cfg);
  const desc = SCHEME_STYLES.find((s) => s.id === cfg.style)?.label;
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `/* Thème personnalisé — source ${cfg.source}, style ${desc}, contraste ${cfg.contrast} */\n${selector} {\n${lines}\n}\n`;
}

/** Contraste WCAG entre deux couleurs #hex. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = argbFromHex(hex);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
