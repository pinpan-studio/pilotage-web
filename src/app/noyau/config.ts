/** Configuration lue à l'exécution (public/config.json, généré au build). */
export interface Config { apiUrl: string }
export const VERSION_API_ATTENDUE = 'v1';
export let CONFIG: Config = { apiUrl: 'http://localhost:3000' };
export async function chargerConfig() {
  try {
    const r = await fetch('/config.json', { cache: 'no-store' });
    if (r.ok) CONFIG = await r.json();
  } catch { /* défaut */ }
  return CONFIG;
}
