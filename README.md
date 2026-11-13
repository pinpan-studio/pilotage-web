# pilotage-web

Interface web Angular de l'application **Pilotage** (portefeuille, synthèse, fonctionnalités,
livrables, journal). Cahier des charges : [`docs/PROMPT-APPLICATION.md`](docs/PROMPT-APPLICATION.md).

- Le client HTTP est **généré** depuis le contrat de `pilotage-api` (`src/api/openapi.json` →
  `src/api/genere/`) : aucun type métier n'est écrit à la main, aucun indicateur n'est recalculé.
- Libellés, couleurs et poids viennent de `GET /api/v1/referentiels`.
- Dates en français, fuseau Africa/Abidjan.

## Développement

```bash
npm install
PILOTAGE_API_URL=http://localhost:3000 npm start     # http://localhost:4200
```

| Script | Rôle |
|---|---|
| `npm run api:sync` | télécharge `openapi.json` depuis `PILOTAGE_API_URL` et régénère le client |
| `npm run api:gen` | régénère le client depuis `src/api/openapi.json` |
| `npm run build` | build de production (écrit `public/config.json` à partir de `PILOTAGE_API_URL`) |

## Déploiement sur Vercel

1. Vercel → **Add New → Project** → importer `pilotage-web` (réglages lus dans `vercel.json`).
2. **Settings → Environment Variables** : `PILOTAGE_API_URL` = adresse de l'API
   (ex. `https://pilotage-api.vercel.app`, sans `/` final).
3. Déployer, puis reporter l'adresse obtenue (ex. `https://pilotage-web.vercel.app`) dans la
   variable `WEB_ORIGIN` du projet `pilotage-api` et redéployer l'API (CORS).
