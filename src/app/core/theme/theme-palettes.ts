// GÉNÉRÉ par ui-kit/tools/generate-themes.mjs — ne pas modifier à la main.

/** Couleurs représentatives d'un thème pour un mode (rôles M3 primary / secondary / tertiary / primary-container). */
export interface ThemeSwatch {
  primary: string;
  secondary: string;
  tertiary: string;
  container: string;
}

/** Thème de couleur : la classe CSS `theme-<id>` applique ses palettes M3 (voir src/themes/_palettes.scss). */
export interface ThemePalette {
  id: string;
  label: string;
  /** Couleur source à partir de laquelle les palettes tonales M3 ont été calculées. */
  seed: string;
  light: ThemeSwatch;
  dark: ThemeSwatch;
}

export const THEME_PALETTES: readonly ThemePalette[] = [
  {
    id: 'cyan',
    label: 'Cyan',
    seed: '#006a6a',
    light: { primary: '#006a6a', secondary: '#4a6363', tertiary: '#964900', container: '#00fbfb' },
    dark: { primary: '#00dddd', secondary: '#b0cccb', tertiary: '#ffb787', container: '#004f4f' },
  },
  {
    id: 'baseline',
    label: 'Material',
    seed: '#6750a4',
    light: { primary: '#6750a4', secondary: '#63597c', tertiary: '#924274', container: '#e9ddff' },
    dark: { primary: '#cfbcff', secondary: '#cdc0e9', tertiary: '#ffaedb', container: '#4f378a' },
  },
  {
    id: 'red',
    label: 'Rouge',
    seed: '#e53935',
    light: { primary: '#bb171c', secondary: '#a13d36', tertiary: '#875200', container: '#ffdad6' },
    dark: { primary: '#ffb4ac', secondary: '#ffb4ac', tertiary: '#ffb866', container: '#93000d' },
  },
  {
    id: 'salmon',
    label: 'Saumon',
    seed: '#fa8072',
    light: { primary: '#a23d34', secondary: '#855049', tertiary: '#6b5f00', container: '#ffdad5' },
    dark: { primary: '#ffb4aa', secondary: '#fab6ad', tertiary: '#dcc83a', container: '#82261f' },
  },
  {
    id: 'coral',
    label: 'Corail',
    seed: '#f4511e',
    light: { primary: '#b02e00', secondary: '#9e4227', tertiary: '#755b00', container: '#ffdbd1' },
    dark: { primary: '#ffb5a0', secondary: '#ffb5a0', tertiary: '#edc147', container: '#872100' },
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    seed: '#c1502e',
    light: { primary: '#a53c1b', secondary: '#884f3f', tertiary: '#715c00', container: '#ffdbd1' },
    dark: { primary: '#ffb5a0', secondary: '#ffb5a0', tertiary: '#e3c457', container: '#842504' },
  },
  {
    id: 'peach',
    label: 'Pêche',
    seed: '#ffab91',
    light: { primary: '#8d4d38', secondary: '#79564c', tertiary: '#676018', container: '#ffdbd0' },
    dark: { primary: '#ffb59e', secondary: '#e9bdaf', tertiary: '#d3c976', container: '#713623' },
  },
  {
    id: 'brown',
    label: 'Brun',
    seed: '#6d4c41',
    light: { primary: '#79564b', secondary: '#6c5a55', tertiary: '#695d3d', container: '#ffdbcf' },
    dark: { primary: '#e9bdae', secondary: '#d9c2ba', tertiary: '#d5c59e', container: '#5e3f35' },
  },
  {
    id: 'copper',
    label: 'Cuivre',
    seed: '#b87333',
    light: { primary: '#8c4f10', secondary: '#79573c', tertiary: '#5c630e', container: '#ffdcc2' },
    dark: { primary: '#ffb77b', secondary: '#eabe9c', tertiary: '#c4cd6f', container: '#6d3a00' },
  },
  {
    id: 'orange',
    label: 'Orange',
    seed: '#fb8c00',
    light: { primary: '#8f4e00', secondary: '#845326', tertiary: '#5b6400', container: '#ffdcc2' },
    dark: { primary: '#ffb77b', secondary: '#fab983', tertiary: '#c0d030', container: '#6d3a00' },
  },
  {
    id: 'amber',
    label: 'Ambre',
    seed: '#ffb300',
    light: { primary: '#7e5700', secondary: '#795920', tertiary: '#586400', container: '#ffdeac' },
    dark: { primary: '#ffba38', secondary: '#eac07d', tertiary: '#bcd13f', container: '#604100' },
  },
  {
    id: 'mustard',
    label: 'Moutarde',
    seed: '#c7a317',
    light: { primary: '#725c00', secondary: '#6d5d2a', tertiary: '#476800', container: '#ffe082' },
    dark: { primary: '#eac33b', secondary: '#dac588', tertiary: '#abd467', container: '#564500' },
  },
  {
    id: 'sand',
    label: 'Sable',
    seed: '#c2b280',
    light: { primary: '#6a5e33', secondary: '#655e4a', tertiary: '#536442', container: '#f3e2ac' },
    dark: { primary: '#d6c692', secondary: '#d0c6ad', tertiary: '#bacda4', container: '#51461e' },
  },
  {
    id: 'yellow',
    label: 'Jaune',
    seed: '#fdd835',
    light: { primary: '#705d00', secondary: '#6c5e23', tertiary: '#4d6700', container: '#ffe16e' },
    dark: { primary: '#e8c41d', secondary: '#d9c680', tertiary: '#add452', container: '#544600' },
  },
  {
    id: 'olive',
    label: 'Olive',
    seed: '#808000',
    light: { primary: '#626200', secondary: '#616132', tertiary: '#2d6b23', container: '#e9e86b' },
    dark: { primary: '#cccc52', secondary: '#cbc991', tertiary: '#94d781', container: '#494900' },
  },
  {
    id: 'chartreuse',
    label: 'Chartreuse',
    seed: '#c0ca33',
    light: { primary: '#5d6300', secondary: '#5e622a', tertiary: '#006e17', container: '#e1eb53' },
    dark: { primary: '#c5cf38', secondary: '#c7cb87', tertiary: '#7ddc77', container: '#464a00' },
  },
  {
    id: 'lime',
    label: 'Anis',
    seed: '#7cb342',
    light: { primary: '#3c6a00', secondary: '#4f6537', tertiary: '#006c53', container: '#b8f47a' },
    dark: { primary: '#9dd761', secondary: '#b5cf97', tertiary: '#4bdeb2', container: '#2c5000' },
  },
  {
    id: 'sage',
    label: 'Sauge',
    seed: '#87a96b',
    light: { primary: '#486730', secondary: '#556349', tertiary: '#0c6a5c', container: '#c9eea9' },
    dark: { primary: '#aed18f', secondary: '#bdcbac', tertiary: '#86d5c3', container: '#314e1b' },
  },
  {
    id: 'forest',
    label: 'Forêt',
    seed: '#1b5e20',
    light: { primary: '#2a6b2c', secondary: '#4b6547', tertiary: '#1d619c', container: '#acf4a4' },
    dark: { primary: '#91d78a', secondary: '#b1cfaa', tertiary: '#9ecaff', container: '#0c5216' },
  },
  {
    id: 'green',
    label: 'Vert',
    seed: '#43a047',
    light: { primary: '#006e1c', secondary: '#446741', tertiary: '#006495', container: '#98f994' },
    dark: { primary: '#7ddc7a', secondary: '#aad1a2', tertiary: '#90cdff', container: '#005313' },
  },
  {
    id: 'mint',
    label: 'Menthe',
    seed: '#3eb489',
    light: { primary: '#006c4d', secondary: '#3e6654', tertiary: '#5555a9', container: '#86f8c8' },
    dark: { primary: '#69dbad', secondary: '#a5d0ba', tertiary: '#c2c1ff', container: '#005139' },
  },
  {
    id: 'teal',
    label: 'Sarcelle',
    seed: '#00897b',
    light: { primary: '#006b5f', secondary: '#41655f', tertiary: '#6b5196', container: '#8df5e4' },
    dark: { primary: '#70d8c8', secondary: '#a8cec6', tertiary: '#d4bbff', container: '#005048' },
  },
  {
    id: 'turquoise',
    label: 'Turquoise',
    seed: '#40e0d0',
    light: { primary: '#006a62', secondary: '#346760', tertiary: '#5b598d', container: '#61f9e9' },
    dark: { primary: '#3adccc', secondary: '#9cd1c8', tertiary: '#c4c1fb', container: '#005049' },
  },
  {
    id: 'slate',
    label: 'Ardoise',
    seed: '#546e7a',
    light: { primary: '#48626e', secondary: '#566065', tertiary: '#6a5871', container: '#cbe7f5' },
    dark: { primary: '#afcbd8', secondary: '#bec8ce', tertiary: '#d5bfdc', container: '#304a55' },
  },
  {
    id: 'ocean',
    label: 'Océan',
    seed: '#006994',
    light: { primary: '#00658e', secondary: '#486173', tertiary: '#794d8d', container: '#c7e7ff' },
    dark: { primary: '#85cfff', secondary: '#afcadf', tertiary: '#e7b4fc', container: '#004c6c' },
  },
  {
    id: 'sky',
    label: 'Ciel',
    seed: '#039be5',
    light: { primary: '#006496', secondary: '#3e627f', tertiary: '#8242a1', container: '#cbe6ff' },
    dark: { primary: '#90cdff', secondary: '#a6cbeb', tertiary: '#e9b3ff', container: '#004b72' },
  },
  {
    id: 'steel',
    label: 'Bleu acier',
    seed: '#4682b4',
    light: { primary: '#206393', secondary: '#4c6075', tertiary: '#7c4c88', container: '#cee5ff' },
    dark: { primary: '#96ccff', secondary: '#b3c9e0', tertiary: '#ebb3f7', container: '#004a75' },
  },
  {
    id: 'blue',
    label: 'Bleu',
    seed: '#1e88e5',
    light: { primary: '#0060a8', secondary: '#446084', tertiary: '#873ea3', container: '#d3e4ff' },
    dark: { primary: '#a2c9ff', secondary: '#acc8f2', tertiary: '#edb1ff', container: '#004881' },
  },
  {
    id: 'sapphire',
    label: 'Saphir',
    seed: '#0f52ba',
    light: { primary: '#1d59c1', secondary: '#4d5e86', tertiary: '#893da1', container: '#d9e2ff' },
    dark: { primary: '#b0c6ff', secondary: '#b5c6f5', tertiary: '#f0b0ff', container: '#00419c' },
  },
  {
    id: 'indigo',
    label: 'Indigo',
    seed: '#3949ab',
    light: { primary: '#4555b7', secondary: '#565c83', tertiary: '#8c3f92', container: '#dee0ff' },
    dark: { primary: '#bbc3ff', secondary: '#bfc4f1', tertiary: '#ffa9ff', container: '#2c3c9e' },
  },
  {
    id: 'navy',
    label: 'Bleu nuit',
    seed: '#1a237e',
    light: { primary: '#4c56af', secondary: '#585c80', tertiary: '#864492', container: '#e0e0ff' },
    dark: { primary: '#bdc2ff', secondary: '#c1c3ed', tertiary: '#f6adff', container: '#343d96' },
  },
  {
    id: 'lavender',
    label: 'Lavande',
    seed: '#9575cd',
    light: { primary: '#6d4ea2', secondary: '#65587b', tertiary: '#95416d', container: '#ebdcff' },
    dark: { primary: '#d4bbff', secondary: '#d0bfe8', tertiary: '#ffafd3', container: '#543589' },
  },
  {
    id: 'purple',
    label: 'Violet',
    seed: '#8e24aa',
    light: { primary: '#942cb0', secondary: '#7c4d86', tertiary: '#af245f', container: '#fdd6ff' },
    dark: { primary: '#f3aeff', secondary: '#ecb3f4', tertiary: '#ffb1c6', container: '#790096' },
  },
  {
    id: 'lilac',
    label: 'Lilas',
    seed: '#c8a2c8',
    light: { primary: '#745475', secondary: '#695a68', tertiary: '#845055', container: '#ffd6fe' },
    dark: { primary: '#e2bae1', secondary: '#d5c1d2', tertiary: '#f8b5ba', container: '#5a3c5d' },
  },
  {
    id: 'fuchsia',
    label: 'Fuchsia',
    seed: '#e040fb',
    light: { primary: '#a200bb', secondary: '#8e3b9b', tertiary: '#bb0058', container: '#ffd6fe' },
    dark: { primary: '#faabff', secondary: '#faabff', tertiary: '#ffb1c3', container: '#7b008f' },
  },
  {
    id: 'plum',
    label: 'Prune',
    seed: '#5e2750',
    light: { primary: '#864a75', secondary: '#735668', tertiary: '#934843', container: '#ffd7ee' },
    dark: { primary: '#fab0e1', secondary: '#e1bcd2', tertiary: '#ffb3ad', container: '#6b325c' },
  },
  {
    id: 'powder',
    label: 'Rose poudré',
    seed: '#e8a0b4',
    light: { primary: '#874d5f', secondary: '#74565e', tertiary: '#845326', container: '#ffd9e1' },
    dark: { primary: '#fcb2c6', secondary: '#e3bdc6', tertiary: '#fab983', container: '#6c3647' },
  },
  {
    id: 'bordeaux',
    label: 'Bordeaux',
    seed: '#7b1e3a',
    light: { primary: '#a03b56', secondary: '#83505a', tertiary: '#944a1b', container: '#ffd9df' },
    dark: { primary: '#ffb1c0', secondary: '#f7b5c1', tertiary: '#ffb68f', container: '#81233f' },
  },
  {
    id: 'pink',
    label: 'Rose',
    seed: '#d81b60',
    light: { primary: '#bc004f', secondary: '#a33855', tertiary: '#a83900', container: '#ffd9de' },
    dark: { primary: '#ffb2bf', secondary: '#ffb2bf', tertiary: '#ffb59a', container: '#90003b' },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    seed: '#616161',
    light: { primary: '#5e5e5e', secondary: '#5f5e5e', tertiary: '#605d5f', container: '#e4e2e2' },
    dark: { primary: '#c7c6c6', secondary: '#c8c6c5', tertiary: '#cac5c7', container: '#464747' },
  },
  {
    id: 'taupe',
    label: 'Taupe',
    seed: '#8b7d6b',
    light: { primary: '#695c4c', secondary: '#645d55', tertiary: '#5d6050', container: '#f2e0cb' },
    dark: { primary: '#d5c4b0', secondary: '#cfc5bb', tertiary: '#c6c8b5', container: '#504535' },
  },
];

export type ThemePaletteId = (typeof THEME_PALETTES)[number]['id'];

export const DEFAULT_THEME_PALETTE = 'cyan';
