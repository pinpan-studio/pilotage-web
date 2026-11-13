/**
 * Couleur de <app-status-badge> partagée par les fiches détail
 * Client / Produit / Équipement / Intervention.
 * Retourne l'une des couleurs supportées par .m3-badge :
 * success | warning | error | info | neutral.
 */
const STATUS_BADGE_COLOR: Record<string, string> = {
  ACTIF: 'success',
  ACTIVE: 'success',
  DISPONIBLE: 'success',
  PAYEE: 'success',
  RESPECTEE: 'success',

  INACTIF: 'neutral',
  BROUILLON: 'neutral',

  SUSPENDU: 'warning',
  SUSPENDUE: 'warning',
  EMISE: 'warning',
  PLANIFIEE: 'warning',
  DESACTIVEE: 'warning',
  EN_ATTENTE: 'warning',

  HORS_SERVICE: 'error',
  DESINSTALLEE: 'error',
  RETIRE: 'error',
  RETIREE: 'error',
  ANNULEE: 'error',
  EXPIRE: 'error',
  RESILIE: 'error',
  DEFAILLANT: 'error',

  INSTALLE: 'info',
  INSTALLEE: 'info',
};

export function statusBadgeColor(statut: string | undefined | null): string {
  if (!statut) return 'neutral';
  return STATUS_BADGE_COLOR[statut] || 'neutral';
}
