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

- `worker/index.js` : serveur et ressources de la version importée.
- `api/index.js` : adaptateur Vercel Edge.
- `vercel.json` : routage des pages, ressources et API.
- `VERCEL.md` : procédure d’import dans Vercel.

## Configuration

La clé `TWELVEDATA_API_KEY` peut être enregistrée dans les variables secrètes de l’hébergeur. Sans cette clé, le serveur tente sa source de secours. Aucune clé secrète n’est incluse dans ce dépôt.

## Accès actuel

Le déploiement Vercel expose la version importée comme démonstration publique. Une authentification serveur et une base de données devront être ajoutées avant les comptes clients et abonnements.

L’abonnement Stripe, le dashboard Admin avec statistiques pays/région et les animations Three.js restent à construire.
