// Écrit public/config.json au build : l'URL de l'API vient de la variable PILOTAGE_API_URL
// (réglée dans Vercel → Settings → Environment Variables). Aucun secret ici.
import { writeFileSync } from 'node:fs';
const apiUrl = (process.env.PILOTAGE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
writeFileSync(new URL('../public/config.json', import.meta.url), JSON.stringify({ apiUrl }, null, 2) + '\n');
console.log(`config.json : apiUrl = ${apiUrl}`);
