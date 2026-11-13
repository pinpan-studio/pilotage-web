/**
 * Corrige la typographie française d'un texte saisi au clavier :
 * guillemets « », apostrophe ’, points de suspension …, tiret –, espaces insécables avant : ; ! ? »,
 * séparateurs de milliers (espace fine), unités et heures (14 h 05).
 */
const NBSP = ' ';   // espace insécable
const NNBSP = ' ';  // espace fine insécable

const URL_RE = /(https?:\/\/\S+|www\.\S+|\S+@\S+\.\w+)/g;
const UNITS = 'FCFA|F CFA|F|XOF|€|EUR|\\$|km|kg|m|habitants|véhicules|balises|clients|Mo|Ko|Go';

export function frenchTypography(input: string): string {
  // Les URL et adresses email sont laissées intactes.
  return input.split(URL_RE).map((part, i) => (i % 2 ? part : fix(part))).join('');
}

function fix(input: string): string {
  let s = input;
  s = s.replace(/\.{3}/g, '…');
  s = s.replace(/(\p{L})'(\p{L})/gu, '$1’$2');
  // Guillemets droits → chevrons (alternance ouvrant / fermant)
  let open = true;
  s = s.replace(/"/g, () => { const q = open ? '«' : '»'; open = !open; return q; });
  s = s.replace(/«\s*/g, '«' + NBSP).replace(/\s*»/g, NBSP + '»');
  // Incises : « - » isolé entre espaces → tiret demi-cadratin
  s = s.replace(/ - /g, ' – ');
  // Heures 14h05 / 9h → 14 h 05
  s = s.replace(/\b(\d{1,2})\s?h\s?(\d{2})?\b/g, (_m, h, mn) => `${h}${NBSP}h${mn ? NBSP + mn : ''}`);
  // Milliers : seulement pour un montant / une quantité (suivi d'une devise ou d'une unité) — pas les identifiants.
  s = s.replace(new RegExp(`(?<![\\d,.\\p{L}-])(\\d{4,})(?=(?:[.,]\\d+)?\\s?(?:${UNITS})(?![\\p{L}\\d]))`, 'gu'), (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP));
  // Unités courantes
  s = s.replace(/(\d)\s?(FCFA|F CFA|€|%|km\/h|km|kg|m|h|min|Mo|Ko|Go)(?![\p{L}\d])/gu, `$1${NBSP}$2`).replace(/(\d)\s?%/g, `$1${NBSP}%`);
  // Ponctuation haute
  s = s.replace(/\s*([;!?])/g, `${NNBSP}$1`).replace(/(\S)\s*:(?!\/\/|\d)/g, `$1${NBSP}:`);
  // Majuscules accentuées en début de phrase courantes
  s = s.replace(/\bEtat\b/g, 'État').replace(/\bEquipe\b/g, 'Équipe').replace(/\bA (?=\p{Ll})/gu, 'À ');
  return s;
}

/** Rend visibles les espaces spéciales pour la démonstration (◦ insécable, · fine insécable). */
export function revealSpaces(s: string): { t: string; kind: 'text' | 'nbsp' | 'nnbsp' }[] {
  const out: { t: string; kind: 'text' | 'nbsp' | 'nnbsp' }[] = [];
  for (const ch of s) {
    const kind = ch === NBSP ? 'nbsp' : ch === NNBSP ? 'nnbsp' : 'text';
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.t += ch; else out.push({ t: kind === 'text' ? ch : ' ', kind });
  }
  return out;
}
