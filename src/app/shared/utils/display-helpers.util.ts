export function getProDisplayName(pro: any): string {
  if (!pro) return '—';
  if (typeof pro === 'string') return pro;
  if (pro.nom && pro.prenoms) return `${pro.nom} ${pro.prenoms}`;
  if (pro.nom) return pro.nom;
  if (pro.prenom) return pro.prenom;
  if (pro.denomination) return pro.denomination;
  if (pro.email) return pro.email;
  return 'Professionnel';
}

export function getCommandeStatusLabel(status: any): string {
  if (!status) return 'Inconnu';
  const s = String(status).toUpperCase();
  const map: Record<string, string> = {
    'EN_AFFECTATION': 'À affecter',
    'EN_ATTENTE_CONFIRMATION': 'En attente',
    'EN_COURS': 'En cours',
    'PRESTATION_TERMINEE': 'Terminée',
    'ANNULEE': 'Annulée',
    'REFUSEE': 'Refusée',
  };
  return map[s] || s;
}

export function getCommandeStatusClass(status: any): string {
  if (!status) return 'neutral';
  const s = String(status).toUpperCase();
  if (s === 'PRESTATION_TERMINEE' || s === 'TERMINEE' || s === 'CONFIRMEE') return 'success';
  if (s === 'EN_COURS' || s === 'EN_AFFECTATION') return 'info';
  if (s === 'EN_ATTENTE_CONFIRMATION' || s === 'EN_ATTENTE') return 'warning';
  if (s === 'ANNULEE' || s === 'REFUSEE') return 'danger';
  return 'neutral';
}

export function isCommandeCompleted(status: any): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'PRESTATION_TERMINEE' || s === 'TERMINEE' || s === 'CONFIRMEE';
}

export function isCommandeCancelled(status: any): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'ANNULEE' || s === 'REFUSEE';
}
