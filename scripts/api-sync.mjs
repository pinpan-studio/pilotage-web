// npm run api:sync — télécharge le contrat OpenAPI depuis l'API (PILOTAGE_API_URL) puis régénère le client typé.
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const api = (process.env.PILOTAGE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const r = await fetch(`${api}/api/v1/openapi.json`);
if (!r.ok) { console.error(`Échec du téléchargement (${r.status}) depuis ${api}`); process.exit(1); }
writeFileSync(new URL('../src/api/openapi.json', import.meta.url), JSON.stringify(await r.json(), null, 2) + '\n');
execSync('npx ng-openapi-gen', { stdio: 'inherit' });
console.log(`Client régénéré depuis ${api}`);
