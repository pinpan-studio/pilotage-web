/** Conversions entre les dates « AAAA-MM-JJ » de l'API et les objets Date des sélecteurs Material (fuseau local, sans décalage). */
export function versDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return a ? new Date(a, m - 1, j) : null;
}
export function versIso(d: Date | null | undefined): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** Adaptateur des sélecteurs de date : saisie et affichage au format français jj/mm/aaaa (l'adaptateur natif lit mm/jj). */
@Injectable()
export class AdaptateurDateFr extends NativeDateAdapter {
  override parse(valeur: unknown): Date | null {
    if (typeof valeur === 'string') {
      const m = /^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})\s*$/.exec(valeur);
      if (m) {
        const a = Number(m[3].length === 2 ? `20${m[3]}` : m[3]), mo = Number(m[2]) - 1, j = Number(m[1]);
        const d = new Date(a, mo, j);
        return d.getFullYear() === a && d.getMonth() === mo && d.getDate() === j ? d : this.invalid();
      }
      if (!valeur.trim()) return null;
      const iso = versDate(valeur);
      if (iso && /^\d{4}-\d{2}-\d{2}/.test(valeur)) return iso;
      return this.invalid();
    }
    return super.parse(valeur);
  }
  override format(date: Date, displayFormat: object): string {
    if (!this.isValid(date)) return '';
    return new Intl.DateTimeFormat('fr-FR', { ...(displayFormat as Intl.DateTimeFormatOptions), timeZone: undefined }).format(date);
  }
  override getFirstDayOfWeek(): number { return 1; }
}

/** Formats d'affichage (repris de la configuration du ui-kit). */
export const FORMATS_DATE_FR = {
  parse: { dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
  },
};
