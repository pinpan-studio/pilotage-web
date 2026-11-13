/**
 * Classe CSS de puce de statut partagée par Client/Produit/Équipement/Intervention.
 * Les composants consommateurs doivent définir les classes .chip-active/.chip-inactive/
 * .chip-warning/.chip-error/.chip-primary dans leur propre feuille de style.
 */
const STATUS_CLASS_MAP: Record<string, string> = {
  ACTIF: 'chip-active',
  ACTIVE: 'chip-active',
  DISPONIBLE: 'chip-active',
  PAYEE: 'chip-active',

  INACTIF: 'chip-inactive',
  BROUILLON: 'chip-inactive',

  SUSPENDU: 'chip-warning',
  EMISE: 'chip-warning',
  PLANIFIEE: 'chip-warning',
  DESACTIVEE: 'chip-warning',

  HORS_SERVICE: 'chip-error',
  DESINSTALLEE: 'chip-error',
  RETIRE: 'chip-error',
  RETIREE: 'chip-error',
  ANNULEE: 'chip-error',
  EXPIRE: 'chip-error',
  RESILIE: 'chip-error',
  DEFAILLANT: 'chip-error',

  INSTALLEE: 'chip-primary',
  INSTALLE: 'chip-primary',
};

export function getStatusClass(statut: string | undefined | null): string {
  if (!statut) return 'chip-inactive';
  return STATUS_CLASS_MAP[statut] || 'chip-inactive';
}
