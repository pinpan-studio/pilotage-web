import { FilterOption } from '../filter-dropdown/filter-dropdown.component';

/**
 * Modèle générique des composants de planification (kanban, gantt, notes, vue groupée,
 * calendrier, agenda). Aucun champ n'est propre à un métier : interventions, livraisons,
 * réservations, tickets… se projettent tous sur `PlanningItem`.
 */
export type PlanningTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'error' | 'purple';

export interface PlanningItem<T = unknown> {
  id: string;
  title: string;
  /** Référence courte affichée en tête de carte (ex : INT-0412). */
  ref?: string;
  description?: string;
  /** Clé de colonne (kanban). */
  status?: string;
  /** Clé de regroupement (lignes du gantt, vue groupée). */
  group?: string;
  start?: Date | string;
  end?: Date | string;
  /** Échéance : l'élément est « en retard » si elle est dépassée et qu'il n'est pas terminé. */
  due?: Date | string;
  done?: boolean;
  /** Progression 0–100. */
  progress?: number;
  /** Couleur sémantique (suit le thème clair / sombre). */
  tone?: PlanningTone;
  /** Couleur explicite, prioritaire sur `tone`. */
  color?: string;
  badge?: { label: string; tone?: PlanningTone };
  /** Personne assignée (affichée en initiales). */
  assignee?: string;
  tags?: string[];
  /** Valeurs filtrables arbitraires, lues par défaut par les filtres déclarés. */
  fields?: Record<string, string | string[] | undefined>;
  /** Objet métier d'origine, renvoyé tel quel dans les événements. */
  data?: T;
}

export interface PlanningColumn { key: string; label: string; color?: string; }
export interface PlanningGroup { key: string; label: string; subtitle?: string; color?: string; icon?: string; }

/** Filtre déclaratif optionnel. Sans `value`, lit `item.fields[key]` puis `item[key]`. */
export interface PlanningFilter {
  key: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
  value?: (item: PlanningItem) => string | string[] | undefined;
}

export interface PlanningFilterState { search: string; values: Partial<Record<string, string>>; lateOnly: boolean; }
export const EMPTY_FILTER_STATE: PlanningFilterState = { search: '', values: {}, lateOnly: false };

export function toDate(v: Date | string | undefined | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function isLate(item: PlanningItem, now = new Date()): boolean {
  const due = toDate(item.due);
  return !item.done && !!due && due < now;
}

export function toneVar(tone: PlanningTone | undefined): string {
  switch (tone) {
    case 'primary': return 'var(--primary-color)';
    case 'info': return 'var(--info-color)';
    case 'success': return 'var(--success-color)';
    case 'warning': return 'var(--warning-color)';
    case 'error': return 'var(--error-color)';
    case 'purple': return 'var(--purple-color)';
    default: return 'var(--text-muted)';
  }
}

/** Couleur d'un élément : `color` explicite, sinon `tone`, sinon terminé / en retard / neutre. */
export function itemColor(item: PlanningItem): string {
  if (item.color) return item.color;
  if (item.tone) return toneVar(item.tone);
  if (item.done) return toneVar('success');
  if (isLate(item)) return toneVar('error');
  return toneVar('primary');
}

export function initials(name: string | undefined): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function filterValue(item: PlanningItem, f: PlanningFilter): string[] {
  const raw = f.value ? f.value(item) : (item.fields?.[f.key] ?? (item as unknown as Record<string, unknown>)[f.key]);
  if (raw == null) return [];
  return (Array.isArray(raw) ? raw : [raw]).map(String);
}

/** Applique recherche, filtres déclarés et « en retard uniquement ». */
export function applyPlanningFilters(items: PlanningItem[], filters: PlanningFilter[], state: PlanningFilterState): PlanningItem[] {
  const q = state.search.trim().toLowerCase();
  const active = filters.filter((f) => state.values[f.key] && state.values[f.key] !== 'all');
  if (!q && !active.length && !state.lateOnly) return items;
  const now = new Date();
  return items.filter((it) => {
    if (q) {
      const hay = [it.title, it.ref, it.description, it.assignee, ...(it.tags ?? [])].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    for (const f of active) if (!filterValue(it, f).includes(state.values[f.key]!)) return false;
    if (state.lateOnly && !isLate(it, now)) return false;
    return true;
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function startOfWeek(d: Date): Date { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }

/** Date de référence d'un élément pour les vues calendaires : début, sinon échéance. */
export function anchorDate(item: PlanningItem): Date | null { return toDate(item.start) ?? toDate(item.due); }

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
