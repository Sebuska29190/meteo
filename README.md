# MétéoLive - Alertes météo en direct (France)

Site professionnel affichant en temps réel les alertes de vigilance Météo-France, le radar des précipitations et le vent (Open-Meteo), avec bascule FR/EN.

## Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind v4 + react-leaflet
- Proxy: Cloudflare Worker (cache + clé API Météo-France)
- Données: Météo-France Vigilance API, Open-Meteo (AROME/ARPEGE), RainViewer (radar), GeoJSON départements

## Démarrage local
```bash
cd frontend && npm install && npm run dev
```

## Déploiement Cloudflare Pages
1. Connecter le repo GitHub à Cloudflare Pages, build command `npm run build`, output `dist`.
2. Déployer le worker: `cd worker && npm install && npx wrangler secret put METEOFRANCE_API_KEY && npx wrangler deploy`
3. Renseigner l'URL du worker dans `frontend/.env` (`VITE_API_BASE=...`).

## Licence
Données Météo-France sous licence ouverte. Open-Meteo CC BY 4.0.