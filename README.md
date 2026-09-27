# BLH XAUUSD

Code source de la plateforme BLH XAUUSD, importé depuis la version 10 publiée avec ChatGPT Sites et préparé pour Vercel.

## Fonctionnalités actuelles

- Graphiques XAU/USD et BTC/USD
- Périodes 1m, 5m, 15m, 30m et 1h
- Structure de marché, Fibonacci et risque/rendement
- Zones achat/vente, TP1, TP2 et TP3
- Heatmap de régression et profil de volume
- Interface multilingue et espace client
- Historique local des analyses

## Organisation

- `public/` : site statique, écran de connexion et traductions.
- `api/index.js` : API Vercel Edge, authentification Supabase et données de marché protégées.
- `worker/index.js` : archive de la version importée, non utilisée au déploiement.
- `vercel.json` : en-têtes de sécurité.
- `VERCEL.md` : procédure d’import dans Vercel.

## Configuration

Le déploiement requiert `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`. La clé publique/publishable est utilisée uniquement par l’API serveur du site ; aucune clé `service_role` n’est nécessaire.

La variable `TWELVEDATA_API_KEY` est facultative. Sans elle, le serveur tente sa source de secours. Aucune clé n’est incluse dans ce dépôt.

## Accès

L’accès utilise Supabase Auth avec e-mail et mot de passe. Les sessions sont conservées dans des cookies `HttpOnly`, `Secure` et `SameSite=Lax`. La connexion, l’inscription, la confirmation d’e-mail et la réinitialisation de mot de passe sont séparées. L’interface est disponible en français, anglais, espagnol et arabe (RTL).

Les données de marché sont refusées sans session valide. Aucune table applicative Supabase n’est requise pour ce flux d’authentification.
