/** Couleur d'avatar stable dérivée d'un libellé (saturation contenue pour rester sobre). */
export function hue(s: string): string {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 32% 44%)`;
}

/** Initiales (2 lettres) d'un nom. */
export function initials(s: string): string {
  const parts = s.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : s.slice(0, 2)).toUpperCase();
}

/** Résout un jeton CSS en couleur rgb() concrète (le canvas de Chart.js ignore var(), color-mix(), light-dark()…). */
export function resolveColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** Couleur rgb()/rgba() avec opacité. */
export function alpha(color: string, a: number): string {
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  return rgb ? `rgba(${rgb[1].split(/[ ,/]+/).slice(0, 3).join(',')},${a})` : color;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) pour des séries d'exemple stables. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Palette du thème courant lue sur les jetons CSS (à recalculer à chaque changement de thème). */
export function themePalette() {
  const v = resolveColor;
  return {
    primary: v('--primary-color'), tertiary: v('--tertiary-color'), success: v('--success-color'), warning: v('--warning-color'),
    error: v('--error-color'), info: v('--info-color'), purple: v('--purple-color'), muted: v('--text-muted'), text: v('--text-secondary'),
    grid: v('--border-color'), card: v('--card-bg'),
  };
}
export type ThemePalette = ReturnType<typeof themePalette>;
